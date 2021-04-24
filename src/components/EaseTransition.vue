<template>
  <transition
    enter-active-class="ease-out duration-200"
    enter-class="opacity-0 translate-y-4 translate-y-0 scale-95"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="ease-in duration-100"
    leave-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 translate-y-4 translate-y-0 scale-95"
  >
      <slot></slot>
  </transition>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({});
</script>

<style></style>
