import * as Sentry from "@sentry/electron/main";
import logger from "@shared/utils/Logger";
let enabledReporting = true;
export const setSentryEnabled = (enable: boolean) => {
  if (enabledReporting !== enable) enabledReporting = enable;
  if (!enable) logger.child("Sentry").warn("Sentry has been disabled");
  else logger.child("Sentry").warn("Sentry has been enabled");
};

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry &&
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      enabled: true,
      beforeSend: (ev) => {
        if (!enabledReporting) return null;
        return ev;
      },
    });
  logger.child("Sentry").info("Sentry has been initialized");
} else logger.child("Sentry").warn("Sentry is not enabled");
