import { createHash } from "crypto";
import { enc, MD5 } from "crypto-js";
import got, { Got, Method } from "got";
import fetch from "node-fetch";
export class LastFMClient {
  private client: Got;
  private token: string;
  private session: string;
  private sessionName: string;
  private lastError: null;
  constructor(private key: { api: string; secret: string }) {
    this.client = got.extend({
      prefixUrl: "https://ws.audioscrobbler.com/2.0/",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:92.0) Gecko/20100101 Firefox/92.0",
      },
      hooks: {
        beforeRequest: [
          (options) => {
            if (!options.searchParams) options.searchParams = new URLSearchParams();
            if (!options.searchParams.has("api_key"))
              options.searchParams.set("api_key", this.key.api);
            if (this.token) {
              options.searchParams.set("token", this.token);
              let requestSourceData = "";
              const requestSourceHashable = ["api_key", "method", "token"];
              options.searchParams.sort();
              for (const [key, value] of options.searchParams.entries()) {
                if (requestSourceHashable.includes(key)) requestSourceData += key + value;
              }
              requestSourceData += this.key.secret;
              options.searchParams.set(
                "api_sig",
                createHash("md5").update(requestSourceData).digest("hex"),
              );
            }
            options.searchParams.set("format", "json");
            console.log("[API::LASTFM@BeforeRequest]", options, "params:", {
              ...options.searchParams,
            });
          },
        ],
      },
    });
  }
  private async callMethod<T = any>(
    method: string,
    type: Method = "post",
    payload: Partial<{
      body: Record<string | number, any>;
      query: Record<string | number, any>;
    }> = {},
  ) {
    const query = Object.assign({}, payload.query || {}, { method });
    const searchParams = new URLSearchParams(query);
    // const request = this.client
    //   .extend({ method: type })[type.toLowerCase()] as GotRequestFunction;
    // return await request('', {
    //   ...(payload.body ? {body: JSON.stringify(payload.body)} : {}),
    //   searchParams: new URLSearchParams(query)
    // })
    //   .json<T>()

    searchParams.set("api_key", this.key.api);
    if (this.token) {
      searchParams.set("token", this.token);

      let requestSourceData = "";
      searchParams.sort();
      for (const [key, value] of searchParams.entries()) {
        requestSourceData += key + value;
      }
      requestSourceData += this.key.secret;
      searchParams.set(
        "api_sig",
        MD5(requestSourceData).toString(enc.Hex)
      );
    }
    searchParams.set("format", "json");
    this.lastError = null;
    return await fetch(`https://ws.audioscrobbler.com/2.0/?${searchParams.toString()}`, {
      method: type.toLowerCase(),
      headers: {
        "user-agent": "ytmd (github.com/Venipa/ytmdesktop2)",
      },
    })
      .then((r) => r.ok ? r.json() as Promise<T> : Promise.reject(r))
      .catch((err) => {
        this.lastError = err;
        return Promise.reject(err);
      });
  }
  async authorize() {
    const token = await this.callMethod<{ token: string }>("auth.getToken", "get").then(
      (d) => d.token,
    );
    return (this.token = token);
  }
  async getSession() {
    const { session: s } = await this.callMethod<{ session: { name: string; key: string } }>(
      "auth.getSession",
      "get",
    );
    this.sessionName = s.name;
    return (this.session = s.key);
  }
  async updateNowPlaying(
    ...tracks: { artist: string; track: string; album?: string; duration?: number }[]
  ) {
    if (!this.session) throw new Error("Invalid session");
    return await Promise.resolve(
      this.callMethod("track.updateNowPlaying", "post", {
        query: {
          sk: this.session,
          ...tracks[0],
        },
      }),
    );
  }
  async scrobble(
    ...tracks: {
      artist: string;
      track: string;
      timestamp: number;
      album?: string;
      duration?: number;
    }[]
  ) {
    if (!this.session) throw new Error("Invalid session");
    return await this.callMethod("track.scrobble", "post", {
      query: {
        sk: this.session,
        ...tracks[0],
      },
    });
  }
  getUserAuthorizeUrl() {
    if (!this.token) {
      throw new Error("Invalid token");
    }
    return `https://www.last.fm/api/auth?api_key=${this.key.api}&token=${this.token}`;
  }
  getName() {
    if (!this.session) return null;
    return this.sessionName;
  }
  hasError() {
    return !!this.lastError;
  }
  isConnected() {
    return !!this.session;
  }
  setAuthorize({ token, session, name }: { token: string; session?: string; name?: string }) {
    this.token = token;
    this.session = session;
    if (!this.session) this.sessionName = null;
    else this.sessionName = name;

    this.lastError = null;
  }
}
