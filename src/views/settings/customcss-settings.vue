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
            <template v-slot:label>
              SCSS File
            </template>
          </settings-input>
          <button class="btn btn-primary" @click="reloadCSS">
            Reload
          </button>
        </div>
      </ease-transition>
    </div>
  </div>
</template>

<script lang="ts">
import EaseTransition from "@/components/EaseTransition.vue";
import SettingsCheckbox from "@/components/SettingsCheckbox.vue";
import SettingsInput from "@/components/SettingsInput.vue";
import { defineComponent, ref } from "vue";

export default defineComponent({
  components: { SettingsCheckbox, SettingsInput, EaseTransition },
  methods: {
    reloadCSS() {
      (window as any).app.reloadCustomCss();
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
