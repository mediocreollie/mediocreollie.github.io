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
			description: z.string().optional(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			draft: z.boolean().optional().default(false),
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
		heroImageMaxWidth: z.string().optional(),
		heroImageHeight: z.string().optional(),
		heroImageObjectFit: z.string().optional(),
		heroImageColumnWidth: z.string().optional(),
		heroImageTranslateX: z.string().optional(),
		mobileHeroImageMaxWidth: z.string().optional(),
		mobileHeroImageHeight: z.string().optional(),
		mobileHeroImageObjectFit: z.string().optional(),
		mobileHeroImageTranslateX: z.string().optional(),
		mobileHeroTextAlign: z.string().optional(),
		mobileHeroTitleSize: z.string().optional(),
		mobileShowHeroImage: z.boolean().optional(),
		latestPostsTitle: z.string().optional(),
		metrics: z.array(
			z.object({
				value: z.string(),
				label: z.string(),
			})
		).optional(),
		tabs: z.array(
			z.object({
				label: z.string(),
				heading: z.string().optional(),
				intro: z.string().optional(),
				body: z.string().optional(),
				bullets: z.array(z.string()).optional(),
				relatedProjects: z.array(
					z.object({
						title: z.string().optional(),
						url: z.string().optional(),
					})
				).optional(),
				projects: z.array(
					z.object({
						title: z.string(),
						summary: z.string().optional(),
						challenge: z.string().optional(),
						approach: z.string().optional(),
						outcome: z.string().optional(),
						metrics: z.array(
							z.object({
								label: z.string().optional(),
								value: z.string().optional(),
							})
						).optional(),
						tags: z.array(z.string()).optional(),
						images: z.array(
							z.object({
								src: z.string().optional(),
								alt: z.string().optional(),
								caption: z.string().optional(),
							})
						).optional(),
						links: z.array(
							z.object({
								label: z.string().optional(),
								url: z.string().optional(),
							})
						).optional(),
					})
				).optional(),
			})
		).optional(),
		featureCards: z.array(
			z.object({
				title: z.string(),
				description: z.string().optional(),
			})
		).optional(),
	}),
});

const settings = defineCollection({
	// Load Markdown files in the `src/content/settings/` directory.
	loader: glob({ base: './src/content/settings', pattern: '**/*.md' }),
	// Type-check frontmatter using a schema
	schema: z.object({
		siteTitle: z.string(),
		navLinks: z.array(
			z.object({
				label: z.string(),
				url: z.string(),
			})
		).optional(),
		socialLinks: z.array(
			z.object({
				label: z.string(),
				url: z.string(),
				icon: z.string().optional(),
			})
		).optional(),
		footerText: z.string().optional(),
		footerShowSocialLinks: z.boolean().optional().default(true),
	}),
});

export const collections = { blog, pages, settings };
