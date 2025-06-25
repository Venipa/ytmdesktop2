<template>
  <div class="min-h-screen flex flex-col p-4 bg-black overflow-hidden h-full">
    <!-- Checking for Updates View -->
    <div class="text-center py-4 px-6 flex items-center justify-center flex-col flex-grow gap-4 mb-6">
      <template v-if="IconComponent">
        <icon-component :size="40" class="text-white" />
      </template>
      <h2 class="text-white text-xl font-semibold">Restart Required</h2>
      <p class="text-gray-400 text-sm">{{ meta.message }}</p>
    </div>
    <div class="flex gap-3 pt-2">
      <button @click="action('close')"
              :disabled="isBusy"
              class="flex-1 px-4 py-2 border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors"> Later </button>
      <button @click="action('ok')"
              :disabled="isBusy"
              class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center justify-center gap-2"> Restart </button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { AlertTriangleIcon, CheckCircleIcon, InfoIcon, XCircleIcon } from "lucide-vue-next";
import { computed, ref } from "vue";
const isBusy = ref(false);
const meta = computed(() => {
  const params = new URLSearchParams(location.href.slice(location.href.indexOf("?")));
  const icon = params.get("icon") ?? "info";
  const message = params.get("message") ?? "Please restart the application to apply pending changes.";
  return {
    message,
    icon
  };
});
const IconMap = {
  "check-circle": CheckCircleIcon,
  "x-circle": XCircleIcon,
  "info": InfoIcon,
  "warning": AlertTriangleIcon,
  "error": XCircleIcon
}
const IconComponent = computed(() => {
  const { icon } = meta.value;
  if (!icon) return null;
  return IconMap[icon];
});
function action(action: "close" | "ok") {
  isBusy.value = true;
  window.api.send("window.response", { action });
  setTimeout(() => {
    isBusy.value = false;
  }, 1000);
}
</script>
<style lang="scss" scoped></style>