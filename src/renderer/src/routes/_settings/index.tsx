import { createFileRoute } from "@tanstack/react-router";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsInput } from "@/components/settings-input";
import { useSetting } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_settings/")({
	component: GenericSettingsPage,
});

function GenericSettingsPage() {
	const [getStartedEnabled, setGetStartedEnabled] = useSetting<boolean>("app.getstarted");
	const [apiEnabledSetting] = useSetting<boolean>("api.enabled");
	const [appAutostartEnabled] = useSetting<boolean>("app.autostart");

	return (
		<div className="flex flex-col gap-4">
			{getStartedEnabled && (
				<div className="mt-4 bg-white/5 shadow sm:rounded-lg">
					<div className="px-4 py-5 sm:p-6">
						<h3 className="text-lg font-medium leading-6 text-foreground">Get Started</h3>
						<div className="mt-2 max-w-xl text-sm text-muted-foreground">
							<p>Welcome to YouTube Music for Desktop, here you can adjust settings to your liking aswell as personalize your experience.</p>
						</div>
						<div className="mt-3 text-sm">
							<a href="https://youtube-music.app/" target="_blank" rel="noreferrer" className="font-medium text-indigo-400 hover:text-indigo-300">
								Learn more about our features <span aria-hidden="true">&rarr;</span>
							</a>
						</div>
						<div className="mt-3 text-xs">
							<button
								type="button"
								className="font-medium text-red-400 hover:text-red-300"
								onClick={() => setGetStartedEnabled(false)}
							>
								Don't show again
							</button>
						</div>
					</div>
				</div>
			)}
			<div className="mt-4 flex flex-col gap-4 px-3">
				<div
					className={cn(
						"flex flex-col gap-y-1 border -mx-3 px-3",
						appAutostartEnabled
							? "rounded-lg border-gray-500 bg-gray-800 pt-1.5 pb-2.5 transition-all duration-150 ease-in-out"
							: "mt-1.5 border-gray-500/0 bg-gray-800/0",
					)}
				>
					<SettingsCheckbox configKey="app.autostart">Enable Autostart</SettingsCheckbox>
					{appAutostartEnabled && <SettingsCheckbox configKey="app.autostartMinimized">Start minimized</SettingsCheckbox>}
				</div>
				<SettingsCheckbox configKey="app.autoupdate">Enable Autoupdate</SettingsCheckbox>
				<SettingsCheckbox configKey="app.enableStatisticsAndErrorTracing">
					<div className="flex flex-col">
						<span>Allow reporting of anonymized errors to sentry.io.</span>
						<span className="opacity-80">(allows for faster bug fixing.)</span>
					</div>
				</SettingsCheckbox>
				<SettingsCheckbox configKey="app.minimizeTrayOverride">Close window to tray instead of quitting</SettingsCheckbox>
				<SettingsCheckbox configKey="app.enableDev" className="group">
					<div className="flex flex-col">
						<div>Enable Developer Mode</div>
						<div className="select-none text-xs font-medium opacity-80 group-hover:opacity-100">... to design or test additional functionality.</div>
						<div className="flex select-none flex-col text-xs font-medium opacity-80 group-hover:opacity-100">
							<div className="flex gap-1">
								<div className="font-bold text-red-500 uppercase">Hold Up!</div>
								If someone told you to copy/paste something here you have an 11/10 chance you're being scammed.
							</div>
							<div>Pasting anything in the console could give attackers access to your Google/YouTube account.</div>
						</div>
					</div>
				</SettingsCheckbox>
				<SettingsCheckbox configKey="app.disableHardwareAccel" className="group">
					<div className="flex flex-col">
						<div>Disable Hardware Acceleration Mode</div>
						<div className="select-none text-xs font-medium opacity-80 group-hover:opacity-100">updating this setting requires app restart.</div>
					</div>
				</SettingsCheckbox>
				<div
					className={cn(
						"flex flex-col gap-y-1 border -mx-3 px-3",
						apiEnabledSetting ? "rounded-lg border-gray-500 pt-1.5 pb-2.5" : "mt-1.5 border-gray-500/0",
					)}
				>
					<SettingsCheckbox configKey="api.enabled" className="group">
						<div className="flex flex-col">
							<div>Enable API</div>
							<div className="select-none text-xs font-medium opacity-80 group-hover:opacity-100">... allows to utilize the clients api to extend functionality.</div>
							<div className="select-none text-xs font-medium text-red-500 uppercase opacity-80 group-hover:opacity-100">Experimental</div>
						</div>
					</SettingsCheckbox>
					{apiEnabledSetting && (
						<SettingsInput configKey="api.port" type="number" min={13000} max={39999} placeholder="13000-39999" label="API Port" />
					)}
				</div>
			</div>
		</div>
	);
}
