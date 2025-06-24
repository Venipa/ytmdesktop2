import { isDevelopment } from "@main/utils/devUtils";
import { TrackData } from "@main/utils/trackData";
import { createId as cuid } from "@paralleldrive/cuid2";
import createApp, { json, Router } from "express";
import expressWs from "express-ws";

import EventEmitter from "events";
import { Server } from "http";
import type { SettingsStore } from "@main/services/settings.service";
import { createLogger } from "@shared/utils/console";
import { parentPort } from "worker_threads";
if (!parentPort) throw new Error("This module has been run as parent");
const { app, getWss } = expressWs(createApp());
let appConfig: SettingsStore;
let apiRoutes: string[] = [];
const log = createLogger("api-server");
const router = Router() as expressWs.Router;
const parentEvents = new EventEmitter();
const requestParent = <T = any>(name: string, data?: any) => {
	const requestId = cuid();
	return new Promise<T>((resolve, reject) => {
		let timeoutHandle: any;
		const handle = (result: any) => {
			resolve(result);
			if (timeoutHandle) clearTimeout(timeoutHandle);
		};
		parentEvents.once(requestId, handle);
		timeoutHandle = setTimeout(() => {
			if (timeoutHandle) clearTimeout(timeoutHandle);
			parentEvents.off(requestId, handle);
			reject(new Error("handle Timeout error"));
		}, 30e3);
		parentPort!.postMessage({ type: "operationOutput", value: { name, data, id: requestId } });
	});
};
app.use(function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});
router.ws("/", (_ws, _req) => {
	log.debug("socket", _ws.readyState);
	if (isDevelopment) {
		_ws.on("unexpected-response", log.debug.bind(log));
		_ws.on("error", log.error.bind(log));
	}
	_ws.on("open", async () => {
		const track: TrackData = await requestParent("api/track");
		if (track) {
			const data = JSON.stringify({
				event: "track:change",
				data: [{ ...track }],
			});
			_ws.send(data, { binary: false });
		} else {
			const data = null;
			_ws.send(data, { binary: false });
		}
	});
});
router.ws("/ping", (s, _req) => {
	s.on("message", () => s.send("Pong!"));
});
app.use(json());
app.use("/socket", router);
app.get("/", async (req, res) => {
	try {
		res.json({
			name: "YTMDesktop2 Api",
			beta: appConfig?.app.beta,
			player: appConfig?.player,
			routes: apiRoutes,
		});
	} catch (err) {
		res.status(500).json(err);
	}
});
app.get("/track", async (req, res) => {
	const track = await requestParent("api/track");

	res.json(track ?? null);
});
app.get("/track/state", async (req, res) => {
	const state = await requestParent("api/track/state");

	res.json(state ?? null);
});
app.post("/track/*", async (req, res) => {
	const operation = "api/" + req.path.replace(/^\//g, "");
	try {
		const operationResult = await requestParent(operation, req.body);
		res.json(operationResult);
	} catch (ex) {
		res.status(500).json({ error: `failed to do requested operation (${operation})` });
		log.error(ex);
	}
});
let server: Server;
const initialize = async ({ config, routes }: { config: SettingsStore; routes: string[] }) => {
	appConfig = config;
	const serverPort = config.api.port;
	apiRoutes = routes;
	await new Promise<void>(
		(resolve) =>
			(server = app.listen(serverPort, () => {
				return resolve();
			})),
	);
	log.debug(app.settings, `- listening on ${serverPort}, state: ${server.listening ? "active" : "listening failed"}`);
	log.debug("routes: ", [app.routes]);
	server.on("error", (err) => log.error(err));
	server.on("clientError", (err) => log.error(err));
	return process.pid;
};
const close = async () => {
	server.close((err) => {
		if (err) {
			log.error("failed to destroy api server", err);
		}
	});
};
const sendMessage = async (name: string, ...args: any[]) => {
	const { clients } = getWss();
	const data = JSON.stringify({
		event: name,
		data: [...args],
	});
	clients.forEach((x) => x.send(data, { binary: false }));
};
const functionCollection = {
	close,
	destroy: close,
	initialize,
	socket: sendMessage,
	event: (requestId: string, result?: any) => parentEvents.emit(requestId, result),
};
export default async function runCommand({
	name: eventName,
	data: args,
}: {
	name: string;
	data: any;
}) {
	if (eventName !== "socket") log.child(eventName).debug({ payload: args });
	if (!functionCollection[eventName]) throw new Error("Method not found in api worker");
	return await new Promise<any>((resolve, reject) => {
		try {
			return Promise.resolve(functionCollection[eventName]?.(...(args ?? []))).then(resolve);
		} catch (ex) {
			log.error(ex);
			reject(ex);
			return ex;
		}
	});
}
