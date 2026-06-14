// The writings datastore — an Astro content collection (Astro 5 glob loader).
// `/writings` is the home for Fundamental writing: research, releases, features, notes.
// Markdown lives in src/content/writings/*.md; each file's frontmatter is typed below.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const writings = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writings' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    /** publication / sort date. */
    date: z.coerce.date(),
    /** the kind of writing — drives grouping + the badge. */
    category: z.enum(['research', 'release', 'feature', 'note']).default('note'),
    author: z.string().default('Zach Shallbetter'),
    /** optional series this entry belongs to (e.g. the research paper family). */
    series: z.string().optional(),
    /** order within a series (and a secondary sort). */
    order: z.number().optional(),
    /** hide from listings while drafting. */
    draft: z.boolean().default(false),
    /** a short one-line summary for the index cards. */
    summary: z.string().optional(),
  }),
});

export const collections = { writings };
