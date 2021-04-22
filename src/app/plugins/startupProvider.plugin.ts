import {
  App,
  BrowserWindow,
  ipcMain,
  LoginItemSettings,
  Menu,
  nativeImage,
  shell,
  Tray,
} from "electron";
import SettingsProvider from "./settingsProvider.plugin";
import { BaseProvider, AfterInit, OnInit, BeforeStart } from "./_baseProvider";
import { basename, resolve } from "path";
import { IpcContext, IpcOn } from "../utils/onIpcEvent";
@IpcContext
export default class EventProvider extends BaseProvider
  implements AfterInit, BeforeStart {
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
  }
  private _tray: Tray;
  get Tray() {
    return this._tray;
  }
  constructor(private app: App) {
    super("startup");
  }
  async BeforeStart() {}
  private async initializeTray() {
    this._tray = new Tray(resolve(__static, "favicon.ico"));
    this._tray.setToolTip(`Youtube Music Desktop v2`);
    this._tray.setContextMenu(this.buildMenu());
  }
  private buildMenu() {
    const settings = this.settingsInstance.instance;
    return Menu.buildFromTemplate([
      {
        label: "Youtube Music for Desktop",
        sublabel: `Version: ${this.app.getVersion()}`,
      },
      {
        label: "Check for Updates",
        click: () => ipcMain.emit("app.checkUpdate"),
      },
      {
        type: "separator",
      },
      {
        label: "Auto Startup",
        type: "checkbox",
        checked: settings.app.autostart,
        click: (item) => {
          this.settingsInstance.set("app.autostart", item.checked);
        },
      },
      {
        label: "Auto Update",
        type: "checkbox",
        checked: settings.app.autoupdate,
        click: (item) => {
          this.settingsInstance.set("app.autoupdate", item.checked);
        },
      },
      {
        type: "separator",
      },
      {
        label: "Settings",
        click: () => {
          ipcMain.emit("settings.show");
        },
      },
      {
        type: "separator",
      },
      {
        type: "submenu",
        label: "Discord",
        submenu: [
          {
            label: "Show Presence",
            type: "checkbox",
            checked: settings.discord.enabled,
            click: (item) => {
              this.settingsInstance.set("discord.enabled", item.checked);
            },
          },
          {
            label: "Show Buttons",
            type: "checkbox",
            checked: settings.discord.enabled,
            click: (item) => {
              this.settingsInstance.set("discord.buttons", item.checked);
            },
          },
        ],
      },
      {
        type: "separator",
      },
      {
        type: "submenu",
        label: "Custom CSS",
        submenu: [
          {
            label: "Enable CSS",
            type: "checkbox",
            checked: settings.customcss.enabled,
            click: (item) => {
              this.settingsInstance.set("customcss.enabled", item.checked);
            },
          },
          {
            label: "Open selected CSS File",
            enabled: settings.customcss.enabled,
            click: (item) => {
              if (item.enabled) shell.openExternal(settings.customcss.scssFile);
            },
          },
          {
            label: "Change CSS File",
            enabled: settings.customcss.enabled,
            click: (item) => {
              if (item.enabled) ipcMain.emit("settings.show");
            },
          },
        ],
      },
      {
        type: "separator",
      },
      {
        label: "Quit",
        click: () => this.app.quit(),
      },
    ]);
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
    this.initializeTray();
  }
  @IpcOn("settingsProvider.change", {
    debounce: 50,
  })
  private onSettingsChange() {
    this._tray.setContextMenu(this.buildMenu());
  }
  @IpcOn("settingsProvider.change", {
    debounce: 1000,
    filter: (key: string, enabled: boolean) => key === "app.autostart",
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
