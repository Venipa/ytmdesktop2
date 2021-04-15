import { BrowserWindow } from "electron";
import { render } from "sass";
// @ts-ignore
import youtubeInjectScript from "!raw-loader!../../youtube-inject.js";
import Logger from "@/utils/Logger";

const log = new Logger("InjectUtils");
export async function rootWindowInjectUtils(win: BrowserWindow) {
  // Inject css
  const css = await import(
    // @ts-ignore
    "!raw-loader!sass-loader!../../assets/youtube-inject.scss"
  );
  if (!css) log.error("ytd2-css", "failed to load css");
  await win.webContents.executeJavaScript(
    `${youtubeInjectScript}
    initializeYoutubeDesktop({
      customCss: \`${css.default}\`
    })
    `
  );
}
export async function rootWindowInjectCustomCss(
  win: BrowserWindow,
  scssFile: string
) {
  const css = await new Promise<string>((resolve, reject) => {
    render({ file: scssFile, outputStyle: "compressed" }, (err, result) => {
      if (err) reject(err);
      resolve(result ? result.css.toString() : null);
    });
  }).catch(() => null);
  await win.webContents.executeJavaScript(
    `initializeYoutubeCustomCSS({ customCss: \`${css || ""}\` })`
  );
}
