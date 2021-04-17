<template>
  <div class="h-full">
    <div
      class="flex items-stretch justify-between border-b bg-black border-gray-600 select-none h-10 px-2"
    >
      <div class="flex items-center flex-1 drag space-x-2">
        <span class="text-xs label">Youtube Music for Desktop (v2)</span>
        <template v-if="title">
          <span class="text-xs badge badge-sm badge-primary">{{ title }}</span>
        </template>
      </div>
      <div class="flex items-center space-x-2">
        <div
          @click="onSettings"
          class="control-button"
        >
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
        <div class="w-px h-6 bg-gray-600"></div>
        <div class="flex items-center space-x-1">
          <div
            @click="onMin"
            class="control-button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="4 14 10 14 10 20"></polyline>
              <polyline points="20 10 14 10 14 4"></polyline>
              <line x1="14" y1="10" x2="21" y2="3"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
          </div>
          <div
            @click="onMax"
            class="control-button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
              ></path>
            </svg>
          </div>
          <div
            @click="onClose"
            class="control-button control-button-danger"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  data() {
    return {
      title: null,
    };
  },
  methods: {
    onClose() {
      window.api.quit();
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
  created() {
    window.ipcRenderer.on(
      "track:title",
      (ev, ...[title]) => (this.title = title)
    );
  },
});
</script>

<style lang="scss">
.control-button {
  &.control-button-danger {
    &:hover {
      @apply bg-red-600;
    }
  }
  @apply h-8 w-8 rounded flex items-center justify-center text-gray-50 transition duration-100;
  &:hover, &:active, &:focus {
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
