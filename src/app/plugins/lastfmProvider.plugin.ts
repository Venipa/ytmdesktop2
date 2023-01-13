import { AfterInit, BaseProvider } from '@/app/utils/baseProvider';
import { IpcContext } from '@/app/utils/onIpcEvent';
import { App } from 'electron';


@IpcContext
export default class LastFMProvider extends BaseProvider implements AfterInit {
  constructor(private app: App) {
    super("lastfm");
  }
  async AfterInit() { }
}
