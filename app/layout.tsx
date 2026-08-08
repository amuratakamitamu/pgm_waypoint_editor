import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PGM Waypoint Editor",
  description: "PGM Waypoint Editor",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
