/**
 * Exponential volume curve on HTMLMediaElement.prototype.volume.
 * Port of greasyfork youtube-music-fix-volume-ratio (exponent 3 = pulseaudio).
 */

const EXPONENT = 3;

type VolumeDescriptor = {
	get: (this: HTMLMediaElement) => number;
	set: (this: HTMLMediaElement, value: number) => void;
};

const storedOriginalVolumes = new WeakMap<HTMLMediaElement, number>();

let patched = false;
let nativeVolume: VolumeDescriptor | null = null;

function asVolumeDescriptor(desc: PropertyDescriptor | undefined): VolumeDescriptor | null {
	if (!desc || typeof desc.get !== "function" || typeof desc.set !== "function") return null;
	return { get: desc.get as VolumeDescriptor["get"], set: desc.set as VolumeDescriptor["set"] };
}

/** Install exponential volume getter/setter. Idempotent. */
export function enableVolumeRatio(): boolean {
	if (patched) return false;

	const current = asVolumeDescriptor(Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "volume"));
	if (!current) return false;

	nativeVolume = current;
	window.HTMLMediaElement_volume = current;

	Object.defineProperty(HTMLMediaElement.prototype, "volume", {
		configurable: true,
		enumerable: true,
		get(this: HTMLMediaElement) {
			const lowVolume = current.get.call(this);
			const calculatedOriginalVolume = lowVolume ** (1 / EXPONENT);
			const storedOriginalVolume = storedOriginalVolumes.get(this);
			const storedDeviation =
				storedOriginalVolume === undefined ? Number.POSITIVE_INFINITY : Math.abs(storedOriginalVolume - calculatedOriginalVolume);
			return storedDeviation < 0.01 ? (storedOriginalVolume as number) : calculatedOriginalVolume;
		},
		set(this: HTMLMediaElement, originalVolume: number) {
			const lowVolume = originalVolume ** EXPONENT;
			storedOriginalVolumes.set(this, originalVolume);
			current.set.call(this, lowVolume);
		},
	});

	patched = true;
	return true;
}

/** Restore native volume property. Idempotent. */
export function disableVolumeRatio(): boolean {
	const restore = nativeVolume ?? asVolumeDescriptor(window.HTMLMediaElement_volume as PropertyDescriptor | undefined);
	if (!restore) {
		patched = false;
		return false;
	}

	Object.defineProperty(HTMLMediaElement.prototype, "volume", {
		configurable: true,
		enumerable: true,
		get: restore.get,
		set: restore.set,
	});

	nativeVolume = null;
	patched = false;
	return true;
}

export function isVolumeRatioEnabled(): boolean {
	return patched;
}

declare global {
	interface Window {
		HTMLMediaElement_volume?: VolumeDescriptor;
	}
}
