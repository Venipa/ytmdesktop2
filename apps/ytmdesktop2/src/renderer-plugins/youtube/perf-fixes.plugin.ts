import definePlugin from "@plugins/utils";
import cpuTamerByAnimationFrameSrc from "@plugins/scripts/cpu-tamer/cpu-tamer-by-animationframe.js?raw";
import cpuTamerByDomMutationSrc from "@plugins/scripts/cpu-tamer/cpu-tamer-by-dom-mutation.js?raw";
import rm3Src from "@plugins/scripts/rm3/rm3.js?raw";
import { moduleSourceToIife } from "./world0/run-script";

function isGpuAccelerationAvailable(): boolean {
	try {
		const canvas = document.createElement("canvas");
		return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
	} catch {
		return false;
	}
}

/**
 * Inject AFTER ytmd-ready / loadEnd via preload createAndRunScript
 * (page Trusted Types blocks script.textContent / bare eval).
 */
export default definePlugin(
	"perf-fixes",
	{
		displayName: "Performance fixes",
		enabled: true,
	},
	{
		afterInit({ domUtils, log }) {
			let started = false;
			const inject = () => {
				if (started) return;
				started = true;
				const rm3Iife = moduleSourceToIife(rm3Src, "injectRm3();");
				const useGpu = isGpuAccelerationAvailable();
				const cpuSrc = useGpu ? cpuTamerByAnimationFrameSrc : cpuTamerByDomMutationSrc;
				const cpuInvoke = useGpu ? "injectCpuTamerByAnimationFrame(null);" : "injectCpuTamerByDomMutation(null);";
				const cpuIife = moduleSourceToIife(cpuSrc, cpuInvoke);

				void (async () => {
					try {
						await domUtils.createAndRunScript(rm3Iife, "perf-fixes-rm3");
						await domUtils.createAndRunScript(cpuIife, "perf-fixes-cpu-tamer");
						log.debug("performance fixes injected (post-load)");
					} catch (err) {
						log.error("performance fixes inject failed", err);
					}
				})();
			};

			const schedule = () => {
				window.setTimeout(inject, 250);
			};

			window.addEventListener(
				"message",
				(ev) => {
					if (ev.data === "ytmd-ready") schedule();
				},
				{ once: true },
			);
			if (window.isYTMLoaded?.()) schedule();
		},
	},
);
