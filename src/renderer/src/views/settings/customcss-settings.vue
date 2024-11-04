<template>
  <div class="flex flex-col gap-4 mt-4">
    <div class="px-3 flex flex-col gap-4">
      <settings-checkbox configKey="customcss.enabled" ref="customCssToggle">
        Enable Custom CSS
      </settings-checkbox>
      <ease-transition>
        <div class="flex flex-col gap-4" v-if="customCssToggle && customCssToggle.value">
          <settings-input
            configKey="customcss.scssFile"
            ref="customCssPathInput"
            type="file"
            accept=".scss,.sass"
          >
            <template v-slot:label> SCSS File </template>
          </settings-input>
          <settings-checkbox configKey="customcss.scssFileWatch" @change="scssWatch">
            Update on Changes
          </settings-checkbox>
          <button class="btn btn-primary" @click="reloadCSS">Reload</button>
        </div>
      </ease-transition>
    </div>
  </div>
</template>

<script lang="ts">
import EaseTransition from "@renderer/components/EaseTransition.vue";
import SettingsCheckbox from "@renderer/components/SettingsCheckbox.vue";
import SettingsInput from "@renderer/components/SettingsInput.vue";
import { defineComponent, ref } from "vue";

export default defineComponent({
  components: { SettingsCheckbox, SettingsInput, EaseTransition },
  methods: {
    reloadCSS() {
      (window as any).api.reloadCustomCss();
    },
    scssWatch(enabled: boolean) {
      (window as any).api.watchCustomCss(!!enabled);
    },
  },
  setup() {
    const customCssToggle = ref(null),
      customCssPathInput = ref(null);
    return {
      customCssToggle,
      customCssPathInput,
    };
  },
});
</script>

<style></style>
