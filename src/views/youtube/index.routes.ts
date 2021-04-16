import { RouteRecordRaw } from "vue-router";

/**
 * @type {RouteRecordRaw} routes
 */
const routes = {
  path: "/youtube/toolbar",
  component: () => import("./toolbar.vue")
};

export default routes;