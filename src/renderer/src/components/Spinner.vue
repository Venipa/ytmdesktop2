<template>
  <div :class="spinner({ size })">
    <div className="h-full w-full relative left-1/2 top-1/2">
      <span v-for="i of pillCount"></span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { type VariantProps, cva } from "class-variance-authority";
const pillCount = 12;

const spinner = cva("spinner relative block box-border p-0 m-0", {
	variants: {
		size: {
			default: "size-5",
			sm: "size-4",
			lg: "size-6",
			xl: "size-10",
		},
	},
	compoundVariants: [{ size: "default" }],
});

type SpinnerProps = VariantProps<typeof spinner>;

withDefaults(defineProps<{ size?: SpinnerProps["size"] }>(), {
	size: "default",
});
</script>
<style scoped>
span {
  @apply bg-white;
  border-radius: 4px;
  position: absolute;
  top: -3.9%;
  width: 24%;
  height: 8%;
  left: -10%;
  animation: spinner 1.2s linear 0s infinite normal none running;
}

span:nth-child(1) {
  animation-delay: -1.2s;
  transform: rotate(0deg) translate(146%);
}

span:nth-child(2) {
  animation-delay: -1.1s;
  transform: rotate(30deg) translate(146%);
}

span:nth-child(3) {
  animation-delay: -1s;
  transform: rotate(60deg) translate(146%);
}

span:nth-child(4) {
  animation-delay: -0.9s;
  transform: rotate(90deg) translate(146%);
}

span:nth-child(5) {
  animation-delay: -0.8s;
  transform: rotate(120deg) translate(146%);
}

span:nth-child(6) {
  animation-delay: -0.7s;
  transform: rotate(150deg) translate(146%);
}

span:nth-child(7) {
  animation-delay: -0.6s;
  transform: rotate(180deg) translate(146%);
}

span:nth-child(8) {
  animation-delay: -0.5s;
  transform: rotate(210deg) translate(146%);
}

span:nth-child(9) {
  animation-delay: -0.4s;
  transform: rotate(240deg) translate(146%);
}

span:nth-child(10) {
  animation-delay: -0.3s;
  transform: rotate(270deg) translate(146%);
}

span:nth-child(11) {
  animation-delay: -0.2s;
  transform: rotate(300deg) translate(146%);
}

span:nth-child(12) {
  animation-delay: -0.1s;
  transform: rotate(330deg) translate(146%);
}

@keyframes spinner {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0.15;
  }
}
</style>
