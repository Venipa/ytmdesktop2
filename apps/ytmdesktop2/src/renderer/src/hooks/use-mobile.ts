import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function getIsMobile(): boolean {
	if (typeof window === "undefined") return false;
	return window.innerWidth < MOBILE_BREAKPOINT;
}

/** Sync initial value — avoids undefined→bool remount flash in SidebarProvider. */
export function useIsMobile() {
	const [isMobile, setIsMobile] = React.useState(getIsMobile);

	React.useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		const onChange = () => setIsMobile(getIsMobile());
		mql.addEventListener("change", onChange);
		setIsMobile(getIsMobile());
		return () => mql.removeEventListener("change", onChange);
	}, []);

	return isMobile;
}
