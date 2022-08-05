const path = require("path");
const webpackNodeExternals = require("webpack-node-externals");

/**
 * @type {import("electron-builder").Configuration} builderOptions
 */
const builderOptions = {
  publish: ["github"],
  appId: "net.venipa.ytmdesktop",
  productName: "YouTube Music for Desktop",
  extraMetadata: {
    name: "YouTube Music for Desktop",
  },
  mac: {
    category: "public.app-category.music",
    icon: "src/assets/icons/mac/icon.icns",
    target: {
      target: "default",
      arch: ["arm64", "x64"],
    },
  },
  dmg: {
    icon: "src/assets/icons/mac/icon.icns",
    title: "Install/Update ${productName} ${version}",
  },
  linux: {
    target: ["AppImage"],
    category: "Music",
    icon: "src/assets/icons/mac/icon.icns",
  },
  squirrelWindows: null,
  nsis: {
    installerIcon: "src/assets/icons/win/icon.ico",
    deleteAppDataOnUninstall: true,
  },
  win: {
    icon: "src/assets/icons/win/icon.ico",
    target: {
      target: "default",
      arch: ["x64", "ia32"],
    },
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
