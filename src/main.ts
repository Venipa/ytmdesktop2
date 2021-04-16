import { createApp } from "vue";
import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import App from "./App.vue";
import "./assets/tailwind.scss";
import "./assets/app.scss";
import { merge } from "lodash-es";
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
  routes: loadRoutes(),
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
