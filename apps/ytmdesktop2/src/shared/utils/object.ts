export const stripUndefined = (obj: Record<string, any>) => {
	return Object.fromEntries(Object.entries(obj).filter(([_, value]) => value !== undefined));
};
