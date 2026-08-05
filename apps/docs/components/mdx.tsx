import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import type { ImageProps } from 'next/image';
import { assetPath } from '@/lib/paths';

function resolveMdxImageSrc(src: ImageProps['src'] | undefined): ImageProps['src'] | undefined {
  if (typeof src !== 'string') {
    // Static imports from the MDX compiler — leave as-is (Next prefixes basePath).
    return src;
  }
  if (src.length === 0) return undefined;
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  return assetPath(src);
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    img: (props) => {
      const Img = defaultMdxComponents.img ?? 'img';
      return <Img {...props} src={resolveMdxImageSrc(props.src as ImageProps['src'])} />;
    },
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
