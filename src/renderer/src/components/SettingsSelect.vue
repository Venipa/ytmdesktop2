<template>
  <div class="form-control">
    <label class="flex flex-col space-y-2 label items-start">
      <span v-if="$slots.label" class="label-text text-gray-300">
        <slot name="label"></slot>
      </span>
      <select
        v-if="$slots.options"
        class="select select-bordered w-full"
        :value="value"
        @change="(ev: any) => updateSetting(ev.target.value)"
      >
        <slot name="options"></slot>
      </select>
    </label>
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
		label: String,
	},
	setup(context) {
		const value = ref<string>();
		onMounted(async () => {
			value.value = await (window as any).api.settingsProvider.get(context.configKey, context.defaultValue !== undefined ? context.defaultValue : null);
		});
		return {
			value,
		};
	},
	created() {
		this.updateSetting = debounce((value: string) => {
			if (this.configKey) {
				(window as any).api.settingsProvider.update(this.configKey, value).then((v: any) => {
					(this.value = v), this.$emit("change", v);
				});
			}
		}, 200);
	},
	methods: {
		updateSetting: (_value: boolean) => null,
	},
});
</script>

<style></style>
