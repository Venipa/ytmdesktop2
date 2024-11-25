/// <reference types="vite/client" />
/// <reference types="@modyfi/vite-plugin-yaml/modules" />
/// <reference types="electron-vite/node" />
/// <reference path="../node_modules/electron/electron.d.ts" />

import type { IpcPromiseResult } from "@shared/utils/promises";

interface ImportMetaEnv {
  readonly MAIN_APP_SECRET: string;
  readonly NODE_ENV: "production" | "development";
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  declare namespace Electron {
    interface WebContentsView {
      invoke<T = any>(channelName: string, data: any): IpcPromiseResult<T>;
    }
  }
}

type StringLiteral<KnownValues extends string> = (string & {}) | KnownValues;
