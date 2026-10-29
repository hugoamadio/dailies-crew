import fs from 'node:fs/promises';
import path from 'node:path';
import type { Db } from '@dailies-crew/db';
import { testContext } from '../../../../packages/studio/test/studio';
import { dictionaryFor } from '../i18n/dictionary';
import type { Panel } from '../lib/panel';

/** The English texts, as the actions get them */
export const t = dictionaryFor('en');

/** A panel on the test database: jobs kept in memory, schedule syncs counted */
export function testPanel(db: Db, dataDir: string) {
  const ctx = testContext(db, dataDir);
  const panel = {
    ctx,
    env: {} as Record<string, string | undefined>,
    syncs: 0,
    syncSchedules: async () => {
      panel.syncs += 1;
    },
    close: async () => undefined,
  };
  return panel satisfies Panel;
}

/** A form as the browser sends it, files included */
export function formOf(fields: Record<string, string | string[] | File | File[]>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const each of Array.isArray(value) ? value : [value]) form.append(name, each);
  }
  return form;
}

/** A file from disk as an upload */
export async function upload(file: string): Promise<File> {
  return new File([await fs.readFile(file)], path.basename(file));
}
