import { logger } from "@shared/utils/console";

export function parseJson<T = any>(value: any) {
	if (typeof value !== "string") {
		return null;
	}
	try {
		return JSON.parse(value) as T;
	} catch (ex) {
		logger.error(ex);
		return null;
	}
}
export function stringifyJson(value: any) {
	return JSON.stringify(value);
}
