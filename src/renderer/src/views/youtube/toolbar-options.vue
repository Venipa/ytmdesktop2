<template>
  <div class="flex flex-row items-center space-x-2">
    <button :class="{
      'control-button relative h-4': true,
      'opacity-70 btn-disabled': lastFMLoading,
      [lastFM.name ? '!w-auto flex space-x-2.5 items-center px-1.5 ' : 'w-4']: true,
    }"
            @click="authorizeLastFM">
      <template v-if="lastFM.connected && !lastFM.error && lastFMState !== null">
        <Spinner size="sm"
                 v-if="typeof lastFMState === 'string'" />
        <CheckIcon v-else-if="lastFMState === true"
                   class="text-green-500" />
        <AlertCircleIcon v-else-if="lastFMState === false"
                         class="text-red-500" />
      </template>
      <LastFMIcon :class="{
        'text-green-500': lastFM.connected && !lastFM.error,
        'text-red-500': lastFM.error,
      }"
                  v-else></LastFMIcon>
      <span v-if="lastFM.name"
            :class="{ 'text-gray-100 text-sm': true }">{{ lastFM.name }}</span>
    </button>
    <button v-if="!isHome"
            class="control-button relative w-4 h-4"
            @click="() => action('nav.same-origin')">
      <HomeIcon></HomeIcon>
    </button>
    <button class="control-button relative w-4 h-4"
            :class="{ disabled: updateChecking }"
            :disabled="updateChecking"
            @click="() => checkUpdate()">
      <Spinner v-if="updateChecking"
               size="sm" />
      <RefreshIcon v-else></RefreshIcon>
    </button>
    <button v-if="isDev"
            class="control-button relative w-4 h-4"
            @click="() => action('app.devTools')">
      <DevIcon></DevIcon>
    </button>
    <button class="control-button relative w-4 h-4"
            :disabled="!playState"
            :class="miniPlayer ? { 'opacity-100': miniPlayer?.active, 'opacity-70': !miniPlayer?.active } : {}
              "
            @click="() => action('app.miniPlayer')">
      <MiniPlayerIcon />
    </button>
    <button class="control-button relative"
            :class="{ 'opacity-100': discordEnabled || discordConnectionError, 'opacity-70': !discordEnabled }"
            @click="() => toggleSetting('discord.enabled')">
      <RPCIcon :class="{ 'text-red-500': discordConnectionError && discordEnabled }"></RPCIcon>
      <div v-if="discordConnected && !discordConnectionError"
           class="p-0.5 rounded-full bg-green-500 absolute top-0 right-0 w-3 h-3 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg"
             class="w-4 h-4"
             viewBox="0 0 24 24"
             fill="none"
             stroke="currentColor"
             stroke-width="3"
             stroke-linecap="round"
             stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
    </button>
    <button class="control-button"
            @click="onSettings">
      <svg xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 20 20"
           fill="currentColor">
        <path fill-rule="evenodd"
              d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clip-rule="evenodd" />
      </svg>
    </button>
  </div>
</template>
<script lang="ts" setup>
import IPC_EVENT_NAMES from "@main/utils/eventNames";
import DevIcon from "@renderer/assets/icons/chip.svg";
import RPCIcon from "@renderer/assets/icons/discord-rpc.svg";
import HomeIcon from "@renderer/assets/icons/home.svg";
import LastFMIcon from "@renderer/assets/icons/lastfm.svg";
import MiniPlayerIcon from "@renderer/assets/icons/mini-player.svg";
import RefreshIcon from "@renderer/assets/icons/refresh.svg";
import Spinner from "@renderer/components/Spinner.vue";
import { refIpc } from "@shared/utils/Ipc";
import { logger } from "@shared/utils/console";
import { AlertCircleIcon, CheckIcon } from "lucide-vue-next";
import { onMounted, ref } from "vue";

const [discordConnected, setDiscordConnected] = refIpc(["discord.connected", "discord.disconnected"], {
	defaultValue: false,
	mapper: (data, name) => {
		return { ["discord.connected"]: true, ["discord.disconnected"]: false }[name];
	},
	ignoreUndefined: true,
});
const [discordConnectionError] = refIpc(["discord.error"], {
	defaultValue: null,
	debug: true,
});
const [miniPlayer] = refIpc("miniplayer.state", {
	defaultValue: null,
	ignoreUndefined: true,
});
const [playState] = refIpc("TRACK_PLAYSTATE");
const [isHome] = refIpc("nav.same-origin", {
	defaultValue: true,
	mapper: ([sameOrigin]) => !!sameOrigin,
	rawArgs: true,
});
const [lastFM] = refIpc("LAST_FM_STATUS", {
	defaultValue: { connected: false, name: null, error: null },
	ignoreUndefined: true,
});
const stateHandle = ref<NodeJS.Timeout>();
const [lastFMState, setFmState] = refIpc<"start" | "change" | boolean | null>(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE, {
	defaultValue: null,
	ignoreUndefined: true,
	onTrigger: (_fmstate, _prevfmstate) => {
		if (typeof _prevfmstate === "string" && typeof _fmstate === "boolean") {
			if (stateHandle.value) clearTimeout(stateHandle.value);
			stateHandle.value = setTimeout(() => {
				setFmState(null);
				logger.debug("clear fm submit state");
			}, 2000);
		}
	},
});
const lastFMLoading = ref(false);
const [discordEnabled, setDiscordEnabled] = refIpc("settingsProvider.change", {
	defaultValue: window.settings.get("discord.enabled"),
	mapper: ([key, value]) => {
		if (key === "discord.enabled") return value;
	},
	ignoreUndefined: true,
	rawArgs: true,
});
const [isDev] = refIpc("settingsProvider.change", {
	defaultValue: window.settings.get("app.enableDev"),
	mapper: ([key, value]) => {
		if (key === "app.enableDev") return value;
	},
	ignoreUndefined: true,
	rawArgs: true,
});
onMounted(() => {
	window.ipcRenderer.invoke("req:discord.connected").then((x) => setDiscordConnected(!!x));
	window.api.action("lastfm.status").then((status) => {
		lastFM.value = status;
	});
});
const [updateChecking, setUpdateChecking] = refIpc<boolean>("APP_UPDATE_CHECKING");

async function toggleSetting(key) {
	const setting = await window.api.settingsProvider.update(key, !window.settings.get(key));
	if (key === "discord.enabled") setDiscordEnabled(setting);
}
function checkUpdate() {
	if (updateChecking.value) return;
	setUpdateChecking(true);
	action("app.checkUpdate").finally(() => {
		setUpdateChecking(false);
	});
}
function action(actionParam, ...params) {
	return window.api.action(actionParam, ...params);
}
function invoke(invokeParam, ...params) {
	return window.api.invoke(invokeParam, ...params);
}
function authorizeLastFM() {
	lastFMLoading.value = true;
	if (lastFM.value.connected) {
		action("lastfm.profile").finally(() => {
			lastFMLoading.value = false;
		});
		return;
	}
	invoke("lastfm.authorize").finally(() => {
		lastFMLoading.value = false;
	});
}
function onSettings() {
	window.api.openWindow("settingsWindow");
}
</script>
<style></style>
