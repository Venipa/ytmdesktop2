import { contextBridge } from "electron";
import exposeData from "./preload";

Object.entries(exposeData).forEach(([key, endpoints]) => {

  contextBridge.exposeInMainWorld(key, endpoints);
});
