export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 text-center space-y-1">
        <p className="text-sm text-slate-500">
          StockScanner &mdash; Outil d&apos;aide à la décision et d&apos;analyse fondamentale.
        </p>
        <p className="text-xs text-slate-400">
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
