import { BrowserWindow, WebContentsView } from "electron";

export interface BrowserWindowViews<T, TView extends WebContentsView = WebContentsView> {
  main: BrowserWindow;
  views: { [key: string]: TView } & T;
  sendToAllViews(ev: string, ...args: any[]): void;
}

export function getViewObject(bwv: { [key: string]: WebContentsView }) {
  if (!bwv) return {};
  return Object.entries(bwv)
    .filter(([, view]) => view?.webContents)
    .map(([key, view]) => ({ id: view.webContents.id, name: key }))
    .reduce((l, r) => ({ ...l, [r.name]: r.id }), {});
}
export function createWindowContext<T, TView extends WebContentsView = WebContentsView>(_data: {
  main: BrowserWindow;
  views: { [key: string]: TView } & T;
}): BrowserWindowViews<T, TView> {
  return new (class implements BrowserWindowViews<T, TView> {
    main: BrowserWindow = _data.main;
    views: { [key: string]: TView } & T = _data.views || ({} as any);
    sendToAllViews(ev: string, ...args: any[]): void {
      return (Object.values(this.views) as TView[])
        .filter(
          (x) =>
            x &&
            (x instanceof BrowserWindow
              ? !x.isDestroyed() && !x.webContents.isDestroyed()
              : x.webContents && !x.webContents.isDestroyed()),
        )
        .forEach((x: TView) => {
          try {
            x.webContents.send(ev, ...args);
          } catch (ex) {
            console.error({
              error: ex,
              disposed: x.webContents.isDestroyed(),
            });
          }
        });
    }
  })();
}
