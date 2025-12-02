<template>
  <div :class="['form-control', $attrs.class]">
    <label class="label">
      <span class="label-text text-gray-300">
        <slot name="label"></slot>
      </span>
    </label>
    <template v-if="$attrs.type === 'file'">
      <div class="flex space-x-2 items-center">
        <div class="text-gray-300 flex-1 bg-white bg-opacity-5 text-sm h-12 rounded-lg flex items-center px-3"> {{ value }} </div>
        <button class="btn btn-primary"
                @click="() => fileInputRef && fileInputRef.click()"> Browse </button>
      </div>
      <input ref="fileInputRef"
             :type="$attrs.type"
             :placeholder="$attrs.placeholder as string"
             :accept="$attrs.accept as string"
             class="hidden"
             @change="(ev) => updateSetting(ev.target as any)" />
    </template>
    <input v-else
           :type="$attrs.type as string"
           :placeholder="$attrs.placeholder as string"
           :value="value"
           class="input input-ghost"
           @change="(ev) => updateSetting(ev.target as any)" />
    <slot name="hint"></slot>
  </div>
</template>
<script lang="ts">
import { clamp, debounce } from "lodash-es";
import { defineComponent, onBeforeMount, ref } from "vue";

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
		onBeforeMount(async () => {
			const res = await (window as any).api.settingsProvider.get(context.configKey, context.defaultValue ?? null);
			value.value = res;
			console.log({ value: value.value });
		});
		const updateSetting = ref<(_ev: HTMLInputElement) => null>(
			debounce((ev: HTMLInputElement) => {
				if (context.configKey) {
					if (ev.type === "file" && ev.files.length === 0) return;
					let inputValue: any;
					if ((ev.type === "number" && context.min !== undefined) || context.max !== undefined) {
						const minValue = context.min ?? ev.valueAsNumber;
						const maxValue = context.max ?? ev.valueAsNumber;
						inputValue = clamp(Number(ev.value), minValue, maxValue);
					} else {
						inputValue = ev.type === "file" ? window.api.getPathFromFile(ev.files[0]) : ev.value;
					}
					(window as any).api.settingsProvider.update(context.configKey, inputValue).then((v) => (value.value = inputValue = v));
				}
			}, 500) as any,
		);
		return {
			value,
			fileInputRef,
			updateSetting,
		};
	},
});
</script>
<style></style>
