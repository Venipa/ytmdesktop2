import { logger } from "@shared/utils/console";

export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;
export const isProdDebug = import.meta.env.PROD && process.env.DEBUG;
export const defaultUrl = "https://music.youtube.com";
export const defaultUri = new URL(defaultUrl);
export const EMPTY_URL = "data:text/html;charset=utf-8,<html><body></body></html>";

logger.debug({ isProduction, environment: import.meta.env.MODE, __dirname, __filename });
