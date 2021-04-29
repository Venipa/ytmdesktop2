<template>
  <div class="h-full">
    <control-bar title="Settings"></control-bar>
    <router-view></router-view>
  </div>
</template>

<script>
import ControlBar from "./components/ControlBar";
export default {
  name: "App",
  components: {
    ControlBar,
  },
  computed: {},
};
</script>

<style>
#app,
html,
body {
  @apply text-gray-100 bg-gray-900 h-full;
}
</style>
