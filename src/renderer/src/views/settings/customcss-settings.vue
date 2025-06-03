<template>
  <div class="flex flex-col gap-4 mt-4">
    <div class="px-3 flex flex-col gap-4">
      <settings-checkbox ref="customCssToggle"
                         config-key="customcss.enabled"> Enable Custom CSS </settings-checkbox>
      <ease-transition>
        <div v-if="customCssToggle && customCssToggle.value"
             class="flex flex-col gap-4">
          <settings-input ref="customCssPathInput"
                          config-key="customcss.scssFile"
                          type="file"
                          accept=".scss,.sass">
            <template #label> SCSS File </template>
          </settings-input>
          <settings-checkbox config-key="customcss.watching"> Update on Changes </settings-checkbox>
          <button class="btn btn-primary"
                  @click="reloadCSS">Reload</button>
        </div>
      </ease-transition>
    </div>
  </div>
</template>
<script lang="ts" setup>
import EaseTransition from "@renderer/components/EaseTransition.vue";
import SettingsCheckbox from "@renderer/components/SettingsCheckbox.vue";
import SettingsInput from "@renderer/components/SettingsInput.vue";
import { ref } from "vue";

const customCssToggle = ref(null),
  customCssPathInput = ref(null);
function reloadCSS() {
  (window as any).api.reloadCustomCss();
}
</script>
<style></style>
