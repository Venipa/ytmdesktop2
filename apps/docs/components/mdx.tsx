import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Image, type ImageProps } from 'fumadocs-core/framework';
import type { MDXComponents } from 'mdx/types';
import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { assetPath } from '@/lib/paths';

type MdxImgProps = ImgHTMLAttributes<HTMLImageElement>;

function resolveMdxImageSrc(src: MdxImgProps['src']): ImageProps['src'] {
  if (typeof src === 'string') {
    if (src.length === 0) return undefined;
    if (/^(https?:|data:|blob:)/i.test(src)) return src;
    return assetPath(src);
  }

  // Static imports from the MDX compiler (typed loosely as img src).
  if (src && typeof src === 'object' && !(src instanceof Blob)) {
    return src as unknown as ImageProps['src'];
  }

  return undefined;
}

function MdxImage({ className, src, alt, ...props }: MdxImgProps) {
  return (
    <Image
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 900px"
      {...props}
      src={resolveMdxImageSrc(src)}
      alt={alt ?? ''}
      className={cn('rounded-lg', className)}
    />
  );
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    img: MdxImage,
    ...components,
  };
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
