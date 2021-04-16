import { BrowserView, BrowserWindow } from "electron";

export interface BrowserWindowViews<T> {
  main: BrowserWindow,
  views: {[key: string]: BrowserView} & T
}