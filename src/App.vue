<template>
  <div>
    <control-bar></control-bar>
    <router-view></router-view>
  </div>
</template>

<script>
import ControlBar from './components/ControlBar'
export default {
  name: 'App',
  components: {
    ControlBar
  }
}
</script>

<style>
body {
  @apply text-gray-100 bg-gray-900;
}
</style>
