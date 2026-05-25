import { defineConfig } from "tinacms";

const branch =
  process.env.GITHUB_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  "main";

export default defineConfig({
  branch,

  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },

  media: {
    tina: {
      mediaRoot: "",
      publicFolder: "public",
    },
  },

  schema: {
    collections: [
      {
        name: "blog",
        label: "Blog Posts",
        path: "src/content/blog",
        format: "mdx",
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "description",
            label: "Description",
            required: true,
          },
          {
            type: "datetime",
            name: "pubDate",
            label: "Publication Date",
            required: true,
          },
          {
            type: "datetime",
            name: "updatedDate",
            label: "Updated Date",
          },
          {
            type: "image",
            name: "heroImage",
            label: "Hero Image",
          },
          {
            type: "rich-text",
            name: "body",
            label: "Body",
            isBody: true,
          },
        ],
      },
      {
        name: "pages",
        label: "Pages",
        path: "src/content/pages",
        format: "md",
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "intro",
            label: "Intro",
          },
          {
            type: "string",
            name: "heroEyebrow",
            label: "Hero eyebrow",
          },
          {
            type: "string",
            name: "heroTitle",
            label: "Hero title",
          },
          {
            type: "string",
            name: "heroSubtitle",
            label: "Hero subtitle",
          },
          {
            type: "object",
            list: true,
            name: "metrics",
            label: "Metrics row",
            description: "Optional metric cards shown above the tabs",
            fields: [
              { type: "string", name: "value", label: "Metric value" },
              { type: "string", name: "label", label: "Metric label" },
            ],
          },
          {
            type: "object",
            list: true,
            name: "tabs",
            label: "About tabs",
            description: "Define the tab items shown on the About page",
            fields: [
              { type: "string", name: "label", label: "Tab label", required: true },
              { type: "string", name: "heading", label: "Heading" },
              {
                type: "string",
                name: "intro",
                label: "Intro text",
                ui: { component: "textarea" },
              },
              {
                type: "string",
                name: "body",
                label: "Body text",
                ui: { component: "textarea" },
              },
              {
                type: "string",
                list: true,
                name: "bullets",
                label: "Bullet list",
              },
              {
                type: "object",
                list: true,
                name: "relatedProjects",
                label: "Related projects",
                fields: [
                  { type: "string", name: "title", label: "Project title" },
                  { type: "string", name: "url", label: "Project URL" },
                ],
              },
            ],
          },
          {
            type: "object",
            list: true,
            name: "featureCards",
            label: "Feature cards",
            description: "Optional feature cards shown on the home page",
            fields: [
              { type: "string", name: "title", label: "Card title", required: true },
              {
                type: "string",
                name: "description",
                label: "Card description",
                ui: { component: "textarea" },
              },
            ],
          },
          {
            type: "rich-text",
            name: "body",
            label: "Body",
            isBody: true,
          },
        ],
      },
      {
        name: "settings",
        label: "Site Settings",
        path: "src/content/settings",
        format: "md",
        fields: [
          {
            type: "string",
            name: "siteTitle",
            label: "Site Title",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "footerText",
            label: "Footer text",
            description: "Copyright notice and footer text",
          },
          {
            type: "string",
            name: "blogListingTitle",
            label: "Blog listing page title",
          },
          {
            type: "string",
            name: "blogListingIntro",
            label: "Blog listing page intro",
            ui: { component: "textarea" },
          },
          {
            type: "object",
            list: true,
            name: "navLinks",
            label: "Navigation Links",
            fields: [
              {
                type: "string",
                name: "label",
                label: "Link Label",
                required: true,
              },
              {
                type: "string",
                name: "url",
                label: "Link URL",
                required: true,
              },
            ],
          },
          {
            type: "object",
            list: true,
            name: "socialLinks",
            label: "Social Links",
            fields: [
              {
                type: "string",
                name: "label",
                label: "Social Label",
                required: true,
              },
              {
                type: "string",
                name: "url",
                label: "Social URL",
                required: true,
              },
              {
                type: "string",
                name: "icon",
                label: "Icon",
                description: "Icon name: mastodon, twitter, github",
              },
            ],
          },
        ],
      },
    ],
  },
});