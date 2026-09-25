/**
 * Landing page — a STATIC page.
 *
 * It lives at the top level of src/pages/ (not under (app)/), so it renders
 * with no DeepSpace providers: no auth session fetch, no records WebSocket.
 * That makes it cheap to serve and safe for logged-out / crawler traffic.
 *
 * Need live data or auth here? Move this file to src/pages/(app)/index.tsx
 * and it becomes a dynamic page. Conversely, any page you want to keep static
 * (marketing, docs, legal) belongs at this top level.
 */

import { Link } from 'react-router-dom'
import { Compass, Map, Shield, Sparkles, Swords, Users } from 'lucide-react'
import { APP_NAME } from '../constants'

export default function Landing() {
  return (
    <main data-testid="static-landing" className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_top,#312e8140,transparent_42%)]" />
      <div aria-hidden className="absolute -right-40 top-28 h-96 w-96 rounded-full border border-primary/15" />
      <div aria-hidden className="absolute -right-16 top-44 h-64 w-64 rounded-full border border-primary/10" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Map className="size-5" aria-hidden />
            </span>
            {APP_NAME}
          </Link>
          <Link to="/home" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Sign in
          </Link>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16 lg:py-20">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.22em] text-primary">
              <Sparkles className="size-4" aria-hidden /> Your campaign, mapped
            </p>
            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Every adventure deserves a shared table.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Build your party, place your heroes, and explore every encounter together in a live D&amp;D game board.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/home"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Enter DungeonAtlas <Compass className="size-4" aria-hidden />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-lg border border-border bg-card/60 px-5 py-3 text-sm font-semibold text-card-foreground transition-colors hover:bg-card"
              >
                How it works
              </a>
            </div>
          </div>

          <div id="how-it-works" className="mt-16 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Shield, title: 'Gather your party', text: 'Create a private, password-protected space for your campaign.' },
              { icon: Swords, title: 'Run the encounter', text: 'Dungeons Masters shape terrain, tokens, and the unfolding scene.' },
              { icon: Users, title: 'Play together', text: 'Everyone sees the board update together, wherever they are.' },
            ].map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-xl border border-border bg-card/70 p-5 shadow-sm">
                <Icon className="size-5 text-primary" aria-hidden />
                <h2 className="mt-4 font-semibold text-card-foreground">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="text-xs text-muted-foreground">A collaborative Dungeons &amp; Dragons game board.</footer>
      </div>
    </main>
  )
}
