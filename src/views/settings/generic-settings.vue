<template>
  <div class="flex flex-col gap-4">
    <div class="bg-opacity-5 bg-white shadow sm:rounded-lg">
      <div class="px-4 py-5 sm:p-6 mt-4">
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
    <div>
      <div class="p-6 text-gray-100 card">
        <div class="form-control">
          <label class="cursor-pointer label">
            <span class="label-text text-gray-300">Autostart</span>
            <div>
              <input
                type="checkbox"
                checked="checked"
                class="checkbox checkbox-primary"
                v-model="autostartToggle"
              />
              <span class="checkbox-mark"></span>
            </div>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue";

export default defineComponent({
  watch: {},
  setup() {
    const autostartToggle = ref(false);
    // onMounted(async () => {
    //   autostartToggle.value = await (window as any).app.settingsProvider.get(
    //     "app.autoustart",
    //     true
    //   );
    // });
    return {
      autostartToggle,
    };
  },
});
</script>

<style></style>
