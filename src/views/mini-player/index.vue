<template>
  <div class="h-full absolute inset-0 overflow-hidden bg-black flex flex-col">
    <div class="relative">
      <control-bar title="Mini Player"
                   class="bg-transparent border-b-0 z-20 relative">
        <template #icon>
          <MiniPlayerIcon />
        </template>
        <template #divider>
          <span></span>
        </template>
      </control-bar>
      <div class="absolute h-48 inset-x-0 bg-gradient-to-b from-black to-black/0 -top-32 z-10"></div>
    </div>
    <div class="absolute inset-0 bg-no-repeat bg-cover bg-center opacity-20 scale-110 blur-lg"
         v-if="thumbnail"
         :style="{ backgroundImage: `url(${thumbnail})` }">
    </div>
    <div class="flex flex-col flex-1">
      <div class="flex flex-col relative z-10 pt-8 px-4 flex-1">
        <div class="flex items-start space-x-4">
          <img :src="thumbnail ? thumbnail : null"
               alt=""
               class="w-40 h-40 md:h-72 md:w-72 object-cover object-center flex-none rounded-lg bg-zinc-800"
               loading="lazy" />
          <div class="flex flex-col flex-1 h-full">
            <div class="min-w-0 flex-auto space-y-1 font-semibold"
                 v-if="track?.video">
              <h2 class="text-zinc-400 text-sm md:text-base lg:text-lg leading-6 truncate">{{ track.video.title }}</h2>
              <p class="text-zinc-50 text-lg"> {{ track.video.author }} </p>
              <div class="text-zinc-400 text-sm space-x-1 flex items-center"
                   v-if="time">
                <p>{{ time[1] }}</p>
              </div>
            </div>
            <div class="mt-auto flex-shrink-0">
              <button type="button"
                      class="player-btn"
                      :class="{ 'active': !!playState?.liked }"
                      @click="likeToggle"
                      :disabled="trackBusy"
                      aria-label="Like">
                <LikeIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="bg-zinc-50/5 mt-auto text-zinc-200 rounded-b-xl flex items-center relative z-10">
        <div class="flex-auto flex items-center justify-evenly">
          <button type="button"
                  class="player-btn"
                  :disabled="trackBusy"
                  @click="prev"
                  aria-label="Previous">
            <PrevIcon />
          </button>
          <button type="button"
                  class="player-btn"
                  :disabled="trackBusy"
                  @click="() => backward()"
                  aria-label="Rewind 10 seconds">
            <BackwardIcon />
          </button>
        </div>
        <button type="button"
                class="player-btn-hero"
                aria-label="Pause"
                :disabled="trackBusy"
                @click="() => !playing ? play() : pause()">
          <div class="h-10 w-10 fill-icon fill-zinc-700">
            <template v-if="playing">
              <PauseIcon />
            </template>
            <template v-else>
              <PlayIcon />
            </template>
          </div>
        </button>
        <div class="flex-auto flex items-center justify-evenly">
          <button type="button"
                  class="player-btn"
                  :disabled="trackBusy"
                  @click="() => forward()"
                  aria-label="Skip 10 seconds">
            <ForwardIcon />
          </button>
          <button type="button"
                  class="player-btn"
                  @click="next"
                  :disabled="trackBusy"
                  aria-label="Next">
            <NextIcon />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
// @ts-ignore
import ControlBar from "@/components/ControlBar";
// @ts-ignore
import MiniPlayerIcon from "@/assets/icons/mini-player.svg";
// @ts-ignore
import PlayIcon from "@/assets/icons/play.svg";
// @ts-ignore
import PauseIcon from "@/assets/icons/pause.svg";

// @ts-ignore
import NextIcon from "@/assets/icons/next.svg";
// @ts-ignore
import PrevIcon from "@/assets/icons/prev.svg";

// @ts-ignore
import ForwardIcon from "@/assets/icons/forward10.svg";
// @ts-ignore
import LikeIcon from "@/assets/icons/like.svg";

// @ts-ignore
import BackwardIcon from "@/assets/icons/backward10.svg";
import { TrackData } from "@/app/utils/trackData";
import { refIpc } from "@/utils/Ipc";
import { defineComponent, onMounted, ref } from "vue";
import { intervalToDuration } from "date-fns";
const zeroPad = (num) => String(num).padStart(2, '0');
const createInterval = (dts: number[]) => dts.filter(Boolean)
  .map(zeroPad)
  .join(':');
export default defineComponent({
  components: { ControlBar, MiniPlayerIcon, PlayIcon, PauseIcon, NextIcon, PrevIcon, ForwardIcon, LikeIcon, BackwardIcon },
  computed: {
    thumbnail() {
      return this.track?.video.thumbnail.thumbnails[0]?.url;
    },
    playing() {
      return !!this.playState?.playing;
    },
    time() {
      const { duration, progress } = this.playState ?? {};
      if (!duration || !progress) return null;
      const current = (({ hours, minutes, seconds }) => createInterval([hours, minutes, seconds]))(intervalToDuration({ start: (progress > duration ? duration : progress) * 1000, end: duration * 1000 }));
      const end = (({ hours, minutes, seconds }) => createInterval([hours, minutes, seconds]))(intervalToDuration({ start: 0, end: duration * 1000 }));
      return [current, end]
    }
  },
  setup() {
    const [track, setTrack] = refIpc<TrackData>("TRACK_CHANGE", { ignoreUndefined: true, defaultValue: null });
    const [playState, setPlayState] = refIpc<{ playing: boolean, progress: number, duration: number, liked: boolean }>("TRACK_PLAYSTATE");
    const trackBusy = ref(false);
    onMounted(() => {
      window.ipcRenderer.invoke("api/track").then(data => {
        setTrack(data);
      }).then(() =>
        new Promise<void>((resolve) => setTimeout(() => {
          resolve();
        }, 1000)).then(() => window.ipcRenderer.invoke("api/track/state").then(data => {
          setPlayState(data);
        })))
    })
    return {
      track,
      trackBusy,
      playState,
      next() {
        trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/next").finally(() => {
          trackBusy.value = false;
        })
      },
      prev() {
        trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/prev").finally(() => {
          trackBusy.value = false;
        })
      },
      forward(time = 10000) {
        trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/forward", { time }).finally(() => {
          trackBusy.value = false;
        })
      },
      backward(time = 10000) {
        trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/backward", { time }).finally(() => {
          trackBusy.value = false;
        })
      },
      pause() {
        trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/pause").finally(() => {
          trackBusy.value = false;
        })
      },
      play() {
        trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/play").finally(() => {
          trackBusy.value = false;
        })
      },
      likeToggle() {
        trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/like", !playState.value.liked).finally(() => {
          trackBusy.value = false;
        })
      }
    };
  },
});
</script>

<style lang="scss">
.player-btn {
  @apply h-10 w-10 text-zinc-200 p-2 cursor-pointer flex items-center justify-center rounded-lg transition ease-in-out duration-100;

  &:hover {
    @apply bg-zinc-50/5;
  }

  &:active {

    @apply transform-gpu scale-95 bg-zinc-50/10;
  }

  &:disabled,
  &.disabled {
    @apply opacity-60 scale-100;
  }

  &.active {
    svg {
      @apply fill-zinc-100;

      path {
        @apply stroke-transparent;
      }
    }
  }

  &-hero {
    @apply bg-zinc-100 text-zinc-700 flex-none -mt-6 mb-4 mx-auto w-20 h-20 rounded-full ring-1 ring-zinc-900/5 shadow-md flex items-center justify-center transition ease-in-out duration-100;

    &:disabled,
    &.disabled {
      @apply opacity-60 scale-100;
    }

    &:active {

      @apply transform-gpu scale-95 bg-zinc-50/90;
    }
  }
}

.fill-icon {
  svg {
    @apply fill-current;

    path {
      @apply stroke-transparent;
    }
  }
}
</style>