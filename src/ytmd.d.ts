declare module "ytmd" {
  export interface BaseProviderNames { }
  export interface LastFMSettings {
    enabled: boolean;
    auth?: { key: string }
    name?: string
  }
}
