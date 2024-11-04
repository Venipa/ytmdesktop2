<template>
  <div class="h-full absolute inset-0 overflow-hidden flex flex-col">
    <control-bar title="Settings"></control-bar>
    <div class="flex flex-col flex-auto">
      <div class="navbar pb-0 min-h-0">
        <div class="container mx-auto">
          <div class="tabs">
            <router-link to="/" class="tab tab-bordered" exact-active-class="tab-active active"
              >Generic</router-link
            >
            <router-link to="/player" class="tab tab-bordered" active-class="tab-active active"
              >Player</router-link
            >
            <router-link to="/discord" class="tab tab-bordered" active-class="tab-active active"
              >Discord</router-link
            >
            <router-link to="/custom-css" class="tab tab-bordered" active-class="tab-active active"
              >Custom CSS</router-link
            >
            <router-link
              to="/integrations"
              class="tab tab-bordered"
              active-class="tab-active active"
              >Integrations</router-link
            >
            <router-link to="/about" class="tab tab-bordered" active-class="tab-active active"
              >About</router-link
            >
          </div>
        </div>
      </div>
      <div class="overflow-auto relative flex-auto router-content">
        <div class="container absolute inset-0 mb-8 mx-auto flex flex-col">
          <router-view></router-view>
          <div class="flex-auto mb-6"></div>
          <div
            class="flex flex-row items-end flex-shrink-0 px-3 -mb-6 pb-3 border-t border-t-gray-500 pt-3"
          >
            <div class="flex flex-col self-center space-y-1 flex-shrink-0">
              <div class="flex items-center space-x-2 text-xs">
                <LogoIcon class="pointer-events-none w-4 h-4" />
                <span>YouTube Music for Desktop</span>
              </div>
              <span class="text-xs text-gray-300"
                >v{{ appVersion }}@{{ appEnv }} ({{ appOS }})</span
              >
            </div>
            <div class="flex-[1_1_40px]"></div>
            <div class="flex flex-col items-end justify-end space-y-1">
              <a
                href="https://github.com/Venipa/ytmdesktop2"
                class="btn btn-ghost btn-xs"
                target="_blank"
                >Github</a
              >
              <a href="https://youtube-music.app" class="btn btn-ghost btn-xs" target="_blank"
                >Website</a
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import LogoIcon from "@renderer/assets/logo.svg";
import ControlBar from "@renderer/components/ControlBar.vue";
import { onMounted } from "vue";
export default {
  components: {
    ControlBar,
    LogoIcon,
  },
  setup() {
    onMounted(() => {
      document.title = `YouTube Music - Settings`;
    });
    return {
      appVersion: window.api.version,
      appOS: window.process.platform,
      appEnv: window.process.environment,
    };
  },
};
</script>

<style lang="scss">
.router-content {
  @apply bg-black/30;
}
.navbar {
  @apply bg-black/80 border-b border-gray-700 pt-2;

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
.tab {
  @apply text-gray-300;
  &.active {
    @apply text-gray-50;
  }
}
</style>
