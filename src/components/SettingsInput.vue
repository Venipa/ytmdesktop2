<template>
  <div v-bind:class="['form-control', $attrs.class]">
    <label class="label">
      <span class="label-text text-gray-300">
        <slot name="label"></slot>
      </span>
    </label>
    <template v-if="$attrs.type === 'file'">
      <div class="flex space-x-2 items-center">
        <div
          class="text-gray-300 flex-1 bg-white bg-opacity-5 text-sm h-12 rounded-lg flex items-center px-3"
        >
          {{ value }}
        </div>
        <button
          class="btn btn-primary"
          @click="() => fileInputRef && fileInputRef.click()"
        >
          Browse
        </button>
      </div>
      <input
        v-bind:type="$attrs.type"
        v-bind:placeholder="$attrs.placeholder"
        v-bind:accept="$attrs.accept"
        @change="(ev) => updateSetting(ev.target)"
        class="hidden"
        ref="fileInputRef"
      />
    </template>
    <input
      v-else
      v-bind:type="$attrs.type"
      v-bind:placeholder="$attrs.placeholder"
      @change="(ev) => updateSetting(ev.target)"
      v-bind:value="value"
      class="input input-ghost"
    />
  </div>
</template>

<script lang="ts">
import { debounce } from "lodash-es";
import { defineComponent, onMounted, ref } from "vue";

export default defineComponent({
  props: {
    configKey: {
      type: String,
      required: true,
    },
    defaultValue: Object,
  },
  methods: {
    updateSetting: (ev: HTMLInputElement) => null,
  },
  setup(context) {
    const value = ref<any>(),
      fileInputRef = ref<any>();
    onMounted(async () => {
      value.value = await (window as any).api.settingsProvider.get(
        context.configKey,
        context.defaultValue !== undefined ? context.defaultValue : null
      );
    });
    return {
      value,
      fileInputRef,
    };
  },
  created() {
    this.updateSetting = debounce((ev: HTMLInputElement) => {
      if (this.configKey) {
        if (ev.type === "file" && ev.files.length === 0) return;
        const value = ev.type === "file" ? ev.files[0].path : ev.value;
        (window as any).api.settingsProvider.update(this.configKey, value).then(v => this.value = v);
      }
    }, 1500);
  },
});
</script>

<style></style>
