<template>
  <div class="min-h-screen flex flex-col p-4 bg-black overflow-y-auto overflow-x-hidden h-full">
    <!-- Checking for Updates View -->
    <div class="text-center py-12 px-6 flex items-center justify-center flex-col flex-grow">
      <h2 class="text-white text-xl font-semibold mb-2">Restart Required</h2>
      <p class="text-gray-400 text-sm mb-6">Please restart the application to apply the changes.</p>
    </div>
    <div class="flex gap-3 pt-2">
      <button @click="action('later')"
              class="flex-1 px-4 py-2 border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors"> Later </button>
      <button @click="action('ok')"
              class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center justify-center gap-2">
        Restart
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
function action(action: "later" | "ok") {
  window.api.frame("window.response", { action });
}
</script>

<style lang="scss" scoped></style>