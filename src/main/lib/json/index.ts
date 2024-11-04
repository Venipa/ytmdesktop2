export function parseJson<T = any>(value: any) {
  if (typeof value !== "string") {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch (ex) {
    console.error(ex);
    return null;
  }
}
export function stringifyJson(value: any) {
  return JSON.stringify(value);
}
