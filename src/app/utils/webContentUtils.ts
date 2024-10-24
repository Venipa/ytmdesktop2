import { BrowserWindow, Rectangle, WebContents, WebContentsView } from "electron";
import { compileAsync } from "sass";
// @ts-ignore
import youtubeInjectScript from "!raw-loader!../../youtube-inject.js";
import logger from "@/utils/Logger";
const log = logger.child({ moduleName: "rootWindowInject" });
export async function rootWindowInjectUtils(
  webContents: WebContents,
  data?: { [key: string]: any }
) {
  await webContents.executeJavaScript(youtubeInjectScript).catch((...args) => log.error('init', ...args));
  await webContents.executeJavaScript(
    `window.__ytd_window_data = ${data ? JSON.stringify(data) : "null"};`
  ).catch((...args) => log.error('init', ...args));
  await webContents.executeJavaScript(`initializeYoutubeDesktop()`).catch((...args) => log.error('init', ...args));
}
export async function rootWindowInjectCustomCss(
  { webContents }: WebContentsView,
  scssFile: string
) {
  const css = await compileAsync(scssFile).then(r => (r.css)).catch(() => null);
  await webContents.executeJavaScript(
    `initializeYoutubeCustomCSS({ customCss: \`${css || ""}\` })`
  );
}
export async function rootWindowClearCustomCss({ webContents }: WebContentsView) {
  await webContents.executeJavaScript(
    `initializeYoutubeCustomCSS({ customCss: "" })`
  );
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