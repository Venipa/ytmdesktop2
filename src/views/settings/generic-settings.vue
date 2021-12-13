<template>
  <div class="flex flex-col gap-4">
    <div class="bg-opacity-5 bg-white shadow sm:rounded-lg mt-4" v-if="getStartedEnabled">
      <div class="px-4 py-5 sm:p-6">
        <h3 class="text-lg leading-6 font-medium text-gray-100">
          Get Started
        </h3>
        <div class="mt-2 max-w-xl text-sm text-gray-200">
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Commodi,
            totam at reprehenderit maxime aut beatae ad.
          </p>
        </div>
        <div class="mt-3 text-sm">
          <a href="https://ytmdesktop.app/" target="_blank" class="font-medium text-indigo-400 hover:text-indigo-300">
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
      <settings-checkbox configKey="app.enableDev" class="group">
        <div class="flex flex-col">
          <div>Enable Developer Mode</div>
          <div class="select-none opacity-80 group-hover:opacity-100 text-xs font-medium">... to design or test additional functionality</div>
          <div class="select-none flex flex-col opacity-80 group-hover:opacity-100 text-xs font-medium">
            <div class="flex space-x-1">
              <div class="uppercase font-bold text-red-500">Hold Up!</div> If someone told you to copy/paste something here you have an 11/10 chance you're being scammed.
            </div>
            <div>Pasting anything in the console could give attackers access to your Google/Youtube account.</div>
          </div>
        </div>
      </settings-checkbox>
    </div>
  </div>
</template>

<script lang="ts">
import SettingsCheckbox from "@/components/SettingsCheckbox.vue";
import { defineComponent, onMounted, ref } from "vue";

export default defineComponent({
  components: { SettingsCheckbox },
  methods: {
    disableGetStarted() {
      (window as any).api.settingsProvider.update("app.getstarted", false).then((v) => {
        this.getStartedEnabled = v;
      });
    },
  },
  setup() {
    const getStartedEnabled = ref<boolean>(true);
    onMounted(async () => {
      getStartedEnabled.value = await (window as any).api.settingsProvider.get("app.getstarted", true);
    });
    return {
      getStartedEnabled,
    };
  },
});
</script>

<style></style>
