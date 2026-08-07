import { defaultUrl } from "@main/infra/devUtils";
import { createEncryption } from "@main/lib/store/createYmlStore";
import { getYoutubeView } from "@main/lifecycle";
import { APP_THUMB_SCHEME, fromAppThumbRequest, isCachableThumbUrl } from "@shared/media/appThumbUrl";
import { logger } from "@shared/utils/console";
import { createHash } from "crypto";
import { app, session as electronSession, net, type Session } from "electron";
import type Encryption from "encryption.js";
import { existsSync, promises as fs, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "fs";
import { join } from "path";

const log = logger.child("thumb-cache");
const MAX_ENTRIES = 200;
const META_EXT = ".json";
/** Produces `thumb-cache.key` via getOrCreateEncryptionSecret. */
const THUMB_CACHE_NAME = "thumb-cache";

interface CacheMeta {
	url: string;
	mime: string;
	savedAt: number;
	size: number;
}

interface CacheEntry {
	mime: string;
	filePath: string;
	size: number;
}

function tick(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Disk + in-flight cache for YT CDN thumbs.
 * Fetches via youtubeView session (cookies / UA / referer) so Google sees
 * the logged-in client — then serves bytes to app windows (tray, etc.).
 * Meta JSON encrypted with persistent secret from `thumb-cache.key`.
 */
class ThumbnailCache {
	private dir: string | null = null;
	private encryptor: Encryption | null = null;
	private readonly inflight = new Map<string, Promise<CacheEntry>>();
	private registered = false;

	private ensureDir(): string {
		if (this.dir) return this.dir;
		this.dir = join(app.getPath("userData"), "thumb-cache");
		if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
		return this.dir;
	}

	private getEncryptor(): Encryption {
		if (!this.encryptor) this.encryptor = createEncryption(THUMB_CACHE_NAME, "aes-256-cbc");
		return this.encryptor;
	}

	/** Call once after `app.ready`. */
	registerProtocol(): void {
		if (this.registered) return;
		this.registered = true;
		this.ensureDir();
		this.getEncryptor();

		// Bind to defaultSession — app windows share it.
		electronSession.defaultSession.protocol.handle(APP_THUMB_SCHEME, async (request) => {
			const remote = fromAppThumbRequest(request.url);
			if (!remote) {
				log.warn("bad thumb url", request.url);
				return new Response("bad thumb url", { status: 400 });
			}
			try {
				// Leave protocol stack before session network I/O (avoids nested-fetch stalls).
				await tick();
				const entry = await this.get(remote);
				const buf = readFileSync(entry.filePath);
				return new Response(new Uint8Array(buf), {
					status: 200,
					headers: {
						"Content-Type": entry.mime,
						"Content-Length": String(buf.byteLength),
						"Cache-Control": "public, max-age=31536000, immutable",
						"Access-Control-Allow-Origin": "*",
					},
				});
			} catch (err) {
				log.error("protocol serve failed", remote, err);
				return new Response(null, { status: 502 });
			}
		});
		log.debug("registered", APP_THUMB_SCHEME);
	}

	async get(url: string): Promise<CacheEntry> {
		if (!isCachableThumbUrl(url)) {
			throw new Error(`uncachable thumb url: ${url}`);
		}
		const key = this.keyFor(url);
		const existing = this.readLocal(key, url);
		if (existing) return existing;

		const pending = this.inflight.get(key);
		if (pending) return pending;

		const job = this.fetchAndStore(key, url).finally(() => this.inflight.delete(key));
		this.inflight.set(key, job);
		return job;
	}

	async getBuffer(url: string): Promise<Buffer | null> {
		try {
			const entry = await this.get(url);
			return readFileSync(entry.filePath);
		} catch (err) {
			log.warn("getBuffer failed", url, err);
			return null;
		}
	}

	/** Prefer youtubeView session so CDN sees logged-in cookies + chrome UA. */
	private resolveYoutubeContext(): { session: Session; userAgent: string; referrer: string } {
		const view = getYoutubeView();
		const wc = view?.webContents;
		const ses = wc && !wc.isDestroyed() ? wc.session : electronSession.defaultSession;
		const userAgent =
			(wc && !wc.isDestroyed() && wc.getUserAgent()) || app.userAgentFallback || "Mozilla/5.0";
		const referrer =
			(wc && !wc.isDestroyed() && wc.getURL()?.startsWith("http") && wc.getURL()) || `${defaultUrl}/`;
		return { session: ses, userAgent, referrer };
	}

	private keyFor(url: string): string {
		return createHash("sha256").update(url).digest("hex");
	}

	private paths(key: string) {
		const dir = this.ensureDir();
		return {
			bin: join(dir, key),
			meta: join(dir, key + META_EXT),
		};
	}

	private dropLocal(key: string): void {
		const { bin, meta } = this.paths(key);
		try {
			if (existsSync(meta)) unlinkSync(meta);
			if (existsSync(bin)) unlinkSync(bin);
		} catch {
			/* ignore */
		}
	}

	private readLocal(key: string, url: string): CacheEntry | null {
		const { bin, meta } = this.paths(key);
		if (!existsSync(bin) || !existsSync(meta)) return null;
		try {
			const parsed = this.getEncryptor().decrypt<CacheMeta>(readFileSync(meta, "utf8"));
			if (!parsed || typeof parsed !== "object" || parsed.url !== url) {
				log.warn("thumb meta decrypt invalid — refetch", url);
				this.dropLocal(key);
				return null;
			}
			const size = parsed.size || statSync(bin).size;
			if (size <= 0) {
				this.dropLocal(key);
				return null;
			}
			return { mime: parsed.mime || "image/jpeg", filePath: bin, size };
		} catch (err) {
			log.warn("thumb meta decrypt failed — refetch", url, err);
			this.dropLocal(key);
			return null;
		}
	}

	private async fetchAndStore(key: string, url: string): Promise<CacheEntry> {
		const { session: ses, userAgent, referrer } = this.resolveYoutubeContext();
		const headers: Record<string, string> = {
			"User-Agent": userAgent,
			Referer: referrer,
			Origin: defaultUrl,
			Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.9",
		};

		// Prefer session.fetch (cookies). Fall back to net.fetch if session call fails
		// (e.g. nested protocol / partition edge cases in packaged builds).
		let res: Response;
		try {
			res = await ses.fetch(url, { headers, bypassCustomProtocolHandlers: true });
		} catch (err) {
			log.warn("session.fetch failed, trying net.fetch", url, err);
			res = await net.fetch(url, { headers, bypassCustomProtocolHandlers: true });
		}

		if (!res.ok) {
			throw new Error(`thumb fetch ${res.status} ${url}`);
		}
		const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim() || "image/jpeg";
		const buffer = Buffer.from(await res.arrayBuffer());
		if (buffer.byteLength === 0) {
			throw new Error(`empty thumb body ${url}`);
		}

		const { bin, meta } = this.paths(key);
		const metaBody: CacheMeta = { url, mime, savedAt: Date.now(), size: buffer.byteLength };
		await fs.writeFile(bin, buffer);
		await fs.writeFile(meta, this.getEncryptor().encrypt(metaBody), "utf8");
		void this.prune();
		return { mime, filePath: bin, size: buffer.byteLength };
	}

	private prune(): void {
		try {
			const dir = this.ensureDir();
			const metas = readdirSync(dir).filter((f) => f.endsWith(META_EXT));
			if (metas.length <= MAX_ENTRIES) return;
			const ranked = metas
				.map((name) => {
					const full = join(dir, name);
					return { full, key: name.slice(0, -META_EXT.length), mtime: statSync(full).mtimeMs };
				})
				.sort((a, b) => a.mtime - b.mtime);
			const drop = ranked.slice(0, ranked.length - MAX_ENTRIES);
			for (const item of drop) {
				try {
					unlinkSync(item.full);
					unlinkSync(join(dir, item.key));
				} catch {
					/* ignore */
				}
			}
		} catch (err) {
			log.warn("prune failed", err);
		}
	}
}

export const thumbnailCache = new ThumbnailCache();
