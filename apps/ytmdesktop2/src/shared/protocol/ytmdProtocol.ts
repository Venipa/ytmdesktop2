/** `ytmd://` share / deep-link helpers (shared main + renderer). */
export class YtmdLink {
	static readonly scheme = "ytmd";

	private static readonly videoIdRe = /^[A-Za-z0-9_-]{11}$/;
	private static readonly playlistIdRe = /^[A-Za-z0-9_-]{2,128}$/;

	/** `ytmd://watch/<videoId>[/<playlistId>]` */
	static watch(videoId: string, playlistId?: string | null): string {
		const base = `${YtmdLink.scheme}://watch/${videoId}`;
		const list = playlistId?.trim();
		return list && YtmdLink.playlistIdRe.test(list) ? `${base}/${list}` : base;
	}

	/** Share link for a track; pulls `list=` from music canonical URL when present. */
	static share(videoId: string, musicUrl?: string | null): string {
		return YtmdLink.watch(videoId, YtmdLink.playlistFromMusicUrl(musicUrl));
	}

	/** Parse watch deep link. Invalid playlist ignored; video still opens. */
	static parse(url: string): { videoId: string; playlistId?: string } | null {
		const raw = YtmdLink.unquote(url);
		if (!/^ytmd:\/\//i.test(raw)) return null;

		let parsed: URL;
		try {
			parsed = new URL(raw);
		} catch {
			return null;
		}
		if (parsed.protocol.toLowerCase() !== `${YtmdLink.scheme}:`) return null;

		const parts = [parsed.hostname, ...parsed.pathname.split("/")].map((s) => s.trim()).filter(Boolean);
		if (parts[0]?.toLowerCase() !== "watch") return null;

		const videoId = parts[1];
		if (!videoId || !YtmdLink.videoIdRe.test(videoId)) return null;

		const candidate = parts[2] || parsed.searchParams.get("list")?.trim() || undefined;
		const playlistId = candidate && YtmdLink.playlistIdRe.test(candidate) ? candidate : undefined;
		return playlistId ? { videoId, playlistId } : { videoId };
	}

	/** First `ytmd://…` in process/second-instance argv. */
	static fromArgv(argv: readonly string[]): string | null {
		for (const arg of argv) {
			if (typeof arg !== "string") continue;
			const cleaned = YtmdLink.unquote(arg);
			if (/^ytmd:\/\//i.test(cleaned)) return cleaned;
		}
		return null;
	}

	private static playlistFromMusicUrl(url?: string | null): string | null {
		if (!url) return null;
		try {
			const list = new URL(url).searchParams.get("list")?.trim();
			return list && YtmdLink.playlistIdRe.test(list) ? list : null;
		} catch {
			return null;
		}
	}

	private static unquote(value: string): string {
		const t = value.trim();
		if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
			return t.slice(1, -1).trim();
		}
		return t;
	}
}
