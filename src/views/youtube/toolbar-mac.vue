<template>
  <div class="h-full overflow-hidden">
    <div class="flex items-stretch justify-between border-b bg-black border-gray-600 select-none h-10 px-2 space-x-2">
      <div class="flex items-center flex-1 drag space-x-2 appear">
        <div class="flex-none w-16"></div>
        <div class="text-xs bg-primary h-7 rounded items-center px-3 bg-opacity-50 appear flex truncate" v-if="title">
          <span class="truncate overflow-ellipsis">{{ title }}</span>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <div @click="onSettings" class="control-button">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="w-px h-6 bg-gray-600"></div>
        <div class="flex items-center space-x-1">
          <div @click="onClose" class="control-button control-button-danger">
            <CloseIcon />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref } from "vue";
import CloseIcon from "@/assets/icons/close.svg";

const title = ref(),
  appVersion = ref(window.api.version);
export default defineComponent({
  components: {
    CloseIcon,
  },
  setup() {
    return {
      title,
      appVersion,
    };
  },
  beforeRouteLeave() {
    return;
  },
  methods: {
    onClose() {
      window.api.quit();
    },
    onSettings() {
      window.api.settings.open();
    },
  },
  created() {
    window.ipcRenderer.on("track:title", (ev, title) => {
      this.title = null;
      if (title) this.title = title;
    });
  },
});
</script>

<style lang="scss">
html,
body {
  @apply overflow-hidden;
}
</style>
