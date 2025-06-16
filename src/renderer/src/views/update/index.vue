<template>
  <div class="min-h-screen flex flex-col p-4 bg-black overflow-y-auto overflow-x-hidden h-full">
    <!-- Checking for Updates View -->
    <div v-if="updateChecking"
         class="text-center py-12 px-6 flex items-center justify-center flex-col flex-grow">
      <h2 class="text-white text-xl font-semibold mb-2">Checking for Updates</h2>
      <p class="text-gray-400 text-sm mb-6">Please wait while we check for available updates...</p>
      <!-- Loading dots animation -->
      <div class="flex justify-center items-center gap-1">
        <Spinner size="lg" />
      </div>
    </div>
    <!-- Update Available View -->
    <div v-else-if="updateInfo">
      <!-- Header -->
      <div class="text-center pb-4 pt-6 px-6 drag">
        <div class="mx-auto mb-4 p-3 rounded-full bg-gray-900 w-fit">
          <DownloadIcon :size="32"
                        class="text-blue-400" />
        </div>
        <h2 class="text-white text-xl font-semibold mb-2">Update Available</h2>
        <p class="text-gray-400 text-sm">Version {{ updateInfo.version }} is ready to install</p>
      </div>
      <!-- Content -->
      <div class="px-6 pb-6 space-y-6">
        <!-- Version Info -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-white">Current Version</p>
            <p class="text-xs text-gray-400">{{ currentVersion }}</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-medium text-white">New Version</p>
            <div class="flex items-center gap-2">
              <p class="text-xs text-gray-400">{{ updateInfo.version }}</p>
              <span class="bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded-full"> Latest </span>
            </div>
          </div>
        </div>
        <div class="border-t border-gray-800"></div>
        <!-- Update Details -->
        <div class="space-y-3">
          <h4 class="text-sm font-medium text-white">Release Notes</h4>
          <template v-if="updateInfo.releaseNotes">
            <MDXProvider :components="MDXComponents">
              <div class="text-sm text-gray-200"
                   v-html="updateInfo.releaseNotes" />
            </MDXProvider>
          </template>
        </div>
        <!-- Download Progress -->
        <div v-if="updateInfoProgress"
             class="space-y-3">
          <div class="border-t border-gray-800"></div>
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-gray-400">{{ isComplete ? 'Download Complete' : 'Downloading...' }}</span>
              <span class="text-white">{{ Math.round(updateInfoProgress.percent) }}%</span>
            </div>
            <div class="w-full bg-gray-800 rounded-full h-2">
              <div class="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                   :style="{ width: `${updateInfoProgress.percent}%` }"></div>
            </div>
            <div class="flex items-center justify-between text-xs text-gray-300">
              <span>Size: {{ prettyBytes(updateInfoProgress.total) }}</span>
              <span>{{ isComplete ? prettyBytes(updateInfoProgress.total) : `${prettyBytes(updateInfoProgress.transferred)} / ${prettyBytes(updateInfoProgress.total)}` }}</span>
            </div>
          </div>
        </div>
        <!-- Action Buttons -->
        <div class="flex gap-3 pt-2">
          <template v-if="updateInfoProgress && !updateDownloaded">
            <button class="w-full px-4 py-2 border border-gray-700 text-gray-300 rounded-md opacity-50 cursor-not-allowed"
                    disabled> Downloading... </button>
          </template>
          <template v-else-if="updateDownloaded && !isInstalling">
            <button @click="window.close()"
                    class="flex-1 px-4 py-2 border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors"> Later </button>
            <button @click="installUpdate(true)"
                    class="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors flex items-center justify-center gap-2">
              <CheckCircleIcon :size="16" /> Install Now
            </button>
          </template>
          <template v-else-if="!updateDownloaded">
            <button @click="window.close()"
                    class="flex-1 px-4 py-2 border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors"> Later </button>
            <button @click="installUpdate(false)"
                    class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center justify-center gap-2">
              <DownloadIcon :size="16" /> Download
            </button>
          </template>
        </div>
        <!-- Footer Info -->
        <div class="text-center pt-2">
          <p class="text-xs text-gray-400">Update will be installed automatically after download</p>
        </div>
      </div>
    </div>
    <!-- No Updates Available View -->
    <div v-else
         class="text-center py-12 px-6 flex items-center justify-center flex-col flex-grow">
      <div class="mx-auto mb-4 p-3 rounded-full bg-gray-900 w-fit">
        <CheckCircleIcon :size="32"
                         class="text-green-400" />
      </div>
      <h2 class="text-white text-xl font-semibold mb-2">You're Up to Date</h2>
      <p class="text-gray-400 text-sm mb-6">Your software is running the latest version ({{ currentVersion }})</p>
      <div class="flex flex-col gap-2 items-center">
        <button class="btn btn-sm"
                @click="checkUpdate"> Check Again </button>
        <button class="btn btn-ghost btn-sm"
                @click="window.close()">Close</button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { MDXProvider } from '@mdx-js/vue'
import Spinner from '@renderer/components/Spinner.vue'
import { MDXComponents } from '@renderer/views/update/mdx-components'
import { refIpc } from '@shared/utils/Ipc'
import type { ProgressInfo, UpdateInfo } from '@shared/utils/updater'
import {
  CheckCircleIcon,
  DownloadIcon
} from 'lucide-vue-next'
import _prettyBytes from "pretty-bytes"
import { ref } from 'vue'

const prettyBytes = (bytes: number) => {
  return _prettyBytes(bytes, {
    binary: true,
    space: true
  })
}

const isComplete = ref(false)
const currentVersion = ref("v" + window.api.version)
const [updateChecking, setUpdateChecking] = refIpc<boolean>("APP_UPDATE_CHECKING");

const [updateInfo, setUpdateInfo] = refIpc<UpdateInfo | null>("APP_UPDATE", {
  getInitialValue: async () => {
    return await window.api.action("app.getUpdate")
  }
});

const [updateInfoProgress, setUpdateInfoProgress] = refIpc<ProgressInfo | null>("APP_UPDATE_PROGRESS", {
  ignoreUndefined: true,
  defaultValue: null,
});
const [updateDownloaded, setUpdateDownloaded] = refIpc("APP_UPDATE_DOWNLOADED", {
  ignoreUndefined: true,
  defaultValue: null,
  mapper: (x) => !!x,
  async getInitialValue() {
    return await window.api.action("app.updateDownloaded").then(x => {
      console.log("updateDownloaded", x)
      return !!x
    })
  },
});
const isInstalling = ref(false);
function installUpdate(quitAndInstall: boolean = true) {
  if (isInstalling.value) return Promise.resolve(null);
  isInstalling.value = true;
  if (!updateDownloaded.value) {
    setUpdateInfoProgress({
      total: 0,
      delta: 0,
      transferred: 0,
      percent: 0,
      bytesPerSecond: 0
    })
  }
  return window.api
    .action("app.installUpdate", quitAndInstall)
    .then((downloaded) => {
      isComplete.value = downloaded
      setUpdateDownloaded(downloaded)
      setUpdateInfoProgress(null)
    }).catch(err => {
      setUpdateInfoProgress(null)
      if (err instanceof Error && err.message.endsWith("[E002]")) {
        isInstalling.value = true;
      } else throw err;
    })
    .finally(() => {
      isInstalling.value = false;
    });
}

async function checkUpdate() {
  if (updateChecking.value) return;
  setUpdateChecking(true);
  await window.api.action("app.checkUpdate").finally(() => {
    setUpdateChecking(false);
  });
}
</script>
<style>
html,
body {
  height: 100%;
  overflow: hidden;
  background-color: #000;
}
</style>
<style scoped>
/* Custom scrollbar for webkit browsers */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #2a2a2a;
}

::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #5a5a5a;
}
</style>