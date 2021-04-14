import { BrowserWindow } from "electron";
import { render } from "sass";
// @ts-ignore
import youtubeInjectScript from "!raw-loader!../../youtube-inject.js";

export async function rootWindowInjectUtils(win: BrowserWindow) {
  // Inject css
  const css = await import(
    // @ts-ignore
    "!raw-loader!sass-loader!../../assets/youtube-inject.scss"
  );
  if (!css) console.error("ytd2-css", "failed to load css");
  console.log(
    "youtube-inject.js",
    await win.webContents.executeJavaScript(
      `${youtubeInjectScript}
    initializeYoutubeDesktop({
      customCss: \`${css.default}\`
    })
    `
    ),
    css.default
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
