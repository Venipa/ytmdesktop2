import type ApiProvider from "@main/services/api.service";
import type AppProvider from "@main/services/app.service";
import type CustomCSSProvider from "@main/services/customCss.service";
import type DiscordProvider from "@main/services/discord.service";
import type EventProvider from "@main/services/event.service";
import type LastFMProvider from "@main/services/lastfm.service";
import type MediaControlProvider from "@main/services/mediaControl.service";
import type MiniPlayerProvider from "@main/services/miniPlayer.service";
import type NavigationProvider from "@main/services/navigation.service";
import type SettingsProvider from "@main/services/settings.service";
import type StartupProvider from "@main/services/startup.service";
import type TouchbarProvider from "@main/services/touchbar.service";
import type TrackProvider from "@main/services/track.service";
import type TrayProvider from "@main/services/tray.service";
import type UpdateProvider from "@main/services/update.service";
import type VolumeRatioProvider from "@main/services/volumeRatio.service";
import type WinControlProvider from "@main/services/winControl.service";
import type WindowUtilsProvider from "@main/services/window.service";
import type YoutubeControlProvider from "@main/services/youtube.service";

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
		winControl: WinControlProvider;
	}
}
