import definePlugin from "@plugins/utils";
import { onLikeStatusSettled, queryLikeRenderer, readLikeStatus, readPlayerVideoId, readRawLikeStatus } from "./ytm-like-status";

const POLL_MS = 250;
const MAX_WAIT_MS = 3_000;

export default definePlugin(
	"track-skip-disliked",
	{
		enabled: true,
		displayName: "Track Skip Disliked",
	},
	{
		exec({ settings, log }) {
			let lastVideoId: string | null = null;
			let session: {
				videoId: string;
				baseline: string;
				startedAt: number;
				timer: ReturnType<typeof setTimeout>;
				observer: MutationObserver | null;
			} | null = null;

			const stopSession = () => {
				if (!session) return;
				clearTimeout(session.timer);
				session.observer?.disconnect();
				session = null;
			};

			const finish = (videoId: string, reason: string) => {
				if (session?.videoId !== videoId) return;
				if (!settings.player?.skipDisliked) {
					stopSession();
					return;
				}
				const activeId = readPlayerVideoId();
				if (activeId && activeId !== videoId) {
					stopSession();
					return;
				}
				const status = readLikeStatus();
				if (!status.settled) return;
				if (status.disliked) {
					log.debug("skip disliked track", videoId, reason);
					window.domUtils.playerApi()?.nextVideo();
				}
				stopSession();
			};

			const watch = (videoId: string) => {
				stopSession();
				const el = queryLikeRenderer();
				const baseline = readRawLikeStatus(el);
				const startedAt = Date.now();

				const tick = () => {
					if (session?.videoId !== videoId) return;
					const elapsed = Date.now() - startedAt;
					const status = readLikeStatus();
					const raw = readRawLikeStatus();
					const mutated = raw !== "" && raw !== baseline;

					if (mutated && status.settled) {
						finish(videoId, "status-mutated");
						return;
					}

					// Consecutive disliked tracks often keep DISLIKE — skip after wait.
					if (elapsed >= MAX_WAIT_MS) {
						if (status.settled && status.disliked) finish(videoId, "timeout");
						else stopSession();
						return;
					}

					session!.timer = setTimeout(tick, POLL_MS);
				};

				const observer =
					el &&
					new MutationObserver(() => {
						const raw = readRawLikeStatus(queryLikeRenderer());
						if (raw !== "" && raw !== baseline) finish(videoId, "observer");
					});
				if (el && observer) {
					observer.observe(el, { attributes: true, attributeFilter: ["like-status", "like_status"] });
				}

				session = {
					videoId,
					baseline,
					startedAt,
					observer: observer || null,
					timer: setTimeout(tick, POLL_MS),
				};
			};

			const onTrackIdChange = (_ev: unknown, id: string) => {
				if (!id || !settings.player?.skipDisliked) return;
				if (lastVideoId === id) return;
				lastVideoId = id;
				watch(id);
			};

			const unsubLike = onLikeStatusSettled(({ videoId, disliked }) => {
				if (!settings.player?.skipDisliked) return;
				if (!session || session.videoId !== videoId) return;
				if (disliked) finish(videoId, "like-settled");
				else stopSession();
			});

			window.ipcRenderer.on("trackId:change", onTrackIdChange);
			return () => {
				stopSession();
				unsubLike();
				window.ipcRenderer.off("trackId:change", onTrackIdChange);
			};
		},
	},
);
