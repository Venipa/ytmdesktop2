/// <reference types="vite/client" />
/// <reference types="@modyfi/vite-plugin-yaml/modules" />
/// <reference types="electron-vite/node" />

interface ImportMetaEnv {
  readonly MAIN_APP_SECRET: string;
  readonly NODE_ENV: "production" | "development";
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
