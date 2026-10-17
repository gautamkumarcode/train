import type { Metadata, Viewport } from "next";
import "./globals.css";

/** Canonical site origin used for absolute OG/Twitter URLs. */
const SITE_URL = "https://yatrikripyadhyandein.in";
const SITE_NAME = "YatriKripya";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} · Live Train Tracking & Lo-Fi Carriage`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "A nostalgic, lo-fi Indian Railways companion — track any 5-digit train live, " +
    "loop sleeper-car ambience, and pull the emergency chain for a burst of platform " +
    "chai, loco horns and wheel-clack.",
  keywords: [
    "Indian Railways",
    "live train status",
    "IRCTC",
    "lo-fi",
    "sleeper coach",
    "train tracking",
    "YatriKripya",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": `${SITE_URL}/rss` },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_IN",
    title: `${SITE_NAME} · Live Train Tracking & Lo-Fi Carriage`,
    description:
      "Track any Indian Railways train live inside a dim, nostalgic sleeper coach — " +
      "looping ambience, interactive platform sounds, and the emergency chain.",
    images: [
      {
        url: `${SITE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "YatriKripya departure board glowing in a dark sleeper coach",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} · Live Train Tracking & Lo-Fi Carriage`,
    description:
      "Track any Indian Railways train live in a nostalgic, lo-fi sleeper coach.",
    creator: "@yatrikripya",
    images: [`${SITE_URL}/opengraph-image`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "entertainment",
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="h-[100svh] overflow-hidden bg-berth-night font-display text-coach-cream antialiased">
        {/* Fixed nostalgic overlays render above content but ignore pointer events. */}
        {children}
        <div className="carriage-vignette" aria-hidden />
        <div className="crt-scanlines" aria-hidden />
      </body>
    </html>
  );
}
