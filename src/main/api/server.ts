import { isDevelopment } from "@main/infra/devUtils";
import type { SettingsStore } from "@main/trpc/routers/settings/service";
import { TrackData } from "@shared/track/trackData";
import { createLogger } from "@shared/utils/console";
import createApp, { json, Router } from "express";
import expressWs from "express-ws";
import type { Server } from "http";

const log = createLogger("api-server");
const DEFAULT_API_PORT = 13091;

export type ApiRequestHandler = (name: string, data?: unknown) => Promise<unknown>;

export interface ApiServerHandle {
	port: number;
	send(name: string, ...args: unknown[]): void;
	destroy(): Promise<void>;
}

function resolveApiPort(config: SettingsStore): number {
	const raw = config?.api?.port;
	const port = typeof raw === "number" ? raw : Number(raw);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		log.warn(`invalid api.port=${String(raw)}, falling back to ${DEFAULT_API_PORT}`);
		return DEFAULT_API_PORT;
	}
	return port;
}

/**
 * Local HTTP/WS API — runs in the Electron main process.
 * (worker_threads + asar packaging was silently failing in production builds)
 */
export async function startApiServer(options: {
	config: SettingsStore;
	routes: string[];
	onRequest: ApiRequestHandler;
}): Promise<ApiServerHandle> {
	const { config, routes, onRequest } = options;
	const { app, getWss } = expressWs(createApp());
	const router = Router() as expressWs.Router;
	const serverPort = resolveApiPort(config);

	app.use((req, res, next) => {
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
		next();
	});

	router.ws("/", (_ws) => {
		log.debug("socket", _ws.readyState);
		if (isDevelopment) {
			_ws.on("unexpected-response", log.debug.bind(log));
			_ws.on("error", log.error.bind(log));
		}
		_ws.on("open", async () => {
			const track = (await onRequest("api/track")) as TrackData | null;
			if (track) {
				_ws.send(JSON.stringify({ event: "track:change", data: [{ ...track }] }), { binary: false });
			} else {
				_ws.send(null, { binary: false });
			}
		});
	});
	router.ws("/ping", (s) => {
		s.on("message", () => s.send("Pong!"));
	});

	app.use(json());
	app.use("/socket", router);

	app.get("/", (_req, res) => {
		try {
			res.json({
				name: "YTMDesktop2 Api",
				beta: config?.app?.beta,
				player: config?.player,
				routes,
			});
		} catch (err) {
			res.status(500).json(err);
		}
	});

	app.get("/track", async (_req, res) => {
		res.json((await onRequest("api/track")) ?? null);
	});

	app.get("/track/state", async (_req, res) => {
		res.json((await onRequest("api/track/state")) ?? null);
	});

	app.post("/track/*", async (req, res) => {
		const operation = "api/" + req.path.replace(/^\//g, "");
		try {
			res.json(await onRequest(operation, req.body));
		} catch (ex) {
			res.status(500).json({ error: `failed to do requested operation (${operation})` });
			log.error(ex);
		}
	});

	let server: Server | undefined;
	await new Promise<void>((resolve, reject) => {
		server = app.listen(serverPort);
		const onError = (err: Error) => {
			server?.off("listening", onListening);
			log.error("api listen failed", err);
			reject(err);
		};
		const onListening = () => {
			server?.off("error", onError);
			resolve();
		};
		server.once("error", onError);
		server.once("listening", onListening);
	});

	log.debug(`listening on port ${serverPort}`);

	return {
		port: serverPort,
		send(name: string, ...args: unknown[]) {
			const data = JSON.stringify({ event: name, data: [...args] });
			getWss().clients.forEach((x) => x.send(data, { binary: false }));
		},
		async destroy() {
			const active = server;
			server = undefined;
			if (!active) return;
			await new Promise<void>((resolve) => {
				active.close((err) => {
					if (err) log.error("failed to destroy api server", err);
					resolve();
				});
			});
		},
	};
}
