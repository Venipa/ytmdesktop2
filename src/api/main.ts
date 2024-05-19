import type { SettingsStore } from "@/app/plugins/settingsProvider.plugin";
import { isDevelopment } from '@/app/utils/devUtils';
import { TrackData } from '@/app/utils/trackData';
import logger from '@/utils/Logger';
import { createAdaptorServer as serve } from "@hono/node-server";
import { ipcRenderer } from 'electron';
import { Router } from 'express';
import expressWs from 'express-ws';
import { Hono } from "hono";
import { hc } from "hono/client";
import { apiChannelName } from './apiWorkerHelper';

const c = hc()
const app = new Hono();
let appConfig: SettingsStore;
const log = logger.child("api-server");
const router = Router() as expressWs.Router;
app.use(async ({ res }, next) => {
  res.headers.set("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.headers.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  await next();
});
router.ws("/", (_ws, _req) => {
  log.debug("socket", _ws.readyState);
  if (isDevelopment) {
    _ws.on("message", log.debug.bind(log));
    _ws.on("unexpected-response", log.debug.bind(log));
    _ws.on("error", log.debug.bind(log));
  }
  _ws.on("open", async () => {
    const track: TrackData = await ipcRenderer.invoke("api/track");
    if (track) {

      const data = JSON.stringify({
        event: "track:change",
        data: [{ ...track }]
      });
      _ws.send(data, { binary: false })
    } else {
      const data = null
      _ws.send(data, { binary: false })
    };
  })
});
router.ws("/ping", (s, _req) => {
  s.on("message", () => s.send("Pong!"));
});
// app.use("/socket", upgrade);
app.get("/", async (res) => {
  try {

    const availableEvents: string[] = await ipcRenderer.invoke("api/routes");
    res.json({
      name: "YTMDesktop2 Api",
      beta: appConfig?.app.beta,
      player: appConfig?.player,
      routes: availableEvents
    })
  } catch (err) {
    res.status(500);
    res.json(err);
  }
})
app.get("/track", async (res) => {
  const track = await ipcRenderer.invoke("api/track");
  res.json(track);
})
app.post("/track/*", async ({ req, json: rjson }) => {
  const track = await ipcRenderer.invoke("api/" + req.path.replace(/^\//g, ""));
  rjson(track);
})
app.onError((err, c) => {
  log.error(err);
  return c.json(err, 500);
});
const initialize = async ({ config }: { config: SettingsStore }) => {
  appConfig = config;
  const serverPort = config.api.port;
  let server: ReturnType<typeof serve>;
  await new Promise<void>((resolve, reject) => {
    server = serve({ port: serverPort, fetch: app.fetch }).listen(serverPort);
    server.once("listening", resolve);
    server.once("error", (err) => {
      if (err && /^EADDR/.test(err.name)) reject(err);
      log.error("hono listening error ::", err);
    })
  });
  log.debug(`Hono - listening on ${serverPort}, state: ${server.listening ? 'active' : 'listening failed'}`);
  log.debug("routes: ", [app.routes]);
  return process.pid;
}
const close = async () => { }
const sendMessage = async (name: string, ...args: any[]) => {
  const { clients } = getWss();
  const data = JSON.stringify({
    event: name,
    data: [...args]
  });
  clients.forEach(x => x.send(data, { binary: false }));
}
const evName = apiChannelName;
const functionCollection = {
  close,
  initialize,
  socket: sendMessage
};
ipcRenderer.on(evName, (ev, eventName, ...args) => {
  log.child(eventName).debug(args);
  new Promise((resolve, reject) => {
    return Promise.resolve(functionCollection[eventName]?.(...args)).then(resolve).catch(reject)
  }).then((response) => ipcRenderer.send(`${evName}/${eventName}`, response));
})