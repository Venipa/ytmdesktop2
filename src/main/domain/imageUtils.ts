import { NativeImage, nativeImage } from "electron";

export const getNativeImage = (path: string): NativeImage => {
	return nativeImage.createFromPath(path);
};
