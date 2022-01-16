import { isDevelopment } from '@/app/utils/devUtils';
import logger from '@/utils/Logger';
import { ipcRenderer } from 'electron';
import createApp, {Router} from 'express';
import expressWs from 'express-ws';
import { createServer } from 'http';

import { apiChannelName } from './apiWorkerHelper';

import type { SettingsStore } from "@/app/plugins/settingsProvider.plugin";
const {app, getWss} = expressWs(createApp());
// Pass a http.Server instance to the listen method
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
});
router.ws("/ping", (s, _req) => {
  s.on("message", () => s.send("Pong!"));
});
app.use("/socket", router);
app.get("/", (req, res) => {
  res.json({
    name: "YTMDesktop2 Api",
    beta: appConfig?.app.beta,
    player: appConfig?.player
  })
})
app.on("error", log.error);
const initialize = async ({config}: {config: SettingsStore}) => {
  appConfig = config;
  const serverPort = config.api.port;
  app.listen(serverPort);
  log.debug(`${app.settings} - listening on ${serverPort}`)
  log.debug("routes: ", [app.routes]);
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