import app from "./app/main";
import Logger from "@/utils/Logger";
import { isDevelopment } from "./app/utils/devUtils";
import * as Sentry from "@sentry/electron";
if (!isDevelopment) {
  Logger.enableProduction();
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}
app();
