import { BrowserWindow, WebContents } from "electron";
import { fromEventPattern } from "rxjs";

export function fromMainEvent(win: BrowserWindow | WebContents, eventName: string) {
	function addHandler(handler: any) {
		win.on(eventName as any, handler);
	}
	function removeHandler(handler: any) {
		win.off(eventName as any, handler);
	}
	return fromEventPattern(addHandler, removeHandler);
}
