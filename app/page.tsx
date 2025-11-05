export default function Home() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-white/80 shadow-lg">
        <h2 className="text-lg font-semibold text-white">Board Overview</h2>
        <p className="mt-2 text-sm">
          The interactive board grid and Supabase-powered swap workflows will live here.
          Phase 1 delivers the foundational Next.js scaffold, linting, formatting, and CI
          so subsequent phases can focus on data, actions, and UI experiences.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-white/20 p-6 text-sm text-white/50">
        Placeholder grid container. Upcoming phases will render the 16×16 board here.
      </div>
    </section>
  );
}
