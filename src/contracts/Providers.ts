import type SettingsProvider from "@/app/plugins/settingsProvider.plugin";
import type ApiProvider from "@/app/plugins/apiProvider.plugin";
import type TrackProvider from "@/app/plugins/trackProvider.plugin";
import type DiscordProvider from "@/app/plugins/discordProvider.plugin";
import type EventProvider from "@/app/plugins/eventProvider.plugin";
import type CustomCSSProvider from "@/app/plugins/customCssProvider.plugin";
import type MediaControlProvider from "@/app/plugins/mediaControlProvider.plugin";
import type MiniPlayerProvider from "@/app/plugins/miniPlayerProvider.plugin";
import type NavigationProvider from "@/app/plugins/navigationProvider.plugin";
import type StartupProvider from "@/app/plugins/startupProvider.plugin";
import type TrayProvider from "@/app/plugins/trayProvider.plugin";
import type UpdateProvider from "@/app/plugins/updateProvider.plugin";
import type AppProvider from "@/app/plugins/appProvider.plugin";

declare global {
  interface ProviderNames {
    api: ApiProvider
    app: AppProvider
    settings: SettingsProvider
    track: TrackProvider
    discord: DiscordProvider
    events: EventProvider
    customcss: CustomCSSProvider
    mediaController: MediaControlProvider
    mp: MiniPlayerProvider
    navigation: NavigationProvider
    startup: StartupProvider
    tray: TrayProvider
    update: UpdateProvider
  }
}