export type ProgressInfo = {
	total: number;
	delta: number;
	transferred: number;
	percent: number;
	bytesPerSecond: number;
};

export type UpdateInfo = {
	version: string;
	files: {
		url: string;
		size: number;
		sha512: string;
	}[];
	path: string;
	sha512: string;
	releaseName: string;
	releaseNotes: string;
	releaseDate: string;
	stagingPercentage: number;
	minimumSystemVersion: string;
	packages: {
		[arch: string]: {
			path: string;
			size: number;
			sha512: string;
		};
	} | null;
	sha2: string;
};
