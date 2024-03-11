const path = require("path");
const webpackNodeExternals = require("webpack-node-externals");

/**
 * @type {import("electron-builder").Configuration} builderOptions
 */
const builderOptions = {
  publish: ["github"],
  appId: "net.venipa.ytmdesktop",
  productName: "YouTube Music for Desktop",
  artifactName: "${productName}-${version}_${arch}.${ext}",
  extraMetadata: {
    name: "YouTube Music for Desktop",
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
    target: [{ target: "nsis", arch: ["x64"] }, { target: "nsis", arch: ["arm64"] }],

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
  },
  configureWebpack: {
    devtool: "source-map",
  },
};
