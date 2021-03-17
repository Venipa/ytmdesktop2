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
  __type = 'service_provider';
  constructor(private name: string) {}

  getName() {
    return this.name;
  }
}