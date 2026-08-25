import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { i18n } from "./i18n";
import "./assets/main.css";

createApp(App).use(createPinia()).use(i18n).mount("#app");

// 阻止浏览器环境下的系统级文件拖放导航
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
