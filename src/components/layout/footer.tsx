import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
          <span className="font-medium text-slate-700">StockScanner</span>
          <Link href="/scanner?strategy=buffett" className="hover:text-slate-900 transition-colors">Scanner</Link>
          <Link href="/strategies" className="hover:text-slate-900 transition-colors">Stratégies</Link>
          <Link href="/compare" className="hover:text-slate-900 transition-colors">Comparateur</Link>
          <Link href="/watchlist" className="hover:text-slate-900 transition-colors">Watchlist</Link>
        </div>
        <p className="text-xs text-slate-400 text-center max-w-2xl mx-auto">
          Outil d&apos;aide à la décision et d&apos;analyse fondamentale.
          Les scores et classements sont fournis à titre éducatif uniquement.
          Cet outil ne constitue en aucun cas un conseil en investissement,
          une recommandation d&apos;achat ou de vente, ni une garantie de performance.
          Les données peuvent être incomplètes ou retardées.
          Consultez un professionnel avant toute décision financière.
        </p>
      </div>
    </footer>
  );
}
