import { BrowserView, BrowserWindow } from "electron";

export interface BrowserWindowViews<T> {
  main: BrowserWindow;
  views: { [key: string]: BrowserView } & T;
  sendToAllViews(ev: string, ...args: any[]): void;
}

export function getViewObject(bwv: { [key: string]: BrowserView }) {
  return Object.entries(bwv)
    .filter(([, view]) => view?.webContents)
    .map(([key, view]) => ({ id: view.webContents.id, name: key }))
    .reduce((l, r) => ({ ...l, [r.name]: r.id }), {});
}
export function createWindowContext<T>(_data: {
  main: BrowserWindow;
  views: { [key: string]: BrowserView } & T;
}): BrowserWindowViews<T> {
  return new (class implements BrowserWindowViews<T> {
    main: BrowserWindow = _data.main;
    views: { [key: string]: BrowserView } & T = _data.views;
    sendToAllViews(ev: string, ...args: any[]): void {
      return (Object.values(this.views) as BrowserView[])
        .filter(
          (x) => x &&
            (x instanceof BrowserWindow
              ? !x.isDestroyed() && !x.webContents.isDestroyed()
              : !x.webContents.isDestroyed())
        )
        .forEach((x: BrowserView) => x.webContents.send(ev, ...args));
    }
  })();
}
