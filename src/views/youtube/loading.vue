<template>
  <div class="h-full overflow-hidden flex items-center justify-center">
    <div class="loader-wrapper">
      <div class="loader-logo"></div>
      <div class="loader">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  components: {},
  beforeRouteLeave() {
    return;
  },
  methods: {},
  created() {},
});
</script>

<style lang="scss">
html,
body {
  @apply overflow-hidden;
}
@keyframes loadBarAnimate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
<style lang="scss" scoped>
$size: 100px;
$borderSize: 10px;
.loader-wrapper {
  position: relative;
  width: $size;
  height: $size;
  .loader {
    position: relative;
    width: $size;
    height: $size;
    border-radius: 50%;
    background: linear-gradient(#9F43CD, #ff3b3b, #DDBCED);
    animation: loadBarAnimate 1s linear infinite;
  }
  .loader-logo {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background-image: url(../../assets/logo.png);
    background-size: #{$size - $borderSize*2} #{$size - $borderSize*2};
    background-position: center;
    background-repeat: no-repeat;
    z-index: 999;
  }
  .loader span {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: linear-gradient(#9F43CD, #ff3b3b, #DDBCED);
    animation: loadBarAnimate 1s linear infinite;
  }

  .loader span:nth-child(1) {
    filter: blur(5px);
  }

  .loader span:nth-child(2) {
    filter: blur(10px);
  }

  .loader span:nth-child(3) {
    filter: blur(25px);
  }

  .loader span:nth-child(4) {
    filter: blur(50px);
  }

  .loader::after {
    content: "";
    position: absolute;
    top: $borderSize;
    left: $borderSize;
    right: $borderSize;
    bottom: $borderSize;
    background: #240229;
    border-radius: 50%;
  }
}
</style>