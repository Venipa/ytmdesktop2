import { RouteRecordRaw } from "vue-router";

const routes: Partial<RouteRecordRaw>[] = [
  {
    path: "/youtube/toolbar",
    component: () => import("./toolbar.vue"),
  },
  {
    path: "/youtube/loading",
    component: () => import("./loading.vue"),
  },
];
export default routes;
