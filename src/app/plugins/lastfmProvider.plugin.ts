import { AfterInit, BaseProvider, OnInit } from '@/app/utils/baseProvider';
import { IpcContext, IpcHandle } from '@/app/utils/onIpcEvent';
import { string } from "@poppinss/utils/build/helpers";
import { App, BrowserWindow, shell } from 'electron';
import keytar from "keytar";
import { LastFMSettings } from 'ytmd';
import { parseJson, stringifyJson } from '../lib/json';
import { APP_KEYTAR, LASTFM_KEYTAR_SESSION, LASTFM_KEYTAR_TOKEN } from '../lib/keytar';
import { LastFMClient } from '../lib/lastfm';
import IPC_EVENT_NAMES from '../utils/eventNames';
import { TrackData } from '../utils/trackData';
import { appIconPath } from '../utils/windowUtils';

export interface LastFMUserState {
  siteSection: string;
  pageType: string;
  pageName: string;
  nativeEventTracking: boolean;
  userState: string;
  userType: string;
  userId: string;
}
const lastFmClient = new LastFMClient({ api: process.env.VUE_APP_LASTFM_API, secret: process.env.VUE_APP_LASTFM_SECRET });

@IpcContext
export default class LastFMProvider extends BaseProvider implements AfterInit, OnInit {
  constructor(private app: App) {
    super("lastfm");
  }
  get client() {
    return lastFmClient;
  }
  async OnInit() {
    const lastfm = this.getProvider("settings").get("lastfm") as LastFMSettings;
    if (lastfm.enabled) {
      const creds = await keytar.findCredentials(APP_KEYTAR);
      const lastFMState = creds.reduce((acc, r) => {
        if (r.account === LASTFM_KEYTAR_TOKEN) acc.token = r.password;
        else if (r.account === LASTFM_KEYTAR_SESSION) acc.session = r.password;
        return acc;
      }, {} as any as { token: string, session: string });
      if (lastFMState.session)
        this.client.setAuthorize({
          token: lastFMState.token,
          session: lastFMState.session,
          name: string.escapeHTML(lastfm.name)
        })
    }
  }
  async AfterInit() {
    this.views.toolbarView.webContents.on("did-finish-load", () => {
      this.sendState();
    })
  }
  private authProgress = false;
  private async authorizeSession() {
    if (this.authProgress) return;
    const token = await this.client.authorize()
    const win = new BrowserWindow({
      width: 480,
      height: 600,
      minWidth: 480,
      minHeight: 600,
      alwaysOnTop: true,
      parent: this.windowContext.main,
      title: "LastFM Authorize",
      icon: appIconPath,
      paintWhenInitiallyHidden: true,
      show: false,
      autoHideMenuBar: true,
      center: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      modal: true
    })
    await win.loadURL(this.client.getUserAuthorizeUrl())
    const hasSuccessInfo = () => win.webContents.executeJavaScript(`!!document.querySelector("#mantle_skin .alert.alert-success")`);
    const settings = this.getProvider("settings");
    win.webContents.on("did-navigate", async (ev, url, code, status) => {
      this.logger.debug(`[URL]> ${url}, ${code}, ${status}`);
      if (await hasSuccessInfo()) {
        const userState: LastFMUserState = await win.webContents.executeJavaScript(`document.getElementById("tlmdata")?.dataset?.tealiumData`).then(parseJson<LastFMUserState>).catch(() => null);
        this.logger.debug(`[Auth]> User: ${stringifyJson(userState)}`);
        if (userState) {

          await keytar.setPassword(APP_KEYTAR, LASTFM_KEYTAR_TOKEN, token);
          const sessionToken = await this.client.getSession().catch(() => null);
          if (sessionToken) {

            await keytar.setPassword(APP_KEYTAR, LASTFM_KEYTAR_SESSION, sessionToken);
            if (win.isEnabled())
              win.close();
          }

          this.logger.debug(`[Auth]> Authenticated: ${sessionToken}`);
          settings.set("lastfm.enabled", true);
          settings.set("lastfm.name", string.escapeHTML(this.client.getName() || null, { encodeSymbols: true }))
          settings.saveToDrive();

        }
      }
      this.sendState();
    });
    win.show();
    this.authProgress = true;
    this.sendState();
    win.once("closed", () => {
      this.authProgress = false;
      this.sendState();
    })
  }
  getState() {
    const lastfm = this.getProvider("settings")?.get<LastFMSettings>("lastfm");
    return {
      connected: this.client.isConnected(),
      name: this.client.getName() || (lastfm.enabled ? lastfm.name : null),
      error: this.client.hasError(),
      processing: this.authProgress
    }
  }
  sendState() {
    this.windowContext.sendToAllViews(IPC_EVENT_NAMES.LAST_FM_STATUS, this.getState())
  }
  @IpcHandle("action:" + IPC_EVENT_NAMES.LAST_FM_STATUS)
  async handleLastFMState() {
    return this.getState()
  }
  @IpcHandle("action:" + IPC_EVENT_NAMES.LAST_FM_PROFILE)
  async handleLastFMProfile() {
    if (!this.client.isConnected()) return
    const username = this.client.getName() || this.getProvider("settings")?.instance.lastfm.name;
    return await shell.openExternal(`https://www.last.fm/user/${string.escapeHTML(username)}/`)
  }
  @IpcHandle(IPC_EVENT_NAMES.LAST_FM_AUTHORIZE)
  async handleLastFMAuth() {
    return await this.authorizeSession()
      .then(() => true)
      .catch(err => {
        console.error(err);
        return false;
      })
  }
  @IpcHandle("action:" + IPC_EVENT_NAMES.LAST_FM_TOGGLE)
  async handleLastFMToggle(_, state: boolean) {
    if (state === undefined) return;
    const settings = this.getProvider("settings");
    settings.set("lastfm.enabled", !!state);
    settings.saveToDrive();
    if (state) {
      this.client.setAuthorize({ token: null, session: null });
      await this.handleLastFMAuth();
    } else {
      this.client.setAuthorize({ token: null, session: null });
      settings.set("lastfm.name", null);
      await (Promise.all([
        keytar.deletePassword(APP_KEYTAR, LASTFM_KEYTAR_SESSION).catch(() => null),
        keytar.deletePassword(APP_KEYTAR, LASTFM_KEYTAR_TOKEN).catch(() => null)
      ]));
    }
    this.sendState();
    return this.getState()
  }

  async handleTrackStart(track: TrackData) {{
      if (!this.client.isConnected()) return;
      await this.client.updateNowPlaying({
          artist: track.video.author,
          track: track.video.title,
          duration: track.meta.duration
      }).then(stringifyJson)
          .then(d => this.logger.debug(d))
          .catch(err => {
              this.logger.error(err);
          })
  }}

  async handleTrackChange(track: TrackData) {
    if (!this.client.isConnected()) return;
    await this.client.scrobble({
      artist: track.video.author,
      track: track.video.title,
      timestamp: track.meta.startedAt,
      duration: track.meta.duration
    }).then(stringifyJson)
      .then(d => this.logger.debug(d))
      .catch(err => {
        this.logger.error(err);
      })
  }
}
