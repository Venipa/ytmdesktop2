export async function waitMs(ms?: number) {
  return await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
