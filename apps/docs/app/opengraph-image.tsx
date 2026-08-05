import { createHomeOgImage } from '@/lib/og';
import { appName, appTagline } from '@/lib/shared';

export const alt = `${appName} — ${appTagline}`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';
export const revalidate = false;

export default async function Image() {
  return createHomeOgImage();
}
