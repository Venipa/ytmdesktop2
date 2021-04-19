/**
 * @type {import("electron-builder").Configuration} builderOptions
 */
const builderOptions = {
  publish: ["github"],
  squirrelWindows: null,
  nsis: {
    installerIcon: "src/assets/logo.ico",
    menuCategory: "Venipa",
  },
};

module.exports = {
  pluginOptions: {
    electronBuilder: {
      preload: {
        preload: "src/preload.js",
        toolbar: "src/toolbar.js",
      },
      nodeIntegration: false,
      builderOptions,
    },
  },
  chainWebpack: (config) => {
    config.module
      .rule("raw")
      .test(() => false)
      .use("raw-loader")
      .loader("raw-loader")
      .end();
    config.module
      .rule("svg")
      .test(() => /\.svg$/)
      .use("svg-inline-loader")
      .loader("svg-inline-loader")
      .end();
  },
  configureWebpack: {
    devtool: "source-map",
  },
};
