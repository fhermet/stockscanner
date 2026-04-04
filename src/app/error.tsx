"use client";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-5xl mb-4">&#9888;&#65039;</p>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Une erreur est survenue
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Le chargement de cette page a echoue. Cela peut etre du a un probleme
        temporaire avec les donnees ou le reseau.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
      >
        Reessayer
      </button>
    </div>
  );
}
