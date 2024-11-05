import vue from "@vitejs/plugin-vue";
import { BytecodeOptions, bytecodePlugin, defineConfig, externalizeDepsPlugin } from "electron-vite";
import { merge } from "lodash-es";
import { resolve } from "path";
import { UserConfigExport } from "vite";
import svgLoader from 'vite-svg-loader';
const bytecodeOptions: BytecodeOptions = {
  transformArrowFunctions: false,
}
const resolveOptions: UserConfigExport = {
  resolve: {
    alias: {
      "@renderer": resolve("src/renderer/src"),
      "@main": resolve("src/main"),
      "@preload": resolve("src/preload"),
      "@shared": resolve("src/shared"),
      "@translations": resolve("src/translations"),
      "@": resolve("src"),
      "~": resolve("."),
    },
  },
};
const externalizedEsmDeps = ["lodash-es", "@faker-js/faker", "@trpc-limiter/memory", "got"];
export default defineConfig({
  main: {
    ...resolveOptions,
    plugins: [externalizeDepsPlugin({ exclude: [...externalizedEsmDeps] }), bytecodePlugin(bytecodeOptions)],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/main.ts"),
        },
        output: {
          manualChunks: (id: string): any => {
            if (externalizedEsmDeps.find((d) => d === id)) return id;
          },
        },
      },
    },
  },
  preload: {
    ...resolveOptions,
    plugins: [externalizeDepsPlugin({ exclude: [...externalizedEsmDeps] }), bytecodePlugin(bytecodeOptions)],
    build: {
      rollupOptions: {
        input: {
          "youtube": resolve(__dirname, "src/preload/youtube.ts"),
          "api": resolve(__dirname, "src/preload/api.ts"),
          "login": resolve(__dirname, "src/preload/login.ts"),
        },
      },
    },
  },
  renderer: {
    ...merge({}, resolveOptions, {
      resolve: {
        alias: {
          "@": resolve(__dirname, "src/renderer/src"),
        },
      },
    }),
    plugins: [
      // (TanStackRouterVite as typeof TanStackRouterViteType)({
      //   generatedRouteTree: resolve('./src/renderer/src/routeTree.gen.ts'),
      //   routesDirectory: resolve('./src/renderer/src/routes')
      // }),
      vue(),
      svgLoader()
    ],
  },
});
