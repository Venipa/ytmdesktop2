<template>
  <div class="h-full overflow-hidden bg-blue-500 text-white flex flex-auto items-center text-sm select-none pointer-events-none">
    <div class="flex items-start justify-center space-x-2 container">
      <AlertIcon class="h-4 w-4 mt-1 flex-shrink-0"></AlertIcon>
      <div class="flex flex-col leading-tight">
        <p>If there are any issues logging in, press <strong>try again</strong> until it works.</p>
        <p class="break-words">This is happening due to google tightening security on unofficial apps or to be more specific "electron apps".</p>
      </div>
    </div>
  </div>
</template>

<script>
import AlertIcon from "@/assets/icons/alert-triangle.svg";
export default {
  components: {
    AlertIcon
  }
}
</script>

<style lang="scss">

html,
body {
  @apply overflow-hidden;
}
</style>