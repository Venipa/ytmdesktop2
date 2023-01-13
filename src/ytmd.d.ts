declare module "ytmd" {
  export interface BaseProviderNames { }
  export interface LastFMSettings {
    enabled: boolean;
    auth?: { username: string, password: string }
  }
}
