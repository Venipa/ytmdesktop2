import * as Sentry from "@sentry/electron";
import { isDevelopment } from "@/app/utils/devUtils";
import logger from "@/utils/Logger";

export const sentryInstance = Sentry.getCurrentHub();
let enabledReporting = true;
export const setSentryEnabled = (enable: boolean) => {
  if (enabledReporting !== enable) enabledReporting = enable;
};

if (!isDevelopment) {
  if (process.env.VUE_APP_SENTRY_DSN)
    Sentry.init({
      dsn: process.env.VUE_APP_SENTRY_DSN,
      enabled: true,
      beforeSend: (ev) => {
        if (!enabledReporting) return null;
        return ev;
      },
    });
  else logger.child("Sentry").warn("Sentry is not enabled");
}
