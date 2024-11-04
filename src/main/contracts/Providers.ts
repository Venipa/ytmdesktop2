import type ApiProvider from "@main/plugins/apiProvider.plugin";
import type AppProvider from "@main/plugins/appProvider.plugin";
import type CustomCSSProvider from "@main/plugins/customCssProvider.plugin";
import type DiscordProvider from "@main/plugins/discordProvider.plugin";
import type EventProvider from "@main/plugins/eventProvider.plugin";
import type LastFMProvider from "@main/plugins/lastfmProvider.plugin";
import type MediaControlProvider from "@main/plugins/mediaControlProvider.plugin";
import type MiniPlayerProvider from "@main/plugins/miniPlayerProvider.plugin";
import type NavigationProvider from "@main/plugins/navigationProvider.plugin";
import type SettingsProvider from "@main/plugins/settingsProvider.plugin";
import type StartupProvider from "@main/plugins/startupProvider.plugin";
import type TrackProvider from "@main/plugins/trackProvider.plugin";
import type TrayProvider from "@main/plugins/trayProvider.plugin";
import type UpdateProvider from "@main/plugins/updateProvider.plugin";
import type WindowUtilsProvider from "@main/plugins/windowProvider.plugin";
import type YoutubeControlProvider from "@main/plugins/youtubeProvider.plugin";

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
  }
}
