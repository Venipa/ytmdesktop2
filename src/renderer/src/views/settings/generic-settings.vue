<template>
  <div class="flex flex-col gap-4">
    <div v-if="getStartedEnabled" class="bg-opacity-5 bg-white shadow sm:rounded-lg mt-4">
      <div class="px-4 py-5 sm:p-6">
        <h3 class="text-lg leading-6 font-medium text-gray-100">Get Started</h3>
        <div class="mt-2 max-w-xl text-sm text-gray-200">
          <p>
            Welcome to YouTube Music for Desktop, here you can adjust settings to your liking aswell
            as personalize your experience.
          </p>
        </div>
        <div class="mt-3 text-sm">
          <a
            href="https://youtube-music.app/"
            target="_blank"
            class="font-medium text-indigo-400 hover:text-indigo-300"
          >
            Learn more about our features
            <span aria-hidden="true">&rarr;</span></a
          >
        </div>
        <div class="mt-3 text-xs">
          <a
            href="#"
            class="font-medium text-red-400 hover:text-red-300"
            @click.prevent="disableGetStarted"
            >Don't show again</a
          >
        </div>
      </div>
    </div>
    <div class="px-3 flex flex-col gap-4 mt-4">
      <div
        :class="[
          'flex flex-col gap-y-1 border -mx-3 px-3',
          appAutostartEnabled
            ? 'border-gray-500 bg-gray-800 transition-all duration-150 ease-in-out pt-1.5 pb-2.5 rounded-lg'
            : 'border-gray-500/0 bg-gray-800/0 mt-1.5',
        ]"
      >
        <settings-checkbox config-key="app.autostart"> Enable Autostart </settings-checkbox>
        <template v-if="appAutostartEnabled">
              <settings-checkbox config-key="app.autostartMinimized">
                Start minimized
              </settings-checkbox>
        </template>
      </div>
      <settings-checkbox config-key="app.autoupdate"> Enable Autoupdate </settings-checkbox>
      <settings-checkbox config-key="app.enableStatisticsAndErrorTracing">
        <div class="flex flex-col">
          <span>Allow reporting of anonymized errors to sentry.io.</span>
          <span class="opacity-80">(allows for faster bug fixing.)</span>
        </div>
      </settings-checkbox>
      <settings-checkbox config-key="app.minimizeTrayOverride">
        Close window to tray instead of quitting
      </settings-checkbox>
      <settings-checkbox config-key="app.enableDev" class="group">
        <div class="flex flex-col">
          <div>Enable Developer Mode</div>
          <div class="select-none opacity-80 group-hover:opacity-100 text-xs font-medium">
            ... to design or test additional functionality.
          </div>
          <div
            class="select-none flex flex-col opacity-80 group-hover:opacity-100 text-xs font-medium"
          >
            <div class="flex space-x-1">
              <div class="uppercase font-bold text-red-500">Hold Up!</div>
              If someone told you to copy/paste something here you have an 11/10 chance you're being
              scammed.
            </div>
            <div>
              Pasting anything in the console could give attackers access to your Google/YouTube
              account.
            </div>
          </div>
        </div>
      </settings-checkbox>
      <settings-checkbox config-key="app.disableHardwareAccel" class="group">
        <div class="flex flex-col">
          <div>Disable Hardware Acceleration Mode</div>
          <div class="select-none opacity-80 group-hover:opacity-100 text-xs font-medium">
            updating this setting requires app restart.
          </div>
        </div>
      </settings-checkbox>
      <div
        :class="[
          'flex flex-col gap-y-1 border -mx-3 px-3',
          apiEnabledSetting
            ? 'border-gray-500 pt-1.5 pb-2.5 rounded-lg'
            : 'border-gray-500/0 mt-1.5',
        ]"
      >
        <settings-checkbox config-key="api.enabled" class="group">
          <div class="flex flex-col">
            <div>Enable API</div>
            <div class="select-none opacity-80 group-hover:opacity-100 text-xs font-medium">
              ... allows to utilize the clients api to extend functionality.
            </div>
            <div
              class="select-none text-red-500 opacity-80 group-hover:opacity-100 uppercase text-xs font-medium"
            >
              Experimental
            </div>
          </div>
        </settings-checkbox>

        <template v-if="apiEnabledSetting">
          <settings-input
            config-key="api.port"
            type="number"
            :min="13000"
            :max="39999"
            placeholder="13000-39999"
          >
            <template #label> API Port </template>
          </settings-input>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import SettingsCheckbox from "@renderer/components/SettingsCheckbox.vue";
import SettingsInput from "@renderer/components/SettingsInput.vue";
import { refIpcSetting } from "@shared/utils/Ipc";

const [getStartedEnabled] = refIpcSetting("app.getstarted");
const [apiEnabledSetting] = refIpcSetting("api.enabled");
const [appAutostartEnabled] = refIpcSetting("app.autostart");

const disableGetStarted = () => {
	window.api.settingsProvider.update("app.getstarted", false).then((v) => {
		getStartedEnabled.value = v;
	});
};
</script>

<style></style>
