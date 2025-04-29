import './globals.css';
import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import { Manrope, Sora } from "next/font/google";
import { cn } from "@/lib/utils"; // Assuming you have this utility

const manrope = Manrope({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-manrope',
  weight: ['200', '300', '400', '500', '600', '700', '800']
});

const sora = Sora({
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-sora',
  weight: ['400', '600', '700']
});

// Load Space Grotesk font
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Cloudio - AWS Architecture Designer',
  description: 'Design and visualize AWS cloud architectures with AI-powered tools',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full ${manrope.variable} ${sora.variable} ${spaceGrotesk.variable}`}>
      <body className={cn("h-full font-sans antialiased bg-white text-black", manrope.className)}>
        {children}
      </body>
    </html>
  );
}
