<template>
  <div
    class="flex items-stretch justify-between border-b bg-black border-gray-600 select-none h-10 px-2"
  >
    <div class="flex items-center flex-1 drag">
      <div class="h-4 w-4 text-gray-50 mr-2">
        <slot name="icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clip-rule="evenodd"
            />
          </svg>
        </slot>
      </div>
      <p class="text-xs">{{ title }}</p>
    </div>
    <div class="flex items-center space-x-2">
      <slot name="divider">
        <div class="w-px h-6 bg-gray-50/10"></div>
      </slot>
      <div class="flex items-center space-x-1">
        <template v-if="!isMac">
          <div v-if="state?.minimizable" class="control-button" @click="onMin">
            <MinIcon />
          </div>
          <div v-if="state?.maximizable" class="control-button" @click="onMax">
            <MaxIcon />
          </div>
        </template>
        <div v-if="showClose" class="control-button control-button-danger" @click="onClose">
          <CloseIcon />
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import CloseIcon from "@renderer/assets/icons/close.svg";
import MaxIcon from "@renderer/assets/icons/max-window.svg";
import MinIcon from "@renderer/assets/icons/min-window.svg";

import { refWindowState } from "@shared/utils/Ipc";
import { computed } from "vue";
type ControlType = "close" | "maximize" | "minimize";
const props = defineProps({
	title: String,
	controls: {
		type: Object,
		default: null,
		required: false,
	},
});
const isMac = computed(() => window.process.platform === "darwin");
const showMin = computed(() => {
	const { controls } = props || {};
	if (!controls) return true;
	return !!controls.find((x) => x === "minimize");
});
const showClose = computed(() => {
	const { controls } = props || {};
	if (!controls) return true;
	return !!controls.find((x) => x === "close");
});
const [state] = refWindowState();
function onClose() {
	window.api.closeWindow();
}
function onMax() {
	window.api.maximize();
}
function onMin() {
	window.api.minimize();
}
</script>
<style lang="scss"></style>
