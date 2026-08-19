import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f5f0] text-[#16251f]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 sm:px-10 lg:px-16">
        <nav className="flex items-center justify-between border-b border-[#16251f]/15 pb-6">
          <span className="text-sm font-semibold uppercase tracking-[0.28em]">T3 / Convex</span>
          <span className="text-xs uppercase tracking-[0.2em] text-[#16251f]/60">A new beginning</span>
        </nav>
        <section className="grid flex-1 items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <p className="mb-7 text-sm font-medium uppercase tracking-[0.24em] text-[#d06443]">Build what matters</p>
            <h1 className="max-w-3xl text-6xl font-medium leading-[0.95] tracking-[-0.06em] sm:text-8xl">
              Start with a blank canvas.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-[#16251f]/70 sm:text-xl">
              A calm, fast foundation for your next idea. React on the front end, Convex underneath, and plenty of room to make it yours.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <a href="https://docs.convex.dev" className="rounded-full bg-[#16251f] px-6 py-3 text-sm font-semibold text-[#f7f5f0] transition hover:bg-[#d06443]">Explore Convex</a>
              <a href="https://tanstack.com/start" className="rounded-full border border-[#16251f]/25 px-6 py-3 text-sm font-semibold transition hover:border-[#16251f]">Read the stack</a>
            </div>
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-md rounded-[2rem] bg-[#d9e4d8] p-8 sm:p-12">
            <div className="absolute inset-8 rounded-full border border-[#16251f]/15 sm:inset-12" />
            <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d06443] sm:h-44 sm:w-44" />
            <span className="absolute bottom-8 left-8 text-xs uppercase tracking-[0.2em] text-[#16251f]/60 sm:bottom-12 sm:left-12">01 / Begin</span>
          </div>
        </section>
        <footer className="flex flex-col gap-2 border-t border-[#16251f]/15 pt-5 text-xs uppercase tracking-[0.16em] text-[#16251f]/55 sm:flex-row sm:justify-between">
          <span>React + TanStack Start + Convex</span>
          <span>Ready when you are</span>
        </footer>
      </div>
    </main>
  )
}
