<template>
  <div class="h-full">
    <control-bar title="Settings"></control-bar>
    <div class="flex flex-col">
      <div class="navbar">
        <div class="container mx-auto">
          <div class="nav-items">
            <router-link to="/" class="nav-item" exact-active-class="active"
              >Generic</router-link
            >
            <router-link to="/discord" class="nav-item" active-class="active"
              >Discord</router-link
            >
            <router-link to="/custom-css" class="nav-item" active-class="active"
              >Custom CSS</router-link
            >
            <router-link to="/about" class="nav-item" active-class="active"
              >About</router-link
            >
          </div>
        </div>
      </div>
      <div class="container mx-auto">
        <router-view></router-view>
      </div>
    </div>
  </div>
</template>

<script>
import ControlBar from "@/components/ControlBar";
export default {
  components: {
    ControlBar
  }
};
</script>

<style lang="scss">
.navbar {
  @apply bg-black bg-opacity-10 border-b border-gray-700 pt-2;
  .nav-items {
    @apply flex flex-row items-center gap-2 select-none;
    .nav-item {
      @apply btn btn-ghost btn-sm;
      &.active {
        @apply btn-active;
      }
    }
  }
}
</style>
