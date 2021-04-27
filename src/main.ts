import { createApp } from "vue";
import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import App from "./App.vue";
import "./assets/tailwind.scss";
import "./assets/app.scss";

/**
 * @returns {RouteRecordRaw[]} routes
 */
function loadRoutes() {
  const context = require.context("./views", true, /routes.ts$/i);
  console.log(context.keys());
  return context
    .keys()
    .map(context)
    .map((m: any) => m.default);
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      component: () => import("./views/settings/index.vue"),
      children: [
        {
          path: "/",
          component: () => import("./views/settings/generic-settings.vue"),
        },
        {
          path: "/discord",
          component: () => import("./views/settings/discord-settings.vue"),
        },
        {
          path: "/custom-css",
          component: () => import("./views/settings/customcss-settings.vue"),
        },
        {
          path: "/about",
          component: () => import("./views/settings/about-settings.vue"),
        },
      ],
    },
    {
      path: "/youtube/toolbar",
      component: () => import("./views/youtube/toolbar.vue"),
    },
    {
      path: "/youtube/loading",
      component: () => import("./views/youtube/loading.vue"),
    },
  ],
});
createApp(App)
  .use(router)
  .use({
    install(app) {
      const context = require.context("./plugins", true, /.ts$/i);
      return context
        .keys()
        .map(context)
        .map((m: any) => m.default(app));
    },
  })
  .mount("#app");
