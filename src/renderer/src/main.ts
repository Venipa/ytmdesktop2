import "non.geist";
import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import "./assets/app.scss";

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
          path: "/player",
          component: () => import("./views/settings/player-settings.vue"),
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
          path: "/integrations",
          component: () => import("./views/settings/integration-settings.vue"),
        },
        {
          path: "/about",
          component: () => import("./views/settings/about-settings.vue"),
        },
      ],
    },
    {
      path: "/miniplayer",
      component: () => import("./views/mini-player/index.vue"),
    },
    {
      path: "/taskview",
      component: () => import("./views/task-view/index.vue"),
    },
    {
      path: "/youtube/toolbar",
      component: () => import("./views/youtube/toolbar.vue"),
    },
    {
      path: "/youtube/login-notice",
      component: () => import("./views/youtube/login-notice.vue"),
    },
    {
      path: "/youtube/toolbar-mac",
      component: () => import("./views/youtube/toolbar-mac.vue"),
    },
    {
      path: "/youtube/loading",
      component: () => import("./views/youtube/loading.vue"),
    },
  ],
});
console.log({ router });
createApp(App)
  .use(router)
  .use((app) => {
    app.config.globalProperties.window = window;
    app.config.globalProperties.console = console;
    app.config.globalProperties.api = window.api;
    app.config.globalProperties.translations = window.translations;
    console.log(app.config.globalProperties);
    return app;
  })
  .mount("#app");
