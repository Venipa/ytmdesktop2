/**
 * @type {import("electron-builder").Configuration} builderOptions
 */
const builderOptions = {
  publish: ["github"],
  appId: "net.venipa.ytmdesktop",
  productName: "Youtube Music for Desktop",
  mac: {
    category: "public.app-category.music",
    icon: "src/assets/build_resources/mac/icon.icns",
  },
  dmg: {
    icon: "src/assets/build_resources/mac/icon.icns",
    title: "Install/Update ${productName} ${version}",
  },
  linux: {
    target: ["AppImage"],
    category: "Music",
  },
  squirrelWindows: null,
  nsis: {
    installerIcon: "src/assets/logo.ico",
    deleteAppDataOnUninstall: true,
  },
  win: {
    icon: "src/assets/build_resources/win/icon.ico",
  },
};
/**
 * @type {import('electron-builder').AfterPackContext} electronBuilder
 */
const electronBuilder = {
  chainWebpackMainProcess: (config) => {},
  mainProcessTypeChecking: false,
  preload: {
    preload: "src/preload.js",
    toolbar: "src/toolbar.js",
  },
  nodeIntegration: false,
  builderOptions,
  externals: ['chokidar'],
  nodeModulesPath: ['./node_modules']
};
module.exports = {
  pluginOptions: {
    electronBuilder,
  },
  chainWebpack: (config) => {
    config.module
      .rule("raw")
      .test(() => false)
      .use("raw-loader")
      .loader("raw-loader")
      .end();

    const svgRule = config.module.rule("svg");

    svgRule.uses.clear();

    svgRule
      .use("vue-loader")
      .loader("vue-loader-v16") // or `vue-loader-v16` if you are using a preview support of Vue 3 in Vue CLI
      .end()
      .use("vue-svg-loader")
      .loader("vue-svg-loader");
  },
  configureWebpack: {
    devtool: "inline-source-map",
  },
};
