import { isDevelopment } from "@/app/utils/devUtils";
import logger from "@/utils/Logger";
import Sentry from "@sentry/electron/main";

let enabledReporting = true;
export const setSentryEnabled = (enable: boolean) => {
  if (enabledReporting !== enable) enabledReporting = enable;
  if (!enable) logger.child("Sentry").warn("Sentry has been disabled");
  else logger.child("Sentry").warn("Sentry has been enabled");
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
