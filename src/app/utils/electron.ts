import logger from "@/utils/Logger";
import { app } from "electron";
import { isProduction } from "./devUtils";

let isInitialized = false;
export function initializeCustomElectronEnvironment() {

  if (isInitialized) {
    logger.error("app is already initializing");
    app.quit();
    process.exit(0);
  }


  if (!isProduction){
    app.commandLine.appendSwitch("disable-web-security"); // disable cors (also disables other security features, allows webpack eval) - dev only
    app.commandLine.appendSwitch("disable-site-isolation-trials");
  }
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

  isInitialized = true;
}