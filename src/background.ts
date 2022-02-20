import app from "./app/main";
import { isDevelopment } from "./app/utils/devUtils";
import * as Sentry from "@sentry/electron";
import logger from "@/utils/Logger";

if (!isDevelopment) {
  if (process.env.VUE_APP_SENTRY_DSN)
    Sentry.init({ dsn: process.env.VUE_APP_SENTRY_DSN });
  else logger.child("Sentry").warn("Sentry is not enabled");
}
app();
