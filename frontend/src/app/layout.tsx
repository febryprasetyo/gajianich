import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { BRAND_DESCRIPTION, BRAND_NAME } from '@/lib/gajianichBrand';

export const metadata: Metadata = {
  title: `${BRAND_NAME} | ${BRAND_DESCRIPTION}`,
  description: BRAND_DESCRIPTION,
  applicationName: BRAND_NAME,
  icons: {
    icon: "/favicon.ico?v=gajianich-1",
    apple: "/branding/gajianich-cat-favicon.png",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#059669',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className="h-full antialiased light"
      style={{ colorScheme: 'light' }}
    >
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-[#0F172A]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
