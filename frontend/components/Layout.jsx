function Layout({ children }) {
  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <header className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Prompt VCS
          </p>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-zinc-950 md:text-3xl">
                Prompt Version Control Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                Manage prompts, versions, datasets, evaluations, promotions, and rollbacks from one compact workspace.
              </p>
            </div>
          </div>
        </header>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </section>
    </main>
  );
}

export default Layout;
