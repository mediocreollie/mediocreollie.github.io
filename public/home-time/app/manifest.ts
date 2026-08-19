import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Get Me Home · Adelaide",
    short_name: "Get Me Home",
    description: "Useful one-seat Adelaide Metro options toward Henley Beach.",
    start_url: "./",
    display: "standalone",
    background_color: "#f1f3ee",
    theme_color: "#176b4b",
    orientation: "portrait",
  };
}
