

import { AfterInit, BaseProvider, BeforeStart } from '@/app/utils/baseProvider';
import { IpcContext } from '@/app/utils/onIpcEvent';
import { App } from 'electron';


@IpcContext
export default class YoutubeControlProvider extends BaseProvider
  implements AfterInit, BeforeStart {
  constructor(private app: App) {
    super("youtube");
  }
  async BeforeStart() {
  }
  async AfterInit() {
  }

}
