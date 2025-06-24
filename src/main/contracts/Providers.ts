import type ApiProvider from "@main/services/apiProvider.plugin";
import type AppProvider from "@main/services/appProvider.plugin";
import type CustomCSSProvider from "@main/services/customCssProvider.plugin";
import type DiscordProvider from "@main/services/discordProvider.plugin";
import type EventProvider from "@main/services/eventProvider.plugin";
import type LastFMProvider from "@main/services/lastfmProvider.plugin";
import type MediaControlProvider from "@main/services/mediaControlProvider.plugin";
import type MiniPlayerProvider from "@main/services/miniPlayerProvider.plugin";
import type NavigationProvider from "@main/services/navigationProvider.plugin";
import type SettingsProvider from "@main/services/settingsProvider.plugin";
import type StartupProvider from "@main/services/startupProvider.plugin";
import type TouchbarProvider from "@main/services/touchbarProvider.plugin";
import type TrackProvider from "@main/services/trackProvider.plugin";
import type TrayProvider from "@main/services/trayProvider.plugin";
import type UpdateProvider from "@main/services/updateProvider.plugin";
import type VolumeRatioProvider from "@main/services/volumeRatio.plugin";
import type WindowUtilsProvider from "@main/services/windowProvider.plugin";
import type YoutubeControlProvider from "@main/services/youtubeProvider.plugin";

declare module "ytmd" {
	interface BaseProviderNames {
		api: ApiProvider;
		app: AppProvider;
		settings: SettingsProvider;
		track: TrackProvider;
		discord: DiscordProvider;
		events: EventProvider;
		customcss: CustomCSSProvider;
		mediaController: MediaControlProvider;
		mp: MiniPlayerProvider;
		navigation: NavigationProvider;
		startup: StartupProvider;
		tray: TrayProvider;
		update: UpdateProvider;
		lastfm: LastFMProvider;
		youtube: YoutubeControlProvider;
		window: WindowUtilsProvider;
		volumeRatio: VolumeRatioProvider;
		touchbar: TouchbarProvider;
	}
}
