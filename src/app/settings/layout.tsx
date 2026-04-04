import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parametres",
  description: "Configurez vos alertes, preferences et seuils de notification.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
