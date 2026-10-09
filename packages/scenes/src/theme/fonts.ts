import type { FontName } from '@dailies-crew/plan';
import { loadFont as loadBebasNeue } from '@remotion/google-fonts/BebasNeue';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import { loadFont as loadPlayfairDisplay } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as loadPoppins } from '@remotion/google-fonts/Poppins';
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk';

interface FontEntry {
  load: () => { fontFamily: string; waitUntilDone: () => Promise<unknown> };
  /** Weight used for headings: the heaviest the font has */
  headingWeight: number;
}

/** "latin-ext" carries the Portuguese accents */
export const FONT_TABLE: Record<FontName, FontEntry> = {
  Inter: {
    load: () => loadInter('normal', { weights: ['400', '700', '900'], subsets: ['latin', 'latin-ext'] }),
    headingWeight: 900,
  },
  Montserrat: {
    load: () => loadMontserrat('normal', { weights: ['400', '700', '900'], subsets: ['latin', 'latin-ext'] }),
    headingWeight: 900,
  },
  Poppins: {
    load: () => loadPoppins('normal', { weights: ['400', '700', '900'], subsets: ['latin', 'latin-ext'] }),
    headingWeight: 900,
  },
  'Bebas Neue': {
    load: () => loadBebasNeue('normal', { weights: ['400'], subsets: ['latin', 'latin-ext'] }),
    headingWeight: 400,
  },
  'Playfair Display': {
    load: () => loadPlayfairDisplay('normal', { weights: ['400', '700', '900'], subsets: ['latin', 'latin-ext'] }),
    headingWeight: 900,
  },
  'Space Grotesk': {
    load: () => loadSpaceGrotesk('normal', { weights: ['400', '700'], subsets: ['latin', 'latin-ext'] }),
    headingWeight: 700,
  },
};

const loaded = new Map<FontName, { family: string; ready: Promise<unknown> }>();

/** Loads a brand font once per page; `ready` settles when the browser can draw it */
export function loadBrandFont(name: FontName): { family: string; ready: Promise<unknown> } {
  let font = loaded.get(name);
  if (!font) {
    const result = FONT_TABLE[name].load();
    font = { family: result.fontFamily, ready: result.waitUntilDone() };
    loaded.set(name, font);
  }
  return font;
}
