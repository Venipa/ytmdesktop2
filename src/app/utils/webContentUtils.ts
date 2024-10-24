import { BrowserWindow, Rectangle, WebContents, WebContentsView } from "electron";
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

    const handleResize = (_ev: any, { width, height }: Rectangle) => {
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
      return handleResize(null, win.getContentBounds())
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
export function callWindowListeners(win: BrowserWindow, eventName: string, ...args: any[]) {
  return win.listeners(eventName).forEach(caller => caller(null, ...args));
}
export function getWindowFromContents(win: WebContents) {
  return BrowserWindow.fromWebContents(win);
}