import { BrowserWindow, WebContents } from "electron";
import { render } from "sass";
// @ts-ignore
import youtubeInjectScript from "!raw-loader!../../youtube-inject.js";

export async function rootWindowInjectUtils(webContents: WebContents, data?: {[key: string]: any}) {
  await webContents.executeJavaScript(youtubeInjectScript);
  await webContents.executeJavaScript(`window.__ytd_window_data = ${data ? JSON.stringify(data) : 'null'};`);
  await webContents.executeJavaScript(`initializeYoutubeDesktop()`);
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
