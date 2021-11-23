<template>
  <div class="flex flex-row items-center space-x-2">
    <div @click="() => action('nav.same-origin')" class="control-button relative w-4 h-4" v-if="!isHome">
      <HomeIcon></HomeIcon>
    </div>
    <div @click="() => toggleSetting('discord.enabled')" class="control-button relative" :class="{ 'opacity-100': discordEnabled, 'opacity-70': !discordEnabled }">
      <RPCIcon></RPCIcon>
      <div v-if="discordConnected" class="p-0.5 rounded-full bg-green-500 absolute top-0 right-0 w-3 h-3 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
    </div>
    <div @click="onSettings" class="control-button">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
      </svg>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref } from "@vue/runtime-core";
import RPCIcon from "@/assets/icons/discord-rpc.svg";
import HomeIcon from "@/assets/icons/home.svg";
const discordConnected = ref(false),
  discordEnabled = ref(!!window.settings.get("discord.enabled"));
const isHome = ref(true);
const subscribers = [];
subscribers.push(
  window.ipcRenderer.on("discord.connected", () => (discordConnected.value = true)),
  window.ipcRenderer.on("discord.disconnected", () => (discordConnected.value = false)),
  window.api.on("nav.same-origin", (ev, sameOrigin) => {
    if (sameOrigin !== isHome.value) isHome.value = !!sameOrigin;
  }),
  window.ipcRenderer.on("settingsProvider.change", (ev, key, value) => {
    if (key === "discord.enabled" && value !== discordEnabled.value) discordEnabled.value = !!value;
  })
);
export default defineComponent({
  components: { RPCIcon, HomeIcon },
  methods: {
    onSettings() {
      window.api.settings.open();
    },
  },
  setup() {
    discordEnabled.value = !!window.settings.get("discord.enabled");
    window.ipcRenderer.invoke("req:discord.connected").then((x) => (discordConnected.value = !!x));
    return {
      discordEnabled,
      discordConnected,
      isHome,
      async toggleSetting(key) {
        const setting = await window.api.settingsProvider.update(key, !window.settings.get(key));
        if (key === "discord.enabled") discordEnabled.value = setting;
      },
      action(actionParam) {
        window.api.emit(`action:${actionParam}`);
      },
    };
  },
  unmounted() {
    subscribers.filter(x => !!x).forEach(window.ipcRenderer.off);
  },
});
</script>

<style>
</style>