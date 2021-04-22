import { BrowserView, BrowserWindow } from "electron";

export interface BrowserWindowViews<T> {
  main: BrowserWindow;
  views: { [key: string]: BrowserView } & T;
}

export function getViewObject(bwv: { [key: string]: BrowserView }) {
  return Object.entries(bwv)
    .map(([key, view]) => ({ id: view.webContents.id, name: key }))
    .reduce((l, r) => ({ ...l, [r.name]: r.id }), {});
}
