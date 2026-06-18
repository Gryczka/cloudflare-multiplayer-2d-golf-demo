import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Cloudflare Multiplayer Golf',
      },
      {
        name: 'theme-color',
        content: '#f97316',
      },
    ],
    links: [
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      {
        rel: 'icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fff7ed] px-6 py-20 text-emerald-950">
      <section className="max-w-xl rounded-[2rem] border border-emerald-900/10 bg-white/90 p-8 text-center shadow-2xl shadow-emerald-950/15 backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-600">
          Out of bounds
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">
          This hole does not exist.
        </h1>
        <p className="mt-4 font-semibold leading-7 text-emerald-900/70">
          The route you opened does not match a golf room or app page. Head back to
          the clubhouse and create or join a room.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-2xl bg-orange-500 px-5 py-3 font-black text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600"
        >
          Back to clubhouse
        </Link>
      </section>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
