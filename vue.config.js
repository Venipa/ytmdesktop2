const path = require("path");
const webpackNodeExternals = require("webpack-node-externals");
const webpack = require("webpack");
const isVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const appVersion = process.env.APP_VERSION && isVersion.test(process.env.APP_VERSION) && process.env.APP_VERSION || undefined;
if (appVersion) console.log("using custom app version", appVersion)

/**
 * @type {import("electron-builder").Configuration} builderOptions
 */
const builderOptions = {
  publish: ["github"],
  appId: "net.venipa.ytmdesktop",
  productName: "YouTube Music for Desktop",
  extraMetadata: {
    name: "YouTube Music for Desktop",
    ...(appVersion ? { version: appVersion } : {})
  },
  mac: {
    category: "public.app-category.music",
    icon: "src/assets/icons/mac/icon.icns",
    target: [
      { target: "dmg", arch: "x64" },
      { target: "dmg", arch: "arm64" }
    ]
  },
  dmg: {
    icon: "src/assets/icons/mac/icon.icns",
    title: "Install/Update ${productName} ${version}",
  },
  linux: {
    target: [{ target: "AppImage", arch: "x64" }, { target: "AppImage", arch: "arm64" }],
    category: "Music",
    icon: "src/assets/icons/mac/icon.icns",
  },
  squirrelWindows: null,
  nsis: {
    installerIcon: "src/assets/icons/win/icon.ico",
    installerHeaderIcon: "src/assets/icons/win/icon.ico",
    deleteAppDataOnUninstall: true,
  },
  win: {
    icon: "src/assets/icons/win/icon.ico",
    target: { target: "nsis", arch: "x64" },

    compression: "maximum"
  },
};
/**
 * @type {import('electron-builder').AfterPackContext} electronBuilder
 */
const electronBuilder = {
  mainProcessTypeChecking: false,
  preload: {
    "preload-yt": "src/preload/youtube.ts",
    "preload-api": "src/preload/api.ts",
    "preload-login": "src/preload/login.ts",
    api: "src/api/main.ts",
  },
  nodeIntegration: false,
  builderOptions,
  externals: [
    "chokidar",
    "xosms",
    "express",
    "express-ws",
    ...Array.from(webpackNodeExternals()),
  ],
  nodeModulesPath: ["./node_modules"],
};
// const TsConfigPaths = require("tsconfig-paths-webpack-plugin").default;
// const tsConfigAliasMapping = Object.entries(tsconfig.compilerOptions.paths).map(([alias, paths]) => {
//   return [alias.split("/*", 2)[0], path.resolve(__dirname, paths[0].split("/*", 2)[0])];
// });
/**
 * @type {import('@vue/cli-service').ProjectOptions}
 */
module.exports = {
  pluginOptions: {
    electronBuilder,
  },
  chainWebpack: (config) => {
    // tsConfigAliasMapping.forEach(([alias, path]) => config.resolve.alias.set(alias, path));
    // config.resolve.plugin("tsconfig-paths").use(new TsConfigPaths());
    config.module
      .rule("raw")
      .test(() => false)
      .use("raw-loader")
      .loader("raw-loader")
      .end();

    config.module.rules.delete("svg");
    config.module
      .rule("svg")
      .test(/\.(svg)(\?.*)?$/)
      .use("vue-loader")
      .loader("vue-loader")
      .end()
      .use("vue-svg-loader")
      .loader("vue-svg-loader");
    console.log({ config: config.toConfig().devtool })
  },
  configureWebpack: {
    devtool: false
  }
};
