import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
		}),
});

const pages = defineCollection({
	// Load Markdown files in the `src/content/pages/` directory.
	loader: glob({ base: './src/content/pages', pattern: '**/*.md' }),
	// Type-check frontmatter using a schema
	schema: z.object({
		title: z.string(),
		intro: z.string().optional(),
		// Homepage hero fields
		heroEyebrow: z.string().optional(),
		heroTitle: z.string().optional(),
		heroSubtitle: z.string().optional(),
		primaryButtonText: z.string().optional(),
		primaryButtonUrl: z.string().optional(),
		secondaryButtonText: z.string().optional(),
		secondaryButtonUrl: z.string().optional(),
		heroImage: z.string().optional(),
		latestPostsTitle: z.string().optional(),
	}),
});

export const collections = { blog, pages };
