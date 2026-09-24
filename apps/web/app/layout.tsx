import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MC Hosting",
  description: "Minecraft hosting control panel"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}