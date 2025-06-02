<template>
  <div class="h-full overflow-hidden" ref="root">
    <div
      class="flex items-stretch justify-between border-b bg-black border-gray-600 select-none h-10 px-2 space-x-2"
      :class="{ 'pl-20': state && state.platform?.isMacOS && !state.fullScreen }"
    >
      <button
        class="control-button self-center cursor-pointer"
        :class="{ disabled: !state?.navigation?.canGoBack }"
        :disabled="!state?.navigation?.canGoBack"
        @click="onGoBack"
      >
        <ArrowLeftIcon />
      </button>
      <div class="flex items-center flex-1 drag space-x-2 appear">
        <div v-if="!isDarwin" class="flex items-center space-x-1">
          <div class="text-xs label -mt-px flex-none">YouTube Music for Desktop</div>
          <div v-if="appVersion !== undefined" class="text-xs opacity-30 text-white">
            v{{ appVersion }}
          </div>
        </div>
        <div
          v-if="title"
          class="text-xs bg-primary h-7 rounded items-center px-3 bg-opacity-50 appear flex truncate"
        >
          <span class="truncate overflow-ellipsis">{{ title }}</span>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <template v-if="isDarwin && appVersion">
          <div class="text-xs opacity-30 text-white">v{{ appVersion }}</div>
          <div class="w-px h-6 bg-gray-600"></div>
        </template>
        <template v-if="updateInfo">
          <button
            class="text-xs h-7 rounded items-center px-3 transition duration-100 ease-out appear flex truncate cursor-pointer"
            :class="{
              'bg-green-500 text-white': updateInfo && !updateInfoProgress && !updateDownloaded,
              'text-green-500': updateDownloaded,
            }"
            @click="() => runUpdate()"
          >
            <template v-if="updateInfoProgress?.percent">
              <Spinner size="sm" />
              <span
                >Downloading Update v{{ updateInfo.version }}...
                {{ updateInfoProgress.percent.toFixed(0).padStart(5) }}%</span
              >
            </template>
            <template v-else>
              <span class="truncate overflow-ellipsis">New Update v{{ updateInfo.version }}</span>
            </template>
          </button>
        </template>
        <toolbar-options></toolbar-options>
        <template v-if="!isDarwin">
          <div class="w-px h-6 bg-gray-600"></div>
          <div class="flex items-center space-x-1">
            <div class="control-button" @click="onMin">
              <MinIcon />
            </div>
            <div class="control-button" @click="onMax">
              <MaxIcon />
            </div>
            <div class="control-button control-button-danger" @click="onClose">
              <CloseIcon />
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import Spinner from "@renderer/components/Spinner.vue";
import { refIpc, refMainWindowState } from "@shared/utils/Ipc";
import { ArrowLeftIcon, XIcon as CloseIcon, MaximizeIcon as MaxIcon, Minimize2 as MinIcon } from "lucide-vue-next";
import { ref } from "vue";
import ToolbarOptions from "./toolbar-options.vue";
const appVersion = ref(window.api.version);
const isDarwin = ref(window.process.platform === "darwin");
const [state] = refMainWindowState();
const [title] = refIpc("TRACK_TITLE_CHANGE", {
	ignoreUndefined: true,
	defaultValue: null,
});
const [updateInfo, setUpdateInfo] = refIpc("APP_UPDATE", {
	ignoreUndefined: true,
	defaultValue: null,
});
const [updateInfoProgress] = refIpc("APP_UPDATE_PROGRESS", {
	ignoreUndefined: true,
	defaultValue: null,
});
const [updateDownloaded] = refIpc("APP_UPDATE_DOWNLOADED", {
	ignoreUndefined: true,
	defaultValue: null,
	mapper: (x) => !!x,
});
const isInstalling = ref(false);
function runUpdate() {
	if (isInstalling.value) return Promise.resolve(null);
	isInstalling.value = true;
	return window.api
		.action("app.installUpdate")
		.then(() => {
			setUpdateInfo(null);
		})
		.finally(() => {
			isInstalling.value = false;
		});
}
function onClose() {
	window.api.quit();
}
function onMax() {
	window.api.maximize();
}
function onMin() {
	window.api.minimize();
}
function onGoBack() {
	window.api.goback();
}
const root = ref<HTMLElement>();
// onMounted(() => {
//   if (root) window.domUtils.setInteractiveElements([root.value]);
// })
</script>
<style lang="scss">
html,
body {
  @apply overflow-hidden !bg-transparent;
}
</style>
