
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Using Inter as a fallback
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans', // Using a generic variable name
});

export const metadata: Metadata = {
  title: 'Vector Canvas',
  description: 'A simple vector graphics editor.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
