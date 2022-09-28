<template>
  <div class="h-full absolute inset-0 overflow-hidden bg-black flex flex-col">
    <div class="relative">
      <control-bar title="Mini Player" class="bg-transparent border-b-0 z-20 relative">
        <template #icon>
          <MiniPlayerIcon />
        </template>
        <template #divider>
          <span
            class="border border-zinc-600 rounded h-6 leading-5 px-2.5 text-xs uppercase font-semibold"
          >
            Beta
          </span>
        </template>
      </control-bar>
      <div
        class="absolute h-48 inset-x-0 bg-gradient-to-b from-black to-black/0 -top-32 z-10"
      ></div>
    </div>
    <div
      class="absolute inset-0 bg-no-repeat bg-cover bg-center opacity-20 scale-125 blur-lg"
      v-if="thumbnail"
      :style="{ backgroundImage: `url(${thumbnail})` }"
    ></div>
    <div class="flex flex-col flex-1">
      <div class="flex flex-col relative z-10 pt-8 px-4 flex-1">
        <div class="flex items-start space-x-4">
          <div
            class="track-thumbnail flex flex-shrink-0 items-center justify-center relative overflow-hidden"
          >
            <template v-if="trackBusy">
              <div class="absolute inset-0 flex items-center justify-center z-10 bg-zinc-800/80">
                <Loading />
              </div>
            </template>
            <img
              :src="thumbnail"
              alt=""
              class="absolute inset-0 h-full w-full"
              loading="lazy"
              v-if="thumbnail"
            />
            <div v-else class="absolute inset-0">
              <MiniPlayerIcon class="w-24 h-24 md:w-40 md:h-40 text-zinc-50" />
            </div>
          </div>
          <div class="flex flex-col flex-1 h-full">
            <div class="min-w-0 flex-auto space-y-1 font-semibold" v-if="track?.video">
              <h2 class="text-zinc-400 text-sm md:text-base lg:text-lg leading-6 truncate">
                {{ track.video.title }}
              </h2>
              <p class="text-zinc-50 text-lg">{{ track.video.author }}</p>
              <div
                class="text-zinc-400 text-sm space-x-1 flex items-center whitespace-pre"
                v-if="time"
              >
                <p class="track-status-time">{{ time[0] }}</p>
                <span>/</span>
                <p class="track-status-time">{{ time[1] }}</p>
              </div>
            </div>
            <div class="mt-auto flex-shrink-0">
              <button
                type="button"
                class="player-btn"
                :class="{ active: !!playState?.liked }"
                @click="likeToggle"
                :disabled="trackBusy"
                v-if="playState?.liked !== undefined"
                aria-label="Like"
              >
                <LikeIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="flex flex-col relative z-10">
        <div class="group pt-4 -mt-4" v-if="time">
          <div
            class="h-1 group-hover:h-2 bg-white transition-all ease-in-out duration-150"
            :style="{ width: `${time[2]}%`, maxWidth: '100%' }"
            ref="progressHandle"
          ></div>
        </div>
        <div class="bg-zinc-50/5 mt-auto text-zinc-200 flex items-center h-16">
          <div class="flex-auto flex items-center justify-evenly">
            <button
              type="button"
              class="player-btn"
              :disabled="trackBusy"
              @click="prev"
              aria-label="Previous"
            >
              <PrevIcon />
            </button>
            <button
              type="button"
              class="player-btn"
              :disabled="trackBusy"
              @click="() => backward()"
              aria-label="Rewind 10 seconds"
            >
              <BackwardIcon />
            </button>
          </div>
          <button
            type="button"
            class="player-btn-hero"
            aria-label="Pause"
            :disabled="trackBusy"
            @click="() => (!playing ? play() : pause())"
          >
            <div class="fill-icon fill-zinc-700">
              <template v-if="playing">
                <PauseIcon />
              </template>
              <template v-else>
                <PlayIcon />
              </template>
            </div>
          </button>
          <div class="flex-auto flex items-center justify-evenly">
            <button
              type="button"
              class="player-btn"
              :disabled="trackBusy"
              @click="() => forward()"
              aria-label="Skip 10 seconds"
            >
              <ForwardIcon />
            </button>
            <button
              type="button"
              class="player-btn"
              @click="next"
              :disabled="trackBusy"
              aria-label="Next"
            >
              <NextIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import ControlBar from "@/components/ControlBar.vue";
import Loading from "@/components/Loading.vue";
import MiniPlayerIcon from "@/assets/icons/mini-player.svg";
import PlayIcon from "@/assets/icons/play.svg";
import PauseIcon from "@/assets/icons/pause.svg";
import NextIcon from "@/assets/icons/next.svg";
import PrevIcon from "@/assets/icons/prev.svg";
import ForwardIcon from "@/assets/icons/forward10.svg";
import LikeIcon from "@/assets/icons/like.svg";
import BackwardIcon from "@/assets/icons/backward10.svg";
import { TrackData } from "@/app/utils/trackData";
import { refIpc } from "@/utils/Ipc";
import { defineComponent, onMounted, ref } from "vue";
import { intervalToDuration } from "date-fns";
const zeroPad = (num) => String(num).padStart(2, "0");
const createInterval = (dts: number[]): [string, number] => [
  dts
    .filter((p, i) => (i === 0 ? Boolean(p) : true))
    .map(zeroPad)
    .join(":"),
  dts.length,
];
export default defineComponent({
  components: {
    ControlBar,
    MiniPlayerIcon,
    PlayIcon,
    PauseIcon,
    NextIcon,
    PrevIcon,
    ForwardIcon,
    LikeIcon,
    BackwardIcon,
    Loading,
  },
  computed: {
    thumbnail() {
      return this.track?.video.thumbnail.thumbnails[0]?.url;
    },
    playing() {
      return !!this.playState?.playing;
    },
    time(): [string, string, number] {
      const { duration, uiProgress: progress } = this.playState ?? {};
      if (typeof duration !== "number" || typeof progress !== "number") return null;
      const [current] = (({ hours, minutes, seconds }) =>
        createInterval([hours, minutes, seconds]))(
        intervalToDuration({
          start: duration * 1000 - (progress > duration ? duration : Math.floor(progress)) * 1000,
          end: duration * 1000,
        })
      );
      const [end, endPad] = (({ hours, minutes, seconds }) =>
        createInterval([hours, minutes, seconds]))(
        intervalToDuration({ start: 0, end: duration * 1000 })
      ) as [string, number];
      const timePad = endPad * 2;
      const percentage = ((progress > duration ? duration : progress) / duration) * 100;
      return [current.padEnd(timePad), end.padStart(timePad), percentage];
    },
  },
  setup() {
    const [track, setTrack] = refIpc<TrackData>("TRACK_CHANGE", {
      ignoreUndefined: true,
      defaultValue: null
    });
    const [playState, setPlayState] = refIpc<{
      playing: boolean;
      progress: number;
      duration: number;
      liked: boolean;
    }>("TRACK_PLAYSTATE");
    const trackBusy = ref(false);
    onMounted(() => {
      document.title = `YouTube Music - Mini Player`;
      Promise.all([
        window.ipcRenderer.invoke("api/track"),
        window.ipcRenderer.invoke("api/track/state"),
      ]).then(([trackData, playStateData]) => {
        setTrack(trackData);
        setPlayState(playStateData);
      });
    });
    const progressHandle = ref<HTMLElement>(null);
    return {
      track,
      trackBusy,
      playState,
      progressHandle,
      next() {
        trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/next").finally(() => {
          trackBusy.value = false;
        });
      },
      prev() {
        trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/prev").finally(() => {
          trackBusy.value = false;
        });
      },
      forward(time = 10000) {
        trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/forward", { time }).finally(() => {
          trackBusy.value = false;
        });
      },
      backward(time = 10000) {
        trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/backward", { time }).finally(() => {
          trackBusy.value = false;
        });
      },
      pause() {
        // trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/pause").finally(() => {
          // trackBusy.value = false;
        });
      },
      play() {
        // trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/play").finally(() => {
          // trackBusy.value = false;
        });
      },
      likeToggle() {
        if (typeof playState.value?.liked !== "boolean") return;
        trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/like", !playState.value.liked).finally(() => {
          trackBusy.value = false;
        });
      },
      setCurrentTime(ev: PointerEvent) {
        if (!this.playState) return;
        const [el, progress] = [ev.currentTarget as HTMLDivElement, progressHandle.value];
        const percSelected = ev.x / el.clientWidth;
        const percCurrent = progress.clientWidth / el.clientWidth;
        const { duration } = this.playState;
        const seekTime = Math.floor(duration * (percSelected - percCurrent)) * 1000;
        console.log({
          progressMax: el.clientWidth,
          progressValue: progress.clientWidth,
          value: ev.x,
          duration,
        });
        trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/seek", seekTime).finally(() => {
          trackBusy.value = false;
        });
      },
    };
  },
});
</script>

<style lang="scss">
.track-status-time {
  @apply min-w-[40px];
}
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
    @apply border border-zinc-600 text-zinc-200 flex-none mx-auto w-10 h-10 rounded-full ring-1 ring-zinc-900/5 shadow-md flex items-center justify-center transition ease-in-out duration-100;
    svg {
      @apply h-6 w-6;
    }
    &:disabled,
    &.disabled {
      @apply opacity-60 scale-100;
    }

    &:active {
      @apply transform-gpu scale-95 border-zinc-50/90;
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

.track-thumbnail {
  @apply w-40 h-40 md:h-72 md:w-72 flex-none rounded-lg bg-zinc-800;
  img {
    @apply object-cover object-center;
  }
}
</style>
