import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import { AuthButtons } from "@/components/auth-buttons";
import { Logo } from "@/components/logo";

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
        <div className="p-4 py-2 border-b flex items-center justify-between bg-white dark:bg-gray-900">
          <Logo />
          <AuthButtons />
        </div>
        <div className="container mx-auto max-w-7xl px-4">{children}</div>
      </body>
    </html>
  );
}
