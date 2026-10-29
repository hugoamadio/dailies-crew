import { StudioError } from '@dailies-crew/studio';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { DatabaseDown, Shell } from '../components/shell';
import { getI18n } from '../i18n/server';
import { getPanel } from '../lib/panel';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Dailies Crew', template: '%s · Dailies Crew' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f6f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d12' },
  ],
};

// every page reads the database: nothing is prerendered at build time
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = await getI18n();
  // null: the panel started; otherwise why not ('' = the database cannot be reached)
  const failure = await getPanel().then(
    () => null,
    (error: unknown) => {
      console.error(error);
      // a StudioError is written for the person (e.g. DATABASE_URL missing); anything else is a
      // connection failure, whose raw text is not shown
      return error instanceof StudioError ? error.message : '';
    },
  );
  return (
    <html lang={locale}>
      <body className="min-h-dvh font-sans antialiased">
        {failure === null ? (
          <Shell locale={locale} t={t}>
            {children}
          </Shell>
        ) : (
          <DatabaseDown t={t} message={failure || undefined} />
        )}
      </body>
    </html>
  );
}
