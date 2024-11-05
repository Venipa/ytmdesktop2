import { is } from "@electron-toolkit/utils";
import { Logger } from "@shared/utils/console";
import logger from "@shared/utils/Logger";
import { app } from "electron";
import { isProduction } from "./devUtils";

let isInitialized = false;
export function initializeCustomElectronEnvironment() {
  if (isInitialized) {
    logger.error("app is already initializing");
    app.quit();
    process.exit(0);
  }

  if (!isProduction) {
    app.commandLine.appendSwitch("disable-web-security"); // disable cors (also disables other security features, allows webpack eval) - dev only
    app.commandLine.appendSwitch("disable-site-isolation-trials");
    console.log({ env: import.meta.env, isDev: is.dev });
  }
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

  if (import.meta.env.PROD && !process.env.DEBUG) Logger.enableProductionMode();
  process.env.NODE_ENV = import.meta.env.MODE;

  isInitialized = true;
}
