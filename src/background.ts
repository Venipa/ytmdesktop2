import app from "./app/main";
import { isDevelopment } from "./app/utils/devUtils";
import * as Sentry from "@sentry/electron";
if (!isDevelopment) {
  Sentry.init({ dsn: process.env.VUE_APP_SENTRY_DSN });
}
app();