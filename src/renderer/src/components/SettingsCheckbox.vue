<template>
  <div class="form-control">
    <label class="cursor-pointer label">
      <span class="label-text text-gray-300"><slot></slot></span>
      <div>
        <input
          type="checkbox"
          class="checkbox checkbox-primary"
          :checked="value"
          @change="(ev: any) => updateSetting(!!ev.target.checked)"
        />
        <span class="checkbox-mark"></span>
      </div>
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
  },
  setup(context) {
    const value = ref<boolean>();
    onMounted(async () => {
      value.value = await (window as any).api.settingsProvider.get(
        context.configKey,
        context.defaultValue !== undefined ? context.defaultValue : null,
      );
    });
    return {
      value,
    };
  },
  created() {
    this.updateSetting = debounce((value: boolean) => {
      if (this.configKey) {
        (window as any).api.settingsProvider.update(this.configKey, !!value).then((v) => {
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
