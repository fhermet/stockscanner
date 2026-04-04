import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-brand-600 mb-4">404</p>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Page introuvable
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Cette page n&apos;existe pas ou a ete deplacee.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          Retour a l&apos;accueil
        </Link>
        <Link
          href="/scanner?strategy=buffett"
          className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Ouvrir le scanner
        </Link>
      </div>
    </div>
  );
}
