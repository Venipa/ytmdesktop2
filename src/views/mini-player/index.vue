<template>
  <div
    class="h-full absolute inset-0 overflow-hidden bg-black flex flex-col"
    :style="{
      ...(accentColor && showWinBorder ? { border: `1px solid ${accentColor}` } : {}),
    }"
  >
    <div class="relative">
      <control-bar title="Mini Player" class="bg-transparent border-b-0 z-20 pl-4 relative group">
        <template #icon>
          <MiniPlayerIcon class="antialiased" />
        </template>
        <template #divider>
          <span
            class="border border-zinc-600 rounded h-6 leading-5 px-2.5 text-xs uppercase font-semibold"
            :style="{ ...(accentColor ? { borderColor: `${accentColor}80` } : {}) }"
          >
            Beta
          </span>

          <button
            @click="() => toggleStayTop()"
            class="control-button relative w-4 group-hover:w-auto group-hover:px-2 group-hover:space-x-2 h-4"
          >
          <LockIcon class="group-hover:opacity-100" v-if="isTop"></LockIcon>
          <UnLockIcon class="opacity-60" v-else></UnLockIcon>
            <span class="hidden group-hover:flex text-sm">Stay on Top</span>
          </button>
        </template>
      </control-bar>
      <div
        class="absolute h-48 inset-x-0 bg-gradient-to-b from-black to-black/0 -top-32 z-10"
      ></div>
    </div>

    <div class="absolute inset-0">
      <div
        class="absolute inset-0 opacity-[.25]"
        :style="{
          backgroundColor: `${accentColor}`,
        }"
        v-if="thumbnail && accentColor"
      ></div>
      <div
        class="absolute inset-0 bg-no-repeat bg-cover bg-center opacity-[.25] scale-125 blur-[8px]"
        v-if="thumbnail"
        :style="{ backgroundImage: `url(${thumbnail})` }"
      ></div>
    </div>
    <div class="flex flex-col flex-1">
      <div class="flex flex-col relative z-10 px-6 flex-1 centeronscreen">
        <div class="flex items-start space-x-6">
          <div
            class="track-thumbnail flex flex-shrink-0 items-center shadow justify-center relative"
          >
            <template v-if="trackBusy">
              <div
                class="absolute inset-0 flex items-center justify-center z-10 rounded-[inherit] overflow-hidden"
              >
                <div class="absolute inset-0 bg-black/50 z-[1]"></div>
                <div
                  class="absolute inset-0 bg-zinc-800/80 z-[2]"
                  :style="{
                    ...(accentColor ? { backgroundColor: `${accentColor}20` } : {}),
                  }"
                ></div>
                <Loading class="z-[5]" />
              </div>
            </template>
            <template v-if="thumbnail">
              <div
                class="absolute inset-0 rounded-[inherit] z-[1]"
                v-if="accentColor"
                :style="{
                  boxShadow: `10px 12px 12px -2px ${accentColor}50, 0 0 0 .1rem ${accentColor}`,
                }"
              ></div>
              <div
                class="absolute -inset-2 rounded-xl z-[2]"
                v-if="accentColor"
                :style="{
                  backgroundImage: `linear-gradient(${accentColor}a0, ${accentColor}00, ${accentColor}10, ${accentColor}f0)`,
                }"
              ></div>
              <div class="absolute inset-0 rounded-[inherit] overflow-hidden">
                <img
                  class="absolute inset-0 h-full w-full object-center object-cover opacity-[.5] scale-[1.12] blur-[4px] z-[5]"
                  :src="thumbnail"
                  alt=""
                  @load="handleAccent"
                  loading="lazy"
                />
              </div>
              <img
                :src="thumbnail"
                alt=""
                class="w-full object-center object-contain z-[6] rounded-[inherit]"
                loading="lazy"
              />
            </template>
            <div v-else class="absolute inset-0 flex items-center justify-center rounded-[inherit]">
              <MiniPlayerIcon
                class="w-24 h-24 md:w-40 md:h-40 text-zinc-50"
                :style="{
                  ...(accentColor ? { color: accentColor } : {}),
                }"
              />
            </div>
          </div>
          <div class="flex flex-col flex-1 h-full truncate">
            <div class="min-w-0 flex-auto space-y-1 font-semibold truncate" v-if="track?.video">
              <h2 class="text-zinc-50 text-lg truncate">
                {{ track.video.title }}
              </h2>
              <p class="text-zinc-400 text-sm md:text-base lg:text-lg leading-6 truncate">
                by {{ track.video.author }}
              </p>
              <div
                class="text-zinc-400 text-sm space-x-1 flex items-center whitespace-pre"
                v-if="time"
              >
                <p class="track-status-time tabular-nums">{{ time[0] }}</p>
                <span>/</span>
                <p class="track-status-time tabular-nums">{{ time[1] }}</p>
              </div>
            </div>
            <div class="flex items-center space-x-2 mt-auto flex-shrink-0">
              <button
                type="button"
                class="player-btn"
                :class="{ active: !!playState?.disliked }"
                @click="dislikeToggle"
                :disabled="trackBusy"
                v-if="playState?.disliked !== undefined"
                aria-label="Dislike"
                :style="{
                  ...(accentColor && !!playState?.disliked
                    ? { color: accentColor, stroke: '#fff' }
                    : {}),
                }"
              >
                <LikeIcon class="rotate-180" />
              </button>
              <button
                type="button"
                class="player-btn"
                :class="{ active: !!playState?.liked }"
                @click="likeToggle"
                :disabled="trackBusy"
                :style="{
                  ...(accentColor && !!playState?.liked
                    ? { color: accentColor, stroke: '#fff' }
                    : {}),
                }"
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
            :style="{
              width: `${time[2]}%`,
              maxWidth: '100%',
              ...(accentColor ? { backgroundColor: accentColor } : {}),
            }"
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
            :style="{
              ...(accentColor ? { borderColor: accentColor } : {}),
            }"
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
import { TrackData } from "@/app/utils/trackData";
import BackwardIcon from "@/assets/icons/backward10.svg";
import ForwardIcon from "@/assets/icons/forward10.svg";
import LikeIcon from "@/assets/icons/like.svg";
import LockIcon from "@/assets/icons/lock.svg";
import MiniPlayerIcon from "@/assets/icons/mini-player.svg";
import NextIcon from "@/assets/icons/next.svg";
import PauseIcon from "@/assets/icons/pause.svg";
import PlayIcon from "@/assets/icons/play.svg";
import PrevIcon from "@/assets/icons/prev.svg";
import UnLockIcon from "@/assets/icons/unlock.svg";
import ControlBar from "@/components/ControlBar.vue";
import Loading from "@/components/Loading.vue";
import { refIpc } from "@/utils/Ipc";
import { intervalToDuration } from "date-fns";
import { defineComponent, onMounted, ref } from "vue";
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
    LockIcon,
    UnLockIcon,
    Loading,
  },
  computed: {
    thumbnail() {
      return this.track?.meta?.thumbnail;
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
      defaultValue: null,
    });
    const accentColor = ref<string | null>(null);
    const [playState, setPlayState] = refIpc<{
      playing: boolean;
      progress: number;
      duration: number;
      liked: boolean;
      disliked: boolean;
    }>("TRACK_PLAYSTATE");
    const showWinBorder = ref(false);
    const trackBusy = ref(false);
    const isTop = ref(false);
    onMounted(() => {
      document.title = `YouTube Music - Mini Player`;
      Promise.all([
        window.ipcRenderer.invoke("api/track"),
        window.ipcRenderer.invoke("api/track/state"),
        window.process.isWin11(),
        window.ipcRenderer.invoke("miniplayer.stayOnTop"),
      ]).then(([trackData, playStateData, isWin11, stayTop]) => {
        setTrack(trackData);
        setPlayState(playStateData);
        showWinBorder.value = window.process.platform === "win32" ? !isWin11 : false;
        isTop.value = stayTop;
      });
    });
    const progressHandle = ref<HTMLElement>(null);
    return {
      track,
      trackBusy,
      playState,
      progressHandle,
      accentColor,
      showWinBorder,
      isTop,
      next() {
        trackBusy.value = true;
        return window.ipcRenderer
          .invoke("api/track/next")
          .finally(() => {
            trackBusy.value = false;
          })
          .then(() => {
            playState.value.progress = 0;
          });
      },
      prev() {
        trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/prev").finally(() => {
          trackBusy.value = false;
          playState.value.progress = 0;
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
      dislikeToggle() {
        if (typeof playState.value?.disliked !== "boolean") return;
        trackBusy.value = true;
        return window.ipcRenderer
          .invoke("api/track/dislike", !playState.value.disliked)
          .finally(() => {
            trackBusy.value = false;
          });
      },
      likeToggle() {
        if (typeof playState.value?.liked !== "boolean") return;
        trackBusy.value = true;
        return window.ipcRenderer.invoke("api/track/like", !playState.value.liked).finally(() => {
          trackBusy.value = false;
        });
      },
      handleAccent(ev: Parameters<HTMLImageElement["onload"]>[0]) {
        const src = (ev.target as HTMLImageElement).src;
        if (src) {
          window.ipcRenderer.invoke("api/track/accent").then((clr) => {
            this.accentColor = clr || null;
            console.log("Accent", clr);
          });
        }
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
      async toggleStayTop() {
        const result = await window.api.action("miniplayer.stayOnTop");
        isTop.value = result;
      },
      action(actionParam, ...params) {
        return window.api.action(actionParam, ...params);
      },
      invoke(invokeParam, ...params) {
        return window.api.invoke(invokeParam, ...params);
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
      @apply fill-current;

      path {
        @apply stroke-inherit;
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

.centeronscreen {
  @apply flex flex-col justify-center;
}

.track-thumbnail {
  @apply flex-none rounded-lg bg-zinc-800;

  height: calc(100vh - 10rem);
  width: calc(100vh - 10rem);
  max-width: calc(100vw - 16rem);
  max-height: calc(100vw - 16rem);

  img {
    @apply object-cover object-center;
  }
}
</style>
