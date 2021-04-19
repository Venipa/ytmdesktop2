<template>
  <div
    class="flex items-stretch justify-between border-b bg-black border-gray-600 select-none h-10 px-2"
  >
    <div class="flex items-center flex-1 drag">
      <div class="h-4 w-4 text-gray-50 mr-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
      <p class="text-xs">{{ title }}</p>
    </div>
    <div class="flex items-center space-x-2">
      <a href="https://github.com/Venipa/ytmdesktop2" class="badge bg-primary rounded px-2" target="_blank">BETA</a>
      <div class="w-px h-6 bg-gray-600"></div>
      <div class="flex items-center space-x-1">
        <div @click="onMin" class="control-button"><MinIcon /></div>
        <div @click="onMax" class="control-button"><MaxIcon /></div>
        <div @click="onClose" class="control-button control-button-danger">
          <CloseIcon />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import CloseIcon from "@/assets/icons/close.svg";
import MaxIcon from "@/assets/icons/max-window.svg";
import MinIcon from "@/assets/icons/min-window.svg";
export default {
  components: {
    CloseIcon,
    MaxIcon,
    MinIcon
  },
  props: {
    title: String,
  },
  methods: {
    onClose() {
      window.api.settings.close();
    },
    onSettings() {
      window.api.settings.open();
    },
    onMax() {
      window.api.maximize();
    },
    onMin() {
      window.api.minimize();
    },
  },
};
</script>

<style lang="scss">
.control-button {
  &.control-button-danger {
    &:hover {
      @apply bg-red-600;
    }
  }
  @apply h-8 w-8 rounded flex items-center justify-center text-gray-50 transition duration-100;
  &:hover,
  &:active,
  &:focus {
    @apply bg-gray-600;
  }
  &:active {
    @apply transform-gpu scale-95;
  }
  svg {
    @apply w-4 h-4;
  }
}
</style>
