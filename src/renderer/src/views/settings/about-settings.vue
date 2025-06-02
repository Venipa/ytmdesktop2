<template>
  <div class="container my-8 mx-auto">
    <div class="flex flex-col">
      <div class="space-y-1 mx-4 sm:mx-6">
        <h3 class="text-lg leading-6 font-medium text-gray-100">About</h3>
        <p class="text-sm text-gray-200">Shows information about your YouTube Desktop Instance</p>
      </div>
      <div class="h-px my-4 bg-gray-500 rounded"></div>
      <div class="flex flex-row mx-4 sm:mx-6">
        <div class="flex flex-col flex-1">
          <span class="font-semibold">Version</span>
          <span class="text-green-500 text-sm">{{ appVersion }}</span>
        </div>
        <button v-if="updateInfo && updateDownloaded" class="btn btn-ghost" @click="runUpdate">
          <div class="flex leading-none flex-col space-y-1 justify-center items-center">
            <div>Install Update</div>
            <div class="text-green-500">{{ updateInfo.version }}</div>
          </div>
        </button>
        <button
          v-else-if="updateInfo && updateInfoProgress?.percent"
          class="btn btn-ghost space-x-4"
          disabled
        >
          <span>Downloading...{{ updateInfoProgress.percent.toFixed(0).padStart(5) }}%</span>
          <Spinner size="sm" />
        </button>
        <button v-else class="btn btn-ghost space-x-4" @click="checkUpdate">
          <span>{{ updateChecking ? "Checking for Updates..." : "Check for Update" }}</span>
          <Spinner v-if="updateChecking" size="sm" />
        </button>
      </div>
      <div class="h-px my-4 bg-gray-500 rounded"></div>
      <div class="px-5 flex flex-col gap-4">
        <settings-checkbox config-key="app.beta"> Include Pre Releases / Beta </settings-checkbox>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import SettingsCheckbox from "@renderer/components/SettingsCheckbox.vue";
import Spinner from "@renderer/components/Spinner.vue";
import { refIpc } from "@shared/utils/Ipc";
import { computed, onMounted, ref } from "vue";
const appVersion = computed((): string => {
	return (window as any).api.version;
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
const [updateChecking, setUpdateChecking] = refIpc("APP_UPDATE_CHECKING");
onMounted(() => {
	(window as any).api.action("app.getUpdate").then((ev) => setUpdateInfo(ev));
});
function action(actionParam: any) {
	return (window as any).api.action(actionParam);
}
function checkUpdate() {
	if (updateChecking.value) return;
	setUpdateChecking(true);
	action("app.checkUpdate").finally(() => {
		setUpdateChecking(false);
	});
}
function runUpdate() {
	if (isInstalling.value) return;
	isInstalling.value = true;
	return (window as any).api
		.action("app.installUpdate")
		.then(() => {
			setUpdateInfo(null);
		})
		.finally(() => {
			isInstalling.value = false;
		});
}
</script>

<style></style>
