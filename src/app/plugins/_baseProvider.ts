import { App } from "electron";

export interface OnInit {
  OnInit(app?: App): void | Promise<void>;
}
export interface AfterInit {
  AfterInit(app?: App): void | Promise<void>;
}
export interface OnDestroy {
  OnDestroy(app?: App): void | Promise<void>;
}

export class BaseProvider {
  __type = "service_provider";
  private __providers: { [key: string]: BaseProvider & any } = {};
  constructor(private name: string) {}

  getName() {
    return this.name;
  }
  _registerProviders(p: BaseProvider[]) {
    this.__providers = p.reduce((l, r) => ({ ...l, [r.getName()]: r }), {});
  }
  getProvider(name: string) {
    return this.__providers[name];
  }
  queryProvider(): BaseProvider[] {
    return Object.values(this.__providers);
  }
}
