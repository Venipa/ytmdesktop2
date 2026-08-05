import { type ServerType, serve, upgradeWebSocket } from "@hono/node-server";
import { isDevelopment } from "@main/infra/devUtils";
import type { SettingsStore } from "@main/trpc/routers/settings/service";
import type { TrackData } from "@shared/track/trackData";
import { createLogger } from "@shared/utils/console";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { WSContext } from "hono/ws";
import { WebSocketServer } from "ws";

const log = createLogger("api-server");
const DEFAULT_API_PORT = 13091;
const MIN_PORT = 9999;
const MAX_PORT = 39999;
export type ApiRequestHandler = (name: string, data?: unknown) => Promise<unknown>;

export interface ApiServerHandle {
	port: number;
	send(name: string, ...args: unknown[]): void;
	destroy(): Promise<void>;
}
const isValidPort = (port: number): boolean => {
	return port >= MIN_PORT && port <= MAX_PORT;
}

function resolveApiPort(config: SettingsStore): number {
	const raw = config?.api?.port;
	const port = typeof raw === "number" ? raw : Number(raw);
	if (!Number.isInteger(port) || !isValidPort(port)) {
		log.warn(`invalid api.port=${String(raw)}, falling back to ${DEFAULT_API_PORT}`);
		return DEFAULT_API_PORT;
	}
	return port;
}

/**
 * Local HTTP/WS API — Hono + @hono/node-server (bundled into main; keeps `ws` for Node upgrades).
 */
export async function startApiServer(options: {
	config: SettingsStore;
	routes: string[];
	onRequest: ApiRequestHandler;
}): Promise<ApiServerHandle> {
	const { config, routes, onRequest } = options;
	const serverPort = resolveApiPort(config);
	const trackClients = new Set<WSContext>();

	const app = new Hono();

	// Skip CORS on WS upgrade — Hono WS mutates headers and CORS can conflict
	app.use("*", async (c, next) => {
		if (c.req.header("upgrade")?.toLowerCase() === "websocket") return next();
		return cors({
			origin: "*",
			allowHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept"],
			allowMethods: ["GET", "POST", "OPTIONS"],
		})(c, next);
	});

	app.get("/", (c) =>
		c.json({
			name: "YTMDesktop2 Api",
			beta: config?.app?.beta,
			player: config?.player,
			routes,
		}),
	);

	app.get("/track", async (c) => c.json((await onRequest("api/track")) ?? null));
	app.get("/track/state", async (c) => c.json((await onRequest("api/track/state")) ?? null));

	app.post("/track/*", async (c) => {
		const operation = `api${c.req.path}`;
		try {
			const body = await c.req.json().catch(() => undefined);
			return c.json(await onRequest(operation, body));
		} catch (err) {
			log.error(err);
			return c.json({ error: `failed to do requested operation (${operation})` }, 500);
		}
	});

	app.get(
		"/socket",
		upgradeWebSocket(() => ({
			onOpen(_event, ws) {
				trackClients.add(ws);
				log.debug("socket open", trackClients.size);
				void (async () => {
					try {
						const track = (await onRequest("api/track")) as TrackData | null;
						if (track) {
							ws.send(JSON.stringify({ event: "track:change", data: [{ ...track }] }));
						} else {
							ws.send("null");
						}
					} catch (err) {
						log.error("socket open track push failed", err);
					}
				})();
			},
			onClose(_event, ws) {
				trackClients.delete(ws);
			},
			onError(event) {
				if (isDevelopment) log.error("socket error", event);
			},
		})),
	);

	app.get(
		"/socket/ping",
		upgradeWebSocket(() => ({
			onMessage(_event, ws) {
				ws.send("Pong!");
			},
		})),
	);

	app.notFound((c) => c.json({ error: "not found" }, 404));
	app.onError((err, c) => {
		log.error(err);
		return c.json({ error: "internal error" }, 500);
	});

	const wss = new WebSocketServer({ noServer: true });
	let server: ServerType | undefined;

	await new Promise<void>((resolve, reject) => {
		try {
			server = serve(
				{
					fetch: app.fetch,
					port: serverPort,
					websocket: { server: wss },
				},
				(info) => {
					log.debug(`listening on port ${info.port}`);
					resolve();
				},
			);
			server.once("error", (err) => {
				log.error("api listen failed", err);
				reject(err);
			});
		} catch (err) {
			reject(err);
		}
	});

	return {
		port: serverPort,
		send(name: string, ...args: unknown[]) {
			const data = JSON.stringify({ event: name, data: [...args] });
			for (const client of trackClients) {
				try {
					client.send(data);
				} catch (err) {
					log.error("ws broadcast failed", err);
				}
			}
		},
		async destroy() {
			for (const client of [...trackClients]) {
				try {
					client.close();
				} catch {
					/* ignore */
				}
			}
			trackClients.clear();

			for (const client of wss.clients) {
				try {
					client.terminate();
				} catch {
					/* ignore */
				}
			}

			await new Promise<void>((resolve) => wss.close(() => resolve()));

			const active = server;
			server = undefined;
			if (!active) return;

			await new Promise<void>((resolve) => {
				active.close((err) => {
					if (err) log.error("failed to destroy api server", err);
					resolve();
				});
			});
			log.debug("api server destroyed");
		},
	};
}
