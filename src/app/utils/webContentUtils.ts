import { WebContents } from "electron";
import { render } from "sass";
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
  webContents: WebContents,
  scssFile: string
) {
  const css = await new Promise<string>((resolve, reject) => {
    render({ file: scssFile, outputStyle: "compressed" }, (err, result) => {
      if (err) reject(err);
      resolve(result ? result.css.toString() : null);
    });
  }).catch(() => null);
  await webContents.executeJavaScript(
    `initializeYoutubeCustomCSS({ customCss: \`${css || ""}\` })`
  );
}
export async function rootWindowClearCustomCss(webContents: WebContents) {
  await webContents.executeJavaScript(
    `initializeYoutubeCustomCSS({ customCss: "" })`
  );
}
