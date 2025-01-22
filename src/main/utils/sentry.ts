import * as Sentry from "@sentry/electron/main";
import logger from "@shared/utils/Logger";
let enabledReporting = true;
const sentryLog = logger.child("Sentry");
export const setSentryEnabled = (enable: boolean) => {
  if (enabledReporting !== enable) enabledReporting = enable;
  if (!enable) sentryLog.warn("Sentry has been disabled");
  else sentryLog.warn("Sentry has been enabled");
};

if (import.meta.env.VITE_SENTRY_DSN && Sentry && !Sentry.isInitialized) {
  try {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      enabled: import.meta.env.PROD,
      onFatalError(error) {
        if (enabledReporting) sentryLog.error(error);
      },
      beforeSend: (ev) => {
        if (!enabledReporting) return null;
        return ev;
      },
    });
  } catch {
    sentryLog.warn("Sentry has failed to initialize, server may not be reachable.");
  } finally {
    sentryLog.info("Sentry has been initialized");
  }
} else if (!Sentry || !Sentry.isInitialized) sentryLog.warn("Sentry is not enabled");
export { Sentry };
