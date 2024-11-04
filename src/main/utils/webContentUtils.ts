import { is } from "@electron-toolkit/utils";
import { createLogger } from "@shared/utils/console";
import { BrowserWindow, WebContents, WebContentsView } from "electron";
import { debounce } from "lodash-es";
import { join } from "path";
import { filter, fromEvent, Subject, Subscription, takeWhile } from "rxjs";
import { compileAsync } from "sass";
import { defaultUri } from "./devUtils";
import { BrowserWindowViews } from "./mappedWindow";
const cssWindowIdMap: Record<string, string> = {};
export async function rootWindowInjectCustomCss(
  { webContents }: WebContentsView,
  scssFile: string,
) {
  const wid = String(webContents.id);
  if (cssWindowIdMap[wid]) await rootWindowClearCustomCss({ webContents } as WebContentsView);
  const css = await compileAsync(scssFile)
    .then((r) => r.css)
    .catch(() => null);
  if (css) cssWindowIdMap[wid] = await webContents.insertCSS(css);

  return true;
}
export async function rootWindowClearCustomCss({ webContents }: WebContentsView) {
  const wid = String(webContents.id);
  if (!cssWindowIdMap[wid]) return;
  await webContents.removeInsertedCSS(wid);
  delete cssWindowIdMap[wid];
}
export type LockSizeOptions = { resize: "both" | "width" | "height" };
export function lockSizeToParent(
  win: BrowserWindow,
  options: LockSizeOptions = { resize: "both" },
) {
  return (view: WebContentsView) => {
    const lockSides = options?.resize ?? "both";
    const handleResize = (_ev: any) => {
      const { width, height } = win.getContentBounds();
      const { x, y, width: viewWidth, height: viewHeight } = view.getBounds();
      const newWidth = width - x;
      const newHeight = height - y;
      view.setBounds({
        x,
        y,
        ...(lockSides !== "width" ? { height: newHeight } : { height: viewHeight }),
        ...(lockSides !== "height" ? { width: newWidth } : { width: viewWidth }),
      });
    };
    const handleStates = () => {
      return handleResize(null);
    };
    win.on("show", handleStates);
    win.on("will-resize", handleResize);
    win.on("maximize", handleStates);
    win.on("unmaximize", handleStates);
    win.once("close", () => {
      win.off("show", handleStates);
      win.off("will-resize", handleResize);
      win.off("maximize", handleStates);
      win.off("unmaximize", handleStates);
    });
  };
}
export function getWindowState(win: BrowserWindow) {
  if (!win || win.isDestroyed()) return null;
  const {
    maximizable,
    minimizable,
    movable,
    fullScreen,
    fullScreenable,
    menuBarVisible,
    id,
    resizable,
    title,
    closable,
  } = win;
  return {
    id,
    maximized: win.isMaximized(),
    minimized: win.isMinimized(),
    alwaysOnTop: win.isAlwaysOnTop(),
    closable,
    maximizable,
    minimizable,
    movable,
    resizable,
    menuBarVisible,
    fullScreen,
    fullScreenable,
    title,
    ...win.getBounds(),
  };
}
export function getWindowStateFromContext<T1 extends BrowserWindowViews<{ youtubeView: WebContentsView }> = BrowserWindowViews<{ youtubeView: WebContentsView }>>({
  main: win,
  views: { youtubeView },
}: T1 = {} as T1) {
  if (!win || win.isDestroyed()) return null;
  const {
    maximizable,
    minimizable,
    movable,
    fullScreen,
    fullScreenable,
    menuBarVisible,
    id,
    resizable,
    title,
    closable,
  } = win;
  const historyEntry =
    youtubeView &&
    youtubeView.webContents.navigationHistory.getEntryAtIndex(
      youtubeView.webContents.navigationHistory.getActiveIndex(),
    );
  return {
    id,
    maximized: win.isMaximized(),
    minimized: win.isMinimized(),
    alwaysOnTop: win.isAlwaysOnTop(),
    closable,
    maximizable,
    minimizable,
    movable,
    resizable,
    menuBarVisible,
    fullScreen,
    fullScreenable,
    title,
    ...win.getBounds(),
    navigation: historyEntry &&
      new URL(historyEntry.url).hostname === defaultUri.hostname && {
        canGoBack: youtubeView.webContents.navigationHistory.canGoBack(),
        index: youtubeView.webContents.navigationHistory.getActiveIndex(),
      },
  };
}
const manualSyncEmitter = new Subject<number>();
const handleManualPushLog = createLogger("manualSyncEmitter.push");
export const pushWindowStates = (contentsId?: number) => manualSyncEmitter.next(contentsId!);
export function syncWindowStateToWebContents(win: BrowserWindow) {
  let hidden = false;
  return (view: WebContents) => {
    const handles: Record<string, any[]> = {};
    const addHandle = (key: string | string[], h: any) => {
      [key].flat().forEach((k) => {
        if (!handles[k]) handles[k] = [];
        handles[k].push(h);
        win.on(k as any, h);
      });
      return h;
    };
    const handleManualPush = (contentsId?: number) => {
      handleManualPushLog.debug({contentsId},`pushing window state update for ${view.getTitle()}`);
      if (!contentsId) return handleStates();
      if (!view || view.isDestroyed() || view.id !== contentsId) return;
      return handleStates();
    };
    const handleStates = () => {
      if (hidden) return;
      const state = getWindowState(win);
      if (!state) view.send("windowState", state);
      else
        view.send(
          "windowState",
          Object.assign({}, state, {
            navigation: {
              canGoBack: view.navigationHistory.canGoBack(),
              index: view.navigationHistory.getActiveIndex(),
            },
          }),
        );
    };
    addHandle(["unmaximize", "maximize", "blur", "focus", "minimize", "show"], handleStates);
    addHandle(["will-resize"], debounce(handleStates, 50));
    addHandle("hide", () => (hidden = true));
    addHandle("restore", () => (hidden = false));
    const subs: Subscription[] = [];
    subs.push(
      fromEvent(view, "did-navigate-in-page").subscribe(handleStates),
      manualSyncEmitter.pipe(filter(x => x === view.id), takeWhile(() => view && !view.isDestroyed())).subscribe(() => {
        handleManualPushLog.debug("triggered: manual window state");
        handleStates()
      })
    )
    win.once("close", () => {
      Object.entries(handles).forEach(([k, h]) => {
        h.forEach((handle) => win.off(k as any, handle));
      });
      subs.forEach(s => !s.closed && s.unsubscribe())
    });

    return () => handleStates();
  };
}
export function callWindowListeners(win: BrowserWindow, eventName: string, ...args: any[]) {
  return win.listeners(eventName).forEach((caller) => caller(null, ...args));
}
export function getWindowFromContents(win: WebContents) {
  return BrowserWindow.fromWebContents(win);
}
export function getWindowFromContentsId(contentId: number) {
  return BrowserWindow.getAllWindows().find(
    (x) => x && !x.isDestroyed() && x.webContents.id === contentId,
  );
}
export const loadUrlOfWindow = (win: BrowserWindow, page?: string) => {
  const hashPath = page?.replace(/^(\#?\/?)/, "#/") || "#/";
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return win.loadURL(process.env['ELECTRON_RENDERER_URL'].replace(/\/?$/, hashPath));
  } else {
    const indexPath = join(__dirname, "../renderer/index.html");
    return win.loadFile(indexPath, { hash: hashPath });
  }
};
export const parseWindowUrl = (page?: string) => {
  const hashPath = page?.replace(/^(\#?\/?)/, "#/") || "#/";
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return process.env['ELECTRON_RENDERER_URL'].replace(/\/?$/, hashPath);
  } else {
    const indexPath = join(__dirname, "../renderer/index.html");
    return indexPath + hashPath;
  }
};
export const loadUrlOfWebContents = (win: WebContents, path?: string) => {
  const hashPath = path?.replace(/^(\#?\/?)/, "#/") || "#/";
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return win.loadURL(process.env['ELECTRON_RENDERER_URL'].replace(/\/?$/, hashPath));
  } else {
    const indexPath = join(__dirname, "../renderer/index.html");
    return win.loadFile(indexPath, { hash: hashPath });
  }
};
export { };
