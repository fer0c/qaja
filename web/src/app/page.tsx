import { Suspense } from "react";
import { connection } from "next/server";

import { fetchApiHealth } from "@/lib/api";

async function ApiStatusCard() {
  await connection();
  const health = await fetchApiHealth();

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-medium">Estado del servicio API</h2>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
            health.ok
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              health.ok ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          {health.ok ? "Conectado" : "Sin conexión"}
        </span>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-zinc-500">Endpoint consultado:</dt>
          <dd className="font-mono text-xs">{health.url}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-zinc-500">Proxy interno:</dt>
          <dd className="font-mono text-xs">/api/health</dd>
        </div>
      </dl>

      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-100 p-4 font-mono text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {JSON.stringify(
          health.ok ? health.data : { error: health.error },
          null,
          2
        )}
      </pre>
    </section>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-6 py-12 font-sans">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
          qaja monorepo
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Next.js + FastAPI on Railway
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Frontend (<code className="font-mono">web/</code> con pnpm) y backend (
          <code className="font-mono">api/</code> con uv) desplegados como servicios
          aislados dentro del mismo proyecto.
        </p>
      </header>

      <Suspense
        fallback={
          <section className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            Consultando estado del servicio API...
          </section>
        }
      >
        <ApiStatusCard />
      </Suspense>
    </main>
  );
}
