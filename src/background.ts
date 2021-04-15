import app from "./app/main";
import Logger from "@/utils/Logger";
import { isDevelopment } from "./app/utils/devUtils";
if (!isDevelopment) Logger.enableProduction();

app();
