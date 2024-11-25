// electron.vite.config.ts
import vue from "@vitejs/plugin-vue";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { merge } from "lodash-es";
import { resolve } from "path";
import svgLoader from "vite-svg-loader";
var __electron_vite_injected_dirname = "E:\\git\\ytmdesktop2";
var resolveOptions = {
  resolve: {
    alias: {
      "@renderer": resolve("src/renderer/src"),
      "@main": resolve("src/main"),
      "@preload": resolve("src/preload"),
      "@shared": resolve("src/shared"),
      "@translations": resolve("src/translations"),
      "@": resolve("src"),
      "~": resolve(".")
    }
  }
};
var externalizedEsmDeps = ["lodash-es", "@faker-js/faker", "@trpc-limiter/memory", "got", "encryption.js"];
var electron_vite_config_default = defineConfig({
  main: {
    ...resolveOptions,
    plugins: [externalizeDepsPlugin({ exclude: [...externalizedEsmDeps] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/main/main.ts")
        },
        output: {
          manualChunks: (id) => {
            if (externalizedEsmDeps.find((d) => d === id)) return id;
          }
        }
      }
    }
  },
  preload: {
    ...resolveOptions,
    plugins: [externalizeDepsPlugin({ exclude: [...externalizedEsmDeps] })],
    build: {
      rollupOptions: {
        input: {
          "youtube": resolve(__electron_vite_injected_dirname, "src/preload/youtube.ts"),
          "api": resolve(__electron_vite_injected_dirname, "src/preload/api.ts"),
          "login": resolve(__electron_vite_injected_dirname, "src/preload/login.ts")
        }
      }
    }
  },
  renderer: {
    ...merge({}, resolveOptions, {
      resolve: {
        alias: {
          "@": resolve(__electron_vite_injected_dirname, "src/renderer/src")
        }
      }
    }),
    plugins: [
      // (TanStackRouterVite as typeof TanStackRouterViteType)({
      //   generatedRouteTree: resolve('./src/renderer/src/routeTree.gen.ts'),
      //   routesDirectory: resolve('./src/renderer/src/routes')
      // }),
      vue(),
      svgLoader()
    ]
  }
});
export {
  electron_vite_config_default as default
};
