import { BrowserWindow, WebContents, WebContentsView } from "electron";
import { debounce } from "lodash-es";
import { compileAsync } from "sass";
const cssWindowIdMap: Record<string, string> = {}
export async function rootWindowInjectCustomCss(
  { webContents }: WebContentsView,
  scssFile: string
) {
  const wid = String(webContents.id);
  if (cssWindowIdMap[wid]) await rootWindowClearCustomCss({ webContents } as WebContentsView);
  const css = await compileAsync(scssFile).then(r => (r.css)).catch(() => null);
  if (css) cssWindowIdMap[wid] = await webContents.insertCSS(css)

  return true
}
export async function rootWindowClearCustomCss({ webContents }: WebContentsView) {
  const wid = String(webContents.id);
  if (!cssWindowIdMap[wid]) return;
  await webContents.removeInsertedCSS(wid)
  delete cssWindowIdMap[wid];
}
export type LockSizeOptions = { resize: "both" | "width" | "height" }
export function lockSizeToParent(win: BrowserWindow, options: LockSizeOptions = { resize: "both" }) {
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
        ...(lockSides !== "height" ? { width: newWidth } : { width: viewWidth })
      })
    }
    const handleStates = () => {
      return handleResize(null)
    }
    win.on("show", handleStates);
    win.on("will-resize", handleResize);
    win.on("maximize", handleStates);
    win.on("unmaximize", handleStates);
    win.once("close", () => {
      win.off("show", handleStates);
      win.off("will-resize", handleResize)
      win.off("maximize", handleStates);
      win.off("unmaximize", handleStates);
    })
  }
}
export function getWindowState(win: BrowserWindow) {
  if (!win || win.isDestroyed()) return null;
  const { maximizable, minimizable, movable, fullScreen, fullScreenable, menuBarVisible, id, resizable, title, closable } = win;
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
    ...win.getBounds()
  };
}
export function syncWindowStateToWebContents(win: BrowserWindow) {
  let hidden = false;
  return (view: WebContents) => {
    const handles: Record<string, any[]> = {};
    const addHandle = (key: string | string[], h: any) => {
      [key].flat().forEach(k => {
        if (!handles[k]) handles[k] = [];
        handles[k].push(h)
        win.on(k as any, h);
      })
      return h;
    }
    const handleStates = () => {
      if (hidden) return;
      view.send("windowState", getWindowState(win))
    }
    addHandle(["unmaximize", "maximize", "blur", "focus", "minimize", "show"], handleStates);
    addHandle(["will-resize"], debounce(handleStates, 50))
    addHandle("hide", () => hidden = true)
    addHandle("restore", () => hidden = false);
    win.once("close", () => {
      Object.entries(handles).forEach(([k, h]) => {
        h.forEach(handle => win.off(k as any, handle))
      })
    })

    return () => handleStates();
  }
}
export function callWindowListeners(win: BrowserWindow, eventName: string, ...args: any[]) {
  return win.listeners(eventName).forEach(caller => caller(null, ...args));
}
export function getWindowFromContents(win: WebContents) {
  return BrowserWindow.fromWebContents(win);
}
export function getWindowFromContentsId(contentId: number) {
  return BrowserWindow.getAllWindows().find(x => x && !x.isDestroyed() && x.webContents.id === contentId);
}