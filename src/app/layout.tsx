import type { Metadata } from "next";
import { Encode_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

// Encode Sans: designed in Argentina, with a variable width axis used for headlines.
const encodeSans = Encode_Sans({
  variable: "--font-encode-sans",
  subsets: ["latin"],
  axes: ["wdth"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tablero económico de Argentina",
  description: "Tipo de cambio, riesgo país, reservas, inflación y tasas de Argentina, actualizados.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      className={`${encodeSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
