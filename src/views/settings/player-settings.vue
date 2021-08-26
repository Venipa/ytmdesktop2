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
    </div>
  </div>
</template>

<script lang="ts">
import SettingsCheckbox from "@/components/SettingsCheckbox.vue";
import { defineComponent } from "vue";

export default defineComponent({
  components: { SettingsCheckbox },
});
</script>

<style></style>
