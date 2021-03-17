<template>
  <div class="container my-8 mx-auto">
    <div class="flex flex-col">
      <div class="space-y-1 mx-4 sm:mx-6">
        <h3 class="text-lg leading-6 font-medium text-gray-100">
          About
        </h3>
        <p class="text-sm text-gray-200">
          Shows information about your Youtube Desktop Instance
        </p>
      </div>
      <div class="h-px my-4 bg-gray-500 rounded"></div>
      <div class="flex flex-row mx-4 sm:mx-6">
        <div class="flex flex-col flex-1">
          <span class="font-semibold">Version</span>
          <span class="text-green-500 text-sm">{{ appVersion }}</span>
        </div>
        <button class="btn btn-ghost">Update</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  computed: {
    appVersion(): string {
      return (window as any).app.version;
    },
  },
});
</script>

<style></style>
