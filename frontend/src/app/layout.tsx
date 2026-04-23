import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aegis One - Unbiased AI Decision",
  description: "AI Bias Detection & Mitigation Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} antialiased min-h-screen bg-cosmic-navy text-soft-white font-sans`}
      >
        <div className="fixed inset-0 pointer-events-none z-0 opacity-40">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-electric-cyan/10 rounded-full blur-[100px] animate-float"></div>
          <div className="absolute bottom-0 right-[20%] w-[300px] h-[300px] bg-amethyst-purple/15 rounded-full blur-[80px] animate-float-delayed"></div>
        </div>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
