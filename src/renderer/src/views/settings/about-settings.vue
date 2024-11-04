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
        <button class="btn btn-ghost" v-if="updateInfo && updateDownloaded" @click="runUpdate">
          <div class="flex leading-none flex-col space-y-1 justify-center items-center">
            <div>Install Update</div>
            <div class="text-green-500">{{ updateInfo.version }}</div>
          </div>
        </button>
        <button
          class="btn btn-ghost"
          v-else-if="updateInfo && updateInfoProgress?.percent"
          disabled
        >
          Downloading...{{ updateInfoProgress.percent.toFixed(0).padStart(5) }}%
        </button>
        <button class="btn btn-ghost" v-else @click="checkUpdate">
          {{ updateChecking ? "Checking for Updates..." : "Check for Update" }}
        </button>
      </div>
      <div class="h-px my-4 bg-gray-500 rounded"></div>
      <div class="px-5 flex flex-col gap-4">
        <settings-checkbox configKey="app.beta"> Include Pre Releases / Beta </settings-checkbox>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import SettingsCheckbox from "@renderer/components/SettingsCheckbox.vue";
import { refIpc } from "@shared/utils/Ipc";
import { defineComponent, onMounted, ref } from "vue";

export default defineComponent({
  components: { SettingsCheckbox },
  setup() {
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
    return {
      updateChecking,
      updateInfo,
      updateInfoProgress,
      updateDownloaded,
      checkUpdate() {
        if (updateChecking.value) return;
        setUpdateChecking(true);
        this.action("app.checkUpdate").finally(() => {
          setUpdateChecking(false);
        });
      },
      action(actionParam) {
        return (window as any).api.action(actionParam);
      },
      runUpdate() {
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
      },
    };
  },
  computed: {
    appVersion(): string {
      return (window as any).api.version;
    },
  },
  methods: {},
  created() {},
});
</script>

<style></style>
