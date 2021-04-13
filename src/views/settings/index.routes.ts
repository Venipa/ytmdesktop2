import { RouteRecordRaw } from "vue-router";

/**
 * @type {RouteRecordRaw} routes
 */
const routes = {
  path: "/",
  component: () => import("./index.vue"),
  children: [
    {
      path: "/",
      component: () => import("./generic-settings.vue"),
    },
    {
      path: "/discord",
      component: () => import("./discord-settings.vue"),
    },
    {
      path: "/custom-css",
      component: () => import("./customcss-settings.vue"),
    },
    {
      path: "/about",
      component: () => import("./about-settings.vue"),
    },
  ],
};

export default routes;
