import { isDevelopment } from '@/app/utils/devUtils';
import { TrackData } from '@/app/utils/trackData';
import logger from '@/utils/Logger';
import { ipcRenderer } from 'electron';
import createApp, { Router } from 'express';
import expressWs from 'express-ws';

import { apiChannelName } from './apiWorkerHelper';

import type { SettingsStore } from "@/app/plugins/settingsProvider.plugin";
import { Server } from 'http';
const {app, getWss} = expressWs(createApp());
let appConfig: SettingsStore;
const log = logger.child("api-server");
const router = Router() as expressWs.Router;
router.ws("/", (_ws, _req) => {
  log.debug("socket", _ws.readyState);
  if (isDevelopment) {
    _ws.on("message", log.debug.bind(log));
    _ws.on("unexpected-response", log.debug.bind(log));
    _ws.on("error", log.debug.bind(log));
  }
  _ws.on("open", async () => {
    const track: TrackData = await ipcRenderer.invoke("api/track");
    if (track)
    {
      
  const data = JSON.stringify({
    event: "track:change",
    data: [{...track}]
  });
  _ws.send(data, {binary: false})
    } else {
      const data = null
      _ws.send(data, {binary: false})
    };
  })
});
router.ws("/ping", (s, _req) => {
  s.on("message", () => s.send("Pong!"));
});
app.use("/socket", router);
app.get("/", async (req, res) => {
  try {
    
  const availableEvents: string[] = await ipcRenderer.invoke("api/routes");
  res.json({
    name: "YTMDesktop2 Api",
    beta: appConfig?.app.beta,
    player: appConfig?.player,
    routes: availableEvents
  })
  } catch(err) {
    res.status(500).json(err);
  }
})
app.get("/track", async (req, res) => {
  const track = await ipcRenderer.invoke("api/track");
  res.json(track);
})
app.post("/track/*", async (req, res) => {
  const track = await ipcRenderer.invoke("api/" + req.path.replace(/^\//g, ""));
  res.json(track);
})
app.on("error", log.error);
const initialize = async ({config}: {config: SettingsStore}) => {
  appConfig = config;
  const serverPort = config.api.port;
  let server: Server;
  await new Promise<void>((resolve) => server = app.listen(serverPort, () => {
    return resolve();
  }));
  log.debug(`${app.settings} - listening on ${serverPort}, state: ${server.listening ? 'active' : 'listening failed'}`);
  log.debug("routes: ", [app.routes]);
  return process.pid;
}
const close = async () => {}
const sendMessage = async (name: string, ...args: any[]) => {
  const { clients } = getWss();
  const data = JSON.stringify({
    event: name,
    data: [...args]
  });
  clients.forEach(x => x.send(data, {binary: false}));
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