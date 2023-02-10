import { AfterInit, BaseProvider } from '@/app/utils/baseProvider';
import { IpcContext, IpcHandle } from '@/app/utils/onIpcEvent';
import { App, BrowserWindow } from 'electron';

import { createAppWindow } from '../utils/windowUtils';

@IpcContext
export default class MiniPlayerProvider extends BaseProvider implements AfterInit {
  constructor(private _app: App) {
    super("mp");
  }
  get app() {
    return this._app;
  }
  async AfterInit() {
  }
  @IpcHandle("action:app.miniPlayer")
  @IpcHandle("app.miniPlayer")
  private async __playerWindow() {
    let mpId: number;
    let mpWindow = this.windowContext.views
      .miniPlayerWindow as any as BrowserWindow;
    if (!mpWindow || mpWindow.isDestroyed()) {
      mpWindow = await createAppWindow({
        // parent: this.windowContext.main, 
        path: "/miniplayer",
        minWidth: 340,
        minHeight: 340,
        height: 340,
        width: 540
      });
      mpWindow.setMinimizable(true);
      this.windowContext.views.miniPlayerWindow = mpWindow as any;
      this.windowContext.main.hide();
      mpWindow.on("close", () => {
        this.windowContext.main.show();
      });
      mpId = mpWindow.id;
    } else {
      mpId = mpWindow.id;
      mpWindow.show();
      // mpWindow.destroy();
    }
    this.windowContext.sendToAllViews("miniplayer.state", !this.views.miniPlayerWindow ? null : { active: false });
    return mpId;
  }
}
