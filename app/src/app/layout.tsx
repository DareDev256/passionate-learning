import type { Metadata, Viewport } from "next";
import { StickDefs } from "@/art/Stick";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://passionate-learning.vercel.app"),
  title: "Passionate Learning | Learn AI in 60-second rounds",
  description: "A free learning game about AI and tech, drawn in stickman. 60-second rounds, a System that levels you up, memes that explain, no streak that punishes you. Built in the open.",
  applicationName: "Passionate Learning",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Passionate", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  openGraph: { title: "Passionate Learning", description: "Learn AI in 60-second rounds. Stickman memes, a System that levels you up, no streak guilt.", images: ["/og.png"], type: "website" },
  twitter: { card: "summary_large_image", title: "Passionate Learning", description: "Learn AI in 60-second rounds.", images: ["/og.png"] },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StickDefs />
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
