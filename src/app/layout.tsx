import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import { MainLayout } from "@/components/main-layout";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SuperFast AI - Lightning Fast Document Management",
  description:
    "Organize, search, and chat with your documents using lightning fast AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={` ${sora.className} antialiased`}>
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
