import { createApp } from "vue";
import App from "./App.vue";
import "./assets/app.css";
import "./assets/tailwind.css";

const app = createApp(App).mount("#app");

console.log(app);
