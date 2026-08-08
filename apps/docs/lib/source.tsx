import { loader } from 'fumadocs-core/source';
import { docsContentRoute, docsImageRoute, docsRoute } from './shared';
import { defineDocs } from 'fumadocs-mdx/macro';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { z } from 'zod';

/** Docs OG art: screenshot = in-context screen capture; render = feature chrome only. */
export const ogImageSchema = z
  .object({
    image: z
      .string()
      .optional()
      .describe('Public path, e.g. /images/features-trayview-compact.png'),
    type: z.enum(['screenshot', 'render', 'render-auto']).default('screenshot'),
    /** Manual accent hex (`#rrggbb` or `rrggbb`). Skips vibrant extraction when set. */
    color: z
      .string()
      .regex(/^#?[0-9a-fA-F]{6}$/, 'Expected hex color like #d6491c')
      .optional(),
  })
  .optional();

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema.extend({
      og: ogImageSchema,
      /** Sidebar label badge, e.g. `Removed`. */
      badge: z.string().optional(),
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  plugins: [],
  pageTree: {
    transformers: [
      {
        file(node, filePath) {
          if (!filePath) return node;

          const file = this.storage.read(filePath);
          if (!file || file.format !== 'page') return node;

          const badge = (file.data as { badge?: string }).badge;
          if (!badge) return node;

          node.name = (
            <span className="inline-flex items-center gap-2">
              <span>{node.name}</span>
              <span className="rounded-full border border-fd-border bg-fd-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-fd-muted-foreground">
                {badge}
              </span>
            </span>
          );

          return node;
        },
      },
    ],
  },
});

export function getPageImageUrl(page: (typeof source)['$inferPage']) {
  const segments = [...page.slugs, 'image.png'];

  return {
    segments,
    url: '/' + [page.locale, ...docsImageRoute.split('/'), ...segments].filter(Boolean).join('/'),
  };
}

export function getPageMarkdownUrl(page: (typeof source)['$inferPage']) {
  const segments = [...page.slugs, 'content.md'];

  return {
    segments,
    url: '/' + [page.locale, ...docsContentRoute.split('/'), ...segments].filter(Boolean).join('/'),
  };
}

export async function getLLMText(page: (typeof source)['$inferPage']) {
  const processed = await page.data.getText('processed');

  return `# ${page.data.title} (${page.url})

${processed}`;
}
