import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  const title = "Get Me Home · Adelaide";
  const description = "Every useful one-seat Adelaide Metro option from Adelaide Railway Station toward Henley Beach, with conservative final walking times.";
  return {
    title,
    description,
    applicationName: "Get Me Home",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Get Me Home" },
    formatDetection: { telephone: false },
    openGraph: { title, description, type: "website", images: [{ url: image, width: 1732, height: 909, alt: "Get Me Home Adelaide departures board" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1411" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-AU"><body>{children}</body></html>;
}
