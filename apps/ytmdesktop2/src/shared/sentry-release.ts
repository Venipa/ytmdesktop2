export function formatSentryRelease(version: string, gitHash: string | undefined): string {
	const short = gitHash?.slice(0, 7);
	return short ? `ytmdesktop2@${version}+${short}` : `ytmdesktop2@${version}`;
}
