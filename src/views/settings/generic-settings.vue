<template>
  <div class="flex flex-col gap-4">
    <div class="bg-opacity-5 bg-white shadow sm:rounded-lg mt-4" v-if="getStartedEnabled">
      <div class="px-4 py-5 sm:p-6">
        <h3 class="text-lg leading-6 font-medium text-gray-100">
          Get Started
        </h3>
        <div class="mt-2 max-w-xl text-sm text-gray-200">
          <p>
            Welcome to YouTube Music for Desktop, here you can adjust settings to your liking aswell as personalize your experience.
          </p>
        </div>
        <div class="mt-3 text-sm">
          <a href="https://youtube-music.app/" target="_blank" class="font-medium text-indigo-400 hover:text-indigo-300">
            Learn more about our features
            <span aria-hidden="true">&rarr;</span></a>
        </div>
        <div class="mt-3 text-xs">
          <a href="#" class="font-medium text-red-400 hover:text-red-300" @click.prevent="disableGetStarted">Don't show again</a>
        </div>
      </div>
    </div>
    <div class="px-3 flex flex-col gap-4 mt-4">
      <settings-checkbox configKey="app.autostart">
        Enable Autostart
      </settings-checkbox>
      <settings-checkbox configKey="app.autoupdate">
        Enable Autoupdate
      </settings-checkbox>
      <settings-checkbox configKey="app.enableStatisticsAndErrorTracing">
        <div class="flex flex-col">
          <span>Allow reporting of anonymized errors to sentry.io.</span>
          <span class="opacity-80">(allows for faster bug fixing.)</span>
        </div>
      </settings-checkbox>
      <settings-checkbox configKey="app.minimizeTrayOverride">
        Close window to tray instead of quitting
      </settings-checkbox>
      <settings-checkbox configKey="app.enableDev" class="group">
        <div class="flex flex-col">
          <div>Enable Developer Mode</div>
          <div class="select-none opacity-80 group-hover:opacity-100 text-xs font-medium">... to design or test additional functionality</div>
          <div class="select-none flex flex-col opacity-80 group-hover:opacity-100 text-xs font-medium">
            <div class="flex space-x-1">
              <div class="uppercase font-bold text-red-500">Hold Up!</div> If someone told you to copy/paste something here you have an 11/10 chance you're being scammed.
            </div>
            <div>Pasting anything in the console could give attackers access to your Google/YouTube account.</div>
          </div>
        </div>
      </settings-checkbox>
      <div :class="['flex flex-col gap-y-1', apiEnabledSetting ? 'bg-black bg-opacity-20 -mx-4 px-4 pt-1.5 pb-2.5 rounded-lg' : 'mt-1.5']">
        <settings-checkbox configKey="api.enabled" class="group">
          <div class="flex flex-col">
            <div>Enable API</div>
            <div class="select-none opacity-80 group-hover:opacity-100 text-xs font-medium">... allows to utilize the clients api to extend functionality.</div>
            <div class="select-none text-red-500 opacity-80 group-hover:opacity-100 uppercase text-xs font-medium">Experimental</div>
          </div>
        </settings-checkbox>

        <template v-if="apiEnabledSetting">
          <settings-input configKey="api.port" type="number" :min="13000" :max="39999" placeholder="13000-39999" class="bg-transparent border-0 -mx-2.5">
            <template v-slot:label>
              API Port
            </template>
          </settings-input>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import SettingsCheckbox from "@/components/SettingsCheckbox.vue";
import SettingsInput from "@/components/SettingsInput.vue";
import { defineComponent, ref } from "vue";

const getStartedEnabled = ref(!!window.settings.get("app.getstarted"));
const apiEnabledSetting = ref(!!window.settings.get("api.enabled"));
const apiPortSetting = ref(window.settings.get("api.port") ?? 13091);
const errorReportingEnabled = ref(window.settings.get("app.enableStatisticsAndErrorTracing"));
let subscribers = [];
subscribers.push(
  ipcRenderer.on("settingsProvider.change", (ev, key, value) => {
    if (key === "api.enabled" && value !== apiEnabledSetting.value) apiEnabledSetting.value = !!value;
    if (key === "api.port" && value !== apiPortSetting.value) apiPortSetting.value = value;
    if (key === "app.enableStatisticsAndErrorTracing") errorReportingEnabled.value = !!value;
  })
);
export default defineComponent({
  components: { SettingsCheckbox, SettingsInput },
  methods: {
    disableGetStarted() {
      window.api.settingsProvider.update("app.getstarted", false).then((v) => {
        this.getStartedEnabled = v;
      });
    },
  },
  setup() {
    return {
      getStartedEnabled,
      apiPortSetting,
      apiEnabledSetting,
      errorReportingEnabled
    };
  },
  unmounted() {
    if (subscribers) {
      subscribers.filter((x) => typeof x === "function").forEach(window.ipcRenderer.off);
      subscribers = [];
    }
  },
});
</script>

<style></style>
