import { resolve } from "path";

export const isDevelopment = process.env.NODE_ENV !== "production";
export const defaultUrl = "https://music.youtube.com";
export const defaultUri = new URL(defaultUrl);
export const getAssetPath = (path: string) => !isDevelopment ? resolve(__static, path) : resolve(process.env.WEBPACK_DEV_SERVER_URL, path);
export const EMPTY_URL = 'data:text/html;charset=utf-8,<html><body></body></html>';