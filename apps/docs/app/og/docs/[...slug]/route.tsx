import { getPageImageUrl, source } from '@/lib/source';
import { notFound } from 'next/navigation';
import { createOgImage } from '@/lib/og';

export const revalidate = false;

export async function GET(_req: Request, { params }: RouteContext<'/og/docs/[...slug]'>) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  const og = page.data.og;

  return createOgImage({
    title: page.data.title,
    description: page.data.description,
    logo: 'svg',
    image: og?.image,
    imageType: og?.type ?? 'screenshot',
    color: og?.color,
  });
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImageUrl(page).segments,
  }));
}
