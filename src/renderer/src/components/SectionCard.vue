<template>
  <div class="bg-opacity-5 bg-white shadow sm:rounded-lg mt-4 relative overflow-hidden">
    <div
      class="absolute inset-0 bg-gray-600/70 flex items-center justify-center text-gray-200 text-sm"
      v-if="loading === true"
    >
      <progress class="progress progress-primary bg-transparent w-24"></progress>
    </div>
    <div class="px-4 py-5 sm:p-6">
      <slot></slot>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { defineProps } from "vue";
const props = defineProps({
  loading: Boolean,
});
</script>

<style></style>
