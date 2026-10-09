import type { Brand } from '@dailies-crew/plan';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { cancelRender, continueRender, delayRender } from 'remotion';
import { FONT_TABLE, loadBrandFont } from './fonts';

export type ThemeBrand = Brand & {
  headingFamily: string;
  bodyFamily: string;
  headingWeight: number;
};

const BrandContext = createContext<ThemeBrand | null>(null);

/** Gives every scene the brand, and holds the render until the brand fonts are loaded */
export const BrandProvider: React.FC<{ brand: Brand; children: React.ReactNode }> = ({
  brand,
  children,
}) => {
  const heading = loadBrandFont(brand.headingFont);
  const body = loadBrandFont(brand.bodyFont);
  const [handle] = useState(() =>
    delayRender(`Loading the fonts ${brand.headingFont} and ${brand.bodyFont}`),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([heading.ready, body.ready]).then(
      () => {
        if (!alive) return;
        setReady(true);
        continueRender(handle);
      },
      (error: unknown) => cancelRender(error),
    );
    return () => {
      alive = false;
    };
  }, [heading, body, handle]);

  const value = useMemo<ThemeBrand>(
    () => ({
      ...brand,
      headingFamily: heading.family,
      bodyFamily: body.family,
      headingWeight: FONT_TABLE[brand.headingFont].headingWeight,
    }),
    [brand, heading, body],
  );

  return ready ? <BrandContext.Provider value={value}>{children}</BrandContext.Provider> : null;
};

export function useBrand(): ThemeBrand {
  const brand = useContext(BrandContext);
  if (!brand) throw new Error('useBrand() must be used inside <BrandProvider>');
  return brand;
}
