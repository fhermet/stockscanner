import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const SITE_NAME = "StockScanner";
const SITE_DESCRIPTION =
  "Choisissez une strategie d'investissement (Buffett, Lynch, Growth, Dividende) et decouvrez les actions les mieux classees parmi 340+ titres US et europeens.";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — Trouvez les actions qui correspondent a votre strategie`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "stock screener",
    "analyse fondamentale",
    "investissement",
    "strategie",
    "Buffett",
    "dividende",
    "croissance",
    "scoring actions",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Scanner d'actions par strategie d'investissement`,
    description: SITE_DESCRIPTION,
    locale: "fr_FR",
  },
  twitter: {
    card: "summary",
    title: `${SITE_NAME} — Scanner d'actions par strategie`,
    description: SITE_DESCRIPTION,
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
      <body className={`${inter.className} flex min-h-screen flex-col`}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
