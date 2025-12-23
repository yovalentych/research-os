import type { Metadata } from "next";
import { Manrope, PT_Serif } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Research OS",
  description: "Докторська операційна система для досліджень",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body className={`${manrope.variable} ${ptSerif.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
