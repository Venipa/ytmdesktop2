<template>
  <div :class="['form-control', $attrs.class]">
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
        <button class="btn btn-primary" @click="() => fileInputRef && fileInputRef.click()">
          Browse
        </button>
      </div>
      <input
        ref="fileInputRef"
        :type="$attrs.type"
        :placeholder="$attrs.placeholder"
        :accept="$attrs.accept"
        class="hidden"
        @change="(ev) => updateSetting(ev.target)"
      />
    </template>
    <input
      v-else
      :type="$attrs.type"
      :placeholder="$attrs.placeholder"
      :value="value"
      class="input input-ghost"
      @change="(ev) => updateSetting(ev.target)"
    />
  </div>
</template>

<script lang="ts">
import { clamp, debounce } from "lodash-es";
import { defineComponent, onMounted, ref } from "vue";

export default defineComponent({
  props: {
    configKey: {
      type: String,
      required: true,
    },
    defaultValue: Object,
    min: Number,
    max: Number,
  },
  setup(context) {
    const value = ref<any>(),
      fileInputRef = ref<any>();
    onMounted(async () => {
      value.value = await (window as any).api.settingsProvider.get(
        context.configKey,
        context.defaultValue !== undefined ? context.defaultValue : null,
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
        let value: any;
        if ((ev.type === "number" && this.min !== undefined) || this.max !== undefined) {
          const minValue = this.min ?? ev.valueAsNumber;
          const maxValue = this.max ?? ev.valueAsNumber;
          value = clamp(Number(ev.value), minValue, maxValue);
        } else {
          value = ev.type === "file" ? ev.files[0].path : ev.value;
        }
        (window as any).api.settingsProvider
          .update(this.configKey, value)
          .then((v) => (this.value = v));
      }
    }, 500);
  },
  methods: {
    updateSetting: (_ev: HTMLInputElement) => null,
  },
});
</script>

<style></style>
