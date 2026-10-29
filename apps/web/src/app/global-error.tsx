'use client';

import { en } from '../i18n/en';
import { ptBR } from '../i18n/pt-BR';

/**
 * Last resort: the root layout itself failed. No details here (they are in the panel's terminal),
 * in both languages because no request context is reachable from this boundary.
 */
export default function GlobalError() {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <main
          style={{ maxWidth: '32rem', margin: '6rem auto', padding: '0 1rem', textAlign: 'center' }}
        >
          <p>{en.common.unexpected}</p>
          <p>{ptBR.common.unexpected}</p>
        </main>
      </body>
    </html>
  );
}
