module.exports = {
  pluginOptions: {
    electronBuilder: {
      preload: "src/preload.ts",
      nodeIntegration: false,
    },
  },
  chainWebpack: (config) => {
    config.module
      .rule("raw")
      .test(() => false)
      .use("raw-loader")
      .loader("raw-loader")
      .end();
  },
  configureWebpack: {
    devtool: "source-map",
  },
};
