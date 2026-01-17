import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import "./globals.css";


const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pörssisähkön hinta - Eino IT",
  description: "Helppokäyttöinen pörssisähkön hinnan visualisaatio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${raleway.className} dark`}
      >
        {children}
      </body>
    </html>
  );
}
