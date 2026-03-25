'use client';

import Link from 'next/link';
import { CarFront, MessageSquareText, Route } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LocaleToggle } from '@/components/ui/LocaleToggle';
import { JourneyCarousel } from '@/components/home/JourneyCarousel';
import { useT } from '@/hooks/useT';

export default function HomePage() {
  const t = useT();
  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-[var(--border-soft)]/50 bg-[var(--bg)]/80 px-6 py-3 backdrop-blur-md">
        <span className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-bold text-[var(--text)]">
          NewCar
        </span>
        <div className="flex items-center gap-3">
          <Link href="/community" className="text-[var(--text-sm)] font-medium text-[var(--text-soft)] hover:text-[var(--text)]">
            {t['nav.community']}
          </Link>
          <ThemeToggle />
          <LocaleToggle />
          <Link href="/login">
            <Button size="sm">{t['nav.login']}</Button>
          </Link>
        </div>
      </nav>

      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-20">
        <section className="grid w-full items-center gap-8 md:grid-cols-2">
          <div>
            <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.16em] text-[var(--accent-text-soft)]">
              {t['home.badge']}
            </p>
            <h1 className="mt-4 font-[family-name:var(--font-display)] text-[var(--text-4xl)] font-extrabold leading-[var(--leading-tight)] text-[var(--text)]">
              {t['home.title']}
            </h1>
            <p className="mt-1 font-[family-name:var(--font-display)] text-[var(--text-xl)] text-[var(--text-soft)]">
              {t['home.subtitle']}
            </p>
            <p className="mt-5 text-[var(--text-base)] leading-[var(--leading-relaxed)] text-[var(--text-soft)]">
              {t['home.desc']}
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/login"><Button size="lg">{t['home.cta.start']}</Button></Link>
              <Link href="/community"><Button variant="secondary" size="lg">{t['home.cta.community']}</Button></Link>
            </div>
          </div>
          <JourneyCarousel t={t} />
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text)]">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-muted)] text-[var(--accent-text)]">
                <Route className="h-4 w-4" aria-hidden="true" />
              </span>
              {t['home.feature.kanban.title']}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              {t['home.feature.kanban.desc']}
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text)]">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-muted)] text-[var(--accent-text)]">
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
              </span>
              {t['home.feature.ai.title']}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              {t['home.feature.ai.desc']}
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text)]">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-muted)] text-[var(--accent-text)]">
                <CarFront className="h-4 w-4" aria-hidden="true" />
              </span>
              {t['home.feature.review.title']}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              {t['home.feature.review.desc']}
            </p>
          </article>
        </section>
      </main>
    </>
  );
}
