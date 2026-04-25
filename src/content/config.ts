import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Esquema común de artículo
const articleSchema = z.object({
  title: z.string(),
  deck: z.string().optional(),          // bajada / subtítulo
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  author: z.string(),
  authorBio: z.string().optional(),
  section: z.enum([
    'colombia', 'general', 'economia', 'politica', 'cultura',
    'tendencias', 'opinion', 'internacional', 'deportes', 'entretenimiento',
  ]),
  heroImage: z.string().optional(),
  heroAlt: z.string().optional(),
  lang: z.enum(['es', 'en']).default('es'),
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  source: z.enum(['original', 'afp', 'ap', 'reuters', 'efe']).default('original'),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/news' }),
  schema: articleSchema,
});

const opinion = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/opinion' }),
  schema: articleSchema.extend({
    approved: z.boolean().default(false), // pendiente de moderación
    submittedAt: z.coerce.date().optional(),
  }),
});

const wires = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/wires' }),
  schema: articleSchema.extend({
    externalId: z.string().optional(),
    wireTimestamp: z.string().optional(),
  }),
});

export const collections = { news, opinion, wires };
