<template>
  <div class="h-full overflow-hidden">
    <div class="flex items-stretch justify-between border-b bg-black border-gray-600 select-none h-10 px-2 space-x-2">
      <div class="flex items-center flex-1 drag space-x-2 appear">
        <div class="flex items-center space-x-1">
          <div class="text-xs label -mt-px flex-none">YouTube Music for Desktop</div>
          <div class="text-xs opacity-30 text-white" v-if="appVersion !== undefined">v{{ appVersion }}</div>
        </div>
        <div class="text-xs bg-primary h-7 rounded items-center px-3 bg-opacity-50 appear flex truncate" v-if="title">
          <span class="truncate overflow-ellipsis">{{ title }}</span>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <toolbar-options></toolbar-options>
        <div class="w-px h-6 bg-gray-600"></div>
        <div class="flex items-center space-x-1">
          <div @click="onMin" class="control-button">
            <MinIcon />
          </div>
          <div @click="onMax" class="control-button">
            <MaxIcon />
          </div>
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
import MaxIcon from "@/assets/icons/max-window.svg";
import MinIcon from "@/assets/icons/min-window.svg";
import ToolbarOptions from "./toolbar-options.vue";
import { refIpc } from "@/utils/Ipc";
const appVersion = ref(window.api.version);
export default defineComponent({
  components: {
    CloseIcon,
    MaxIcon,
    MinIcon,
    ToolbarOptions,
  },
  setup() {
    const [title] = refIpc("TRACK_TITLE_CHANGE", {
      ignoreUndefined: true,
      defaultValue: null
    });
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
    onMax() {
      window.api.maximize();
    },
    onMin() {
      window.api.minimize();
    },
  },
  created() {
  },
});
</script>

<style lang="scss">
html,
body {
  @apply overflow-hidden;
}
</style>
