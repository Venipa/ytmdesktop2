import IPC_EVENT_NAMES from "@main/utils/eventNames";
import { refIpc } from "@shared/utils/Ipc";
import { logger } from "@shared/utils/console";
import { onMounted, ref } from "vue";

export const refLastFM = () => {
	const stateHandle = ref<NodeJS.Timeout>();

	const [lastFM] = refIpc("LAST_FM_STATUS", {
		defaultValue: { connected: false, name: null, error: null },
		ignoreUndefined: true,
		getInitialValue: async () => {
			return await window.api.action(IPC_EVENT_NAMES.LAST_FM_STATUS);
		},
	});
	const [lastFMState, setFmState] = refIpc<"start" | "change" | boolean | null>(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE, {
		defaultValue: null,
		ignoreUndefined: true,
		onTrigger: (_fmstate, _prevfmstate) => {
			if (typeof _prevfmstate === "string" && typeof _fmstate === "boolean") {
				if (stateHandle.value) clearTimeout(stateHandle.value);
				stateHandle.value = setTimeout(() => {
					setFmState(null);
					logger.debug("clear fm submit state");
				}, 2000);
			}
		},
	});

	const lastFMLoading = ref(false);

	onMounted(() => {
		window.api.action(IPC_EVENT_NAMES.LAST_FM_STATUS).then((status) => {
			lastFM.value = status;
		});
	});

	function authorizeLastFM() {
		if (lastFM.value.connected) {
			window.api.action(IPC_EVENT_NAMES.LAST_FM_PROFILE).finally(() => {
				lastFMLoading.value = false;
			});
			return;
		}
		lastFMLoading.value = true;
		window.api.invoke("lastfm.authorize").finally(() => {
			lastFMLoading.value = false;
		});
	}
	return { lastFMState, setFmState, lastFM, lastFMLoading, authorizeLastFM };
};
