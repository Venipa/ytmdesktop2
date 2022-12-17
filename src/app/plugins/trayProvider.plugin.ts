import { AfterInit, BaseProvider, BeforeStart } from '@/app/utils/baseProvider';
import { IpcContext, IpcOn } from '@/app/utils/onIpcEvent';
import { createTrayMenu } from '@/app/utils/trayMenu';
import { App, BrowserWindow, Tray } from 'electron';
import { resolve } from 'path';

import SettingsProvider from './settingsProvider.plugin';

@IpcContext
export default class TrayProvider extends BaseProvider
  implements AfterInit {
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
  }
  private _tray: Tray;
  get Tray() {
    return this._tray;
  }
  constructor(private app: App) {
    super("tray");
  }
  async AfterInit() {
    // todo, custom balloon player + info
  }

  
  private buildMenu() {
    return createTrayMenu(this);
  }
  async initializeTray() {
    if (this._tray && !this._tray.isDestroyed()) this._tray.destroy();
    this._tray = new Tray(resolve(__static, "favicon.ico"));
    this._tray.setToolTip(`YouTube Music for Desktop`);
    this._tray.addListener("click", () =>
      BrowserWindow.fromBrowserView(this.views.youtubeView)?.show()
    );
    this._tray.setContextMenu(this.buildMenu());
  }
  @IpcOn("settingsProvider.change", {
    debounce: 50,
  })
  private onSettingsChange() {
    if (this._tray) this._tray.setContextMenu(this.buildMenu());
  }
}
