import { useState } from 'react'
import { ArrowRight, Box, Brush, Crosshair, Github, Scissors } from 'lucide-react'

export function Landing({ onEnter }: { onEnter: () => void }) {
  const [leaving, setLeaving] = useState(false)

  const enter = () => {
    if (leaving) return
    setLeaving(true)
    onEnter()
  }

  return (
    <main
      data-testid="landing-page"
      className={`relative h-full w-full overflow-x-hidden overflow-y-auto bg-[#08090d] text-white ${leaving ? 'of-landing-leave' : 'of-landing-enter'}`}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-[-28rem] h-[48rem] w-[48rem] -translate-x-1/2 rounded-full bg-brand/15 blur-[120px]" />
        <div className="absolute bottom-[-20rem] right-[-12rem] h-[38rem] w-[38rem] rounded-full bg-cyan-400/10 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 sm:px-8">
        <header className="flex h-16 shrink-0 items-center justify-between">
          <div className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white shadow-lg shadow-brand/20"><Scissors size={16} /></span>
            OmniFrame
          </div>
          <a
            href="https://github.com/ChibuikeOnuigbo/OmniFrame"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Github size={16} /> <span className="hidden sm:inline">Open source</span>
          </a>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1fr_1.05fr] lg:py-14">
          <div className="max-w-xl of-hero-copy">
            <h1 className="text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-6xl">
              Edit video.<br /><span className="text-ink-400">Keep your flow.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-ink-400 sm:text-lg">
              A fast, local-first editor for precise cuts, responsive timelines, and clean exports.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={enter}
                disabled={leaving}
                className="group flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold shadow-lg shadow-brand/20 transition-all hover:-translate-y-0.5 hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:pointer-events-none"
              >
                Open Studio <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

            <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
              {[
                [Brush, 'Masking', 'Shape and isolate'],
                [Crosshair, 'Tracking', 'Follow motion'],
                [Box, '3D editing', 'Compose in depth'],
              ].map(([Icon, title, note]) => {
                const FeatureIcon = Icon as typeof Scissors
                return (
                  <div key={String(title)} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                    <FeatureIcon size={15} className="mb-3 text-brand-400" />
                    <div className="text-xs font-medium text-ink-100">{String(title)}</div>
                    <div className="mt-1 text-[11px] leading-4 text-ink-500">{String(note)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="of-hero-visual relative mx-auto w-full max-w-[620px]" aria-label="OmniFrame editor preview">
            <div className="absolute -inset-5 rounded-[2rem] bg-brand/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl shadow-black/50">
              <div className="flex h-9 items-center border-b border-white/[0.07] px-3">
                <div className="flex gap-1.5"><i className="h-2 w-2 rounded-full bg-white/15" /><i className="h-2 w-2 rounded-full bg-white/10" /><i className="h-2 w-2 rounded-full bg-white/10" /></div>
                <div className="mx-auto text-[9px] font-medium tracking-wide text-ink-500">OMNIFRAME STUDIO</div>
              </div>
              <div className="grid aspect-[16/10] grid-cols-[52px_1fr]">
                <div className="border-r border-white/[0.06] p-2">
                  {[0,1,2,3,4].map((n)=><div key={n} className={`mx-auto mb-2 h-7 w-7 rounded-md ${n===0?'bg-brand':'bg-white/[0.04]'}`} />)}
                </div>
                <div className="grid min-w-0 grid-rows-[1fr_112px]">
                  <div className="m-3 overflow-hidden rounded-lg border border-white/[0.06] bg-black">
                    <div className="h-full w-full bg-[radial-gradient(circle_at_65%_35%,rgba(109,94,252,.35),transparent_35%),linear-gradient(145deg,#161a23,#08090d)]" />
                  </div>
                  <div className="border-t border-white/[0.06] bg-[#0d1018] px-3 py-3">
                    <div className="mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand" /><span className="h-px flex-1 bg-white/10" /></div>
                    <div className="relative space-y-2">
                      <div className="flex h-7 gap-1"><span className="w-[27%] rounded bg-brand/35" /><span className="w-[36%] rounded bg-brand/25" /><span className="w-[22%] rounded bg-cyan-400/20" /></div>
                      <div className="flex h-5 gap-1 pl-[12%]"><span className="w-[42%] rounded bg-violet-400/15" /><span className="w-[20%] rounded bg-violet-400/10" /></div>
                      <span className="absolute -top-3 bottom-0 left-[48%] w-px bg-brand"><i className="absolute -left-1 -top-1 h-2 w-2 rotate-45 bg-brand" /></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex shrink-0 items-center justify-between border-t border-white/[0.06] py-5 text-[11px] text-ink-500">
          <span>Built in the open.</span><span>Local-first · Cross-platform</span>
        </footer>
      </div>
    </main>
  )
}
