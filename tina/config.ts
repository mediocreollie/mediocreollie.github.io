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