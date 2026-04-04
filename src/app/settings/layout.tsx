import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paramètres",
  description: "Configurez vos alertes, préférences et seuils de notification.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
