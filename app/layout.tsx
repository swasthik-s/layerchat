import type { Metadata } from "next";
import "./globals.css";
import { validateConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "LayerChat - Multi-Model AI Assistant",
  description: "ChatGPT-style AI web app with multi-model and multi-agent support",
};

// Validate configuration on server startup
if (typeof window === 'undefined') {
  validateConfig()
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* KaTeX CSS for math rendering */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css"
          integrity="sha384-GvrOXuhMATgEsSwCs4smul74iXGOixntILdUW9XmUC6+HX0sLNAK3q71HotJqlAn"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className="font-sans antialiased"
      >
        {children}
      </body>
    </html>
  );
}
