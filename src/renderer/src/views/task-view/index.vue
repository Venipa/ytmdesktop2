<template>
  <div
    class="h-full absolute inset-0 overflow-hidden bg-black flex flex-col"
    :style="{
      ...(accentColor && showWinBorder ? { border: `1px solid ${accentColor}` } : {}),
    }"
  >
    <div
      class="flex items-stretch justify-between border-b bg-black border-gray-600 select-none h-10 px-2"
    >
      <div class="flex-auto flex items-center px-2">
        <div class="text-sm">{{ translations.appName }}</div>
      </div>
      <div class="flex items-center space-x-2 flex-shrink-0">
        <slot name="divider">
          <div class="w-px h-6 bg-gray-600"></div>
        </slot>
        <div class="flex items-center space-x-1">
          <div class="control-button" @click="() => window.api.openWindow('settingsWindow')">
            <SettingsIcon />
          </div>
        </div>
      </div>
    </div>
    <div class="overflow-y-auto overflow-x-hidden">
      <div class="task-menu">
        <button class="task-menu-item">Test</button>
        <button class="task-menu-item">Test</button>
        <button class="task-menu-item">Test</button>
        <button class="task-menu-item" @click="() => api.quit(true)">
          <ExitIcon class="w-4 h-4" />
          <span>Exit App</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import type { TrackData } from "@main/utils/trackData";
import ExitIcon from "@renderer/assets/icons/close.svg";
import SettingsIcon from "@renderer/assets/icons/settings.svg";
import { refIpc } from "@shared/utils/Ipc";
import { defineComponent, ref } from "vue";
export default defineComponent({
  components: {
    SettingsIcon,
    ExitIcon,
  },
  setup() {
    const showWinBorder = ref(false);
    const accentColor = ref<string | null>("#a0a0a0"); // todo

    const [track, setTrack] = refIpc<TrackData>("TRACK_CHANGE", {
      ignoreUndefined: true,
      defaultValue: null,
    });
    document.title = `YouTube Music - Task View`;
    Promise.all([window.process.isWin11(), window.ipcRenderer.invoke("api/track")]).then(
      ([isWin11, currentTrack]) => {
        showWinBorder.value = window.process.platform === "win32" ? !isWin11 : false;
        setTrack(currentTrack);
      },
    );
    return {
      showWinBorder,
      accentColor,
      track,
    };
  },
  computed: {},
});
</script>

<style lang="scss">
.task-menu {
  @apply mt-2 mb-6 mx-2 flex flex-col space-y-2;
  &-item {
    @apply min-h-[40px] px-3 cursor-pointer bg-zinc-900/60 rounded text-sm font-semibold text-left transition-transform select-none flex items-center space-x-2;
    &:hover,
    &:active {
      @apply bg-zinc-900/80;
    }
    &:active {
      @apply scale-[.98];
    }
  }
}
</style>
