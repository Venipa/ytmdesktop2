<template>
  <div class="flex flex-col gap-4">
    <div class="bg-opacity-5 bg-white shadow sm:rounded-lg">
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
          <a
            href="https://ytmdesktop.app/"
            target="_blank"
            class="font-medium text-indigo-400 hover:text-indigo-300"
          >
            Learn more about our features
            <span aria-hidden="true">&rarr;</span></a
          >
        </div>
      </div>
    </div>
    <div class="px-3">
      <div class="form-control">
        <label class="cursor-pointer label">
          <span class="label-text text-gray-300">Autostart</span>
          <div>
            <input
              type="checkbox"
              class="checkbox checkbox-primary"
              v-bind:checked="appConfig.autostart"
              @change="
                (ev) => updateSetting('app.autostart', !!ev.target.checked)
              "
            />
            <span class="checkbox-mark"></span>
          </div>
        </label>
      </div>
      <div class="flex flex-row justify-end mt-6">
        <button class="btn btn-sm btn-primary">Save Changes</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue";

export default defineComponent({
  methods: {
    updateSetting(key: string, value: any) {
      (window as any).app.settingsProvider.set(key, value);
    },
  },
  setup() {
    const appConfig = ref<{ [key: string]: any }>({});
    onMounted(async () => {
      appConfig.value = await (window as any).app.settingsProvider
        .get("app", true);
    });
    return {
      appConfig,
    };
  }
});
</script>

<style></style>
