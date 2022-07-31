<template>
  <div class="h-full absolute inset-0 overflow-hidden flex flex-col">
    <control-bar title="Settings"></control-bar>
    <div class="flex flex-col flex-auto">
      <div class="navbar pb-0 min-h-0">
        <div class="container mx-auto">
          <div class="tabs">
            <router-link to="/" class="tab tab-bordered" exact-active-class="tab-active active">Generic</router-link>
            <router-link to="/player" class="tab tab-bordered" active-class="tab-active active">Player</router-link>
            <router-link to="/discord" class="tab tab-bordered" active-class="tab-active active">Discord</router-link>
            <router-link to="/custom-css" class="tab tab-bordered" active-class="tab-active active">Custom CSS</router-link>
            <router-link to="/about" class="tab tab-bordered" active-class="tab-active active">About</router-link>
          </div>
        </div>
      </div>
      <div class="overflow-auto relative flex-auto">
        <div class="container absolute inset-0 mb-8 mx-auto flex flex-col">
          <router-view></router-view>
          <div class="flex-auto mb-6"></div>
          <div class="h-20 flex flex-col items-center justify-end flex-shrink-0 space-y-0.5">
            <div class="flex items-center space-x-3">
              <a href="https://github.com/Venipa/ytmdesktop2" class="btn btn-ghost btn-xs" target="_blank">Github</a>
              <a href="https://youtube-music.app" class="btn btn-ghost btn-xs" target="_blank">Website</a>
            </div>
              <span class="text-xs text-gray-300">v{{appVersion}}@{{appEnv}} ({{appOS}})</span>
              <LogoIcon class="pointer-events-none w-4 h-4" />
            <div class="h-1.5"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import ControlBar from "@/components/ControlBar";
import LogoIcon from "@/assets/logo.svg";
export default {
  components: {
    ControlBar,
    LogoIcon,
  },
  setup() {
    return {
      appVersion: window.api.version,
      appOS: window.process.platform,
      appEnv: window.process.environment,
    };
  },
};
</script>

<style lang="scss">
.navbar {
  @apply bg-black bg-opacity-20 border-b border-gray-700 pt-2;
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
