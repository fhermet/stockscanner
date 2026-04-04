import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const SITE_NAME = "StockScanner";
const SITE_DESCRIPTION =
  "Choisissez une stratégie d'investissement (Buffett, Lynch, Growth, Dividende) et découvrez les actions les mieux classées parmi 340+ titres US et européens.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://stockscanner.app"),
  title: {
    default: `${SITE_NAME} — Trouvez les actions qui correspondent à votre stratégie`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "stock screener",
    "analyse fondamentale",
    "investissement",
    "stratégie",
    "Buffett",
    "dividende",
    "croissance",
    "scoring actions",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Scanner d'actions par stratégie d'investissement`,
    description: SITE_DESCRIPTION,
    locale: "fr_FR",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary",
    title: `${SITE_NAME} — Scanner d'actions par stratégie`,
    description: SITE_DESCRIPTION,
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: SITE_NAME,
              description: SITE_DESCRIPTION,
              applicationCategory: "FinanceApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "EUR",
              },
              inLanguage: "fr",
            }),
          }}
        />
      </head>
      <body className={`${inter.className} flex min-h-screen flex-col`}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
