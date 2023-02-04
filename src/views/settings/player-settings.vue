<template>
  <div class="flex flex-col gap-4">
    <div class="bg-opacity-5 bg-white shadow sm:rounded-lg mt-4">
      <div class="px-4 py-5 sm:p-6">
        <h3 class="text-lg leading-6 font-medium text-gray-100">
          Player Settings
        </h3>
        <div class="mt-2 max-w-xl text-sm text-gray-200">
          <p>
            Manage your player settings here
          </p>
        </div>
      </div>
    </div>
    <div class="px-3 flex flex-col gap-4 mt-4">
      <settings-checkbox configKey="player.skipDisliked" class="group">
        <div class="flex flex-col">
          <div>Skip disliked Songs</div>
          <div class="select-none text-red-500 opacity-80 group-hover:opacity-100 uppercase text-xs font-medium">Experimental</div>
        </div>
      </settings-checkbox>
      <div class="flex flex-col gap-4 -mx-3 px-3 py-3 rounded-lg border" :class="{ 'border-gray-500': !!resEnabled, 'border-gray-500/0': !resEnabled }">
        <settings-checkbox configKey="player.res.enabled" class="group">
        <div class="flex flex-col">
          <div>Player Video Settings</div>
          <div class="select-none opacity-80 group-hover:opacity-100 uppercase text-xs font-medium">Customize player video settings</div>
        </div>
      </settings-checkbox>
        <template v-if="resEnabled">
          <settings-select configKey="player.res.prefer" class="bg-transparent border-0">
            <template v-slot:label>
              Preferred Video Resolution (if available)
            </template>
            <template v-slot:options>
              <option value="hd2160">2160P UHD / 4K</option>
              <option value="hd1440">1440P QHD</option>
              <option value="hd1080">1080P FHD</option>
              <option value="hd720">720P HD</option>
              <option value="auto">Default</option>
            </template>
          </settings-select>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import SettingsCheckbox from "@/components/SettingsCheckbox.vue";
import SettingsSelect from "@/components/SettingsSelect.vue";
import { refIpcSetting } from "@/utils/Ipc";
import { VideoResSetting } from "@/utils/ISettings";

const [resEnabled] = refIpcSetting<VideoResSetting>("player.res.enabled");
</script>

<style></style>
