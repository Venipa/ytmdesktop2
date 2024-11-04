<template>
  <div class="flex flex-col h-full overflow-hidden">
    <ControlBar title="Google - Login" class="flex-shrink-0">
      <template #divider>&nbsp;</template>
    </ControlBar>
    <div
      class="bg-blue-500 text-white flex flex-auto items-center text-sm select-none pointer-events-none flex-shrink-0"
    >
      <div class="flex items-start justify-center space-x-2 container">
        <AlertIcon class="h-4 w-4 mt-1 flex-shrink-0"></AlertIcon>
        <div class="flex flex-col leading-tight">
          <p>
            If there are any issues logging in, press <strong>try again</strong> until it works.
          </p>
          <p class="break-words">
            This is happening due to google tightening security on unofficial apps or to be more
            specific "electron apps".
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AlertIcon from "@renderer/assets/icons/alert-triangle.svg";
import ControlBar from "@renderer/components/ControlBar.vue";
</script>

<style lang="scss">
html,
body {
  @apply overflow-hidden;
}
</style>
