import { AfterInit, BaseProvider, BeforeStart } from '@/app/utils/baseProvider';
import { IpcContext, IpcOn } from '@/app/utils/onIpcEvent';
import { App } from 'electron';
import { basename } from 'path';

import SettingsProvider from './settingsProvider.plugin';

@IpcContext
export default class StartupProvider extends BaseProvider
  implements AfterInit, BeforeStart {
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
  }
  constructor(private app: App) {
    super("startup");
    app.commandLine.appendSwitch("disable-http-cache");
    if (process.platform === "win32") {
      app.commandLine.appendSwitch("enable-gpu-rasterization"); // performance feature flags
      app.commandLine.appendSwitch("enable-zero-copy");
      app.commandLine.appendSwitch("enable-features", "CanvasOopRasterization,EnableDrDc"); // Enables Display Compositor to use a new gpu thread. todo: testing
    }
  }
  async BeforeStart() {
    if (this.settingsInstance.instance.app.disableHardwareAccel) this.app.disableHardwareAcceleration();
  }
  private get startArgs() {
    return ["--processStart", `"${basename(process.execPath)}"`];
  }
  async AfterInit() {
    const app = this.settingsInstance.instance.app;
    if (app.autostart) {
      this.app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
        args: this.startArgs,
      });
    } else {
      this.app.setLoginItemSettings({
        openAtLogin: false,
        args: this.startArgs,
      });
    }
    this.getProvider("tray").initializeTray().then(() => {
      this.logger.debug("tray initialized");
    });
  }
  @IpcOn("settingsProvider.change", {
    debounce: 1000,
    filter: (key: string) => key === "app.autostart",
  })
  private async onAutoStartToggle(key: string, enabled: boolean) {
    if (enabled) {
      this.app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
        args: this.startArgs,
      });
    } else {
      this.app.setLoginItemSettings({
        openAtLogin: false,
        args: this.startArgs,
      });
    }
  }
}
