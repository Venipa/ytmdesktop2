import { logger } from "@shared/utils/console";
import { BrowserWindow, WebContents } from "electron";
import { fromEventPattern, tap } from "rxjs";

export function fromMainEvent(win: BrowserWindow | WebContents, eventName: string) {
  function addHandler(handler: any) {
    win.on(eventName as any, handler);
  }
  function removeHandler(handler: any) {
    win.off(eventName as any, handler);
  }
  return fromEventPattern(addHandler, removeHandler).pipe(tap(() => {
    logger.child(eventName).debug("event triggered")
  }));
}