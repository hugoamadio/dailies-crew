import type { Locale } from '../i18n/locale';

/** Dates in the settings' time zone and money with Intl, in the panel's language */
export interface Formatter {
  /** Spending in US dollars: 2 decimals, 4 below one cent so small costs do not read as zero */
  usd(value: number): string;
  /** A product price from cents in its own currency */
  price(cents: number, currency: string): string;
  dateTime(date: Date): string;
  date(date: Date): string;
  time(date: Date): string;
  /** A length in seconds, e.g. "0:42" */
  seconds(value: number): string;
}

export function formatter(locale: Locale, timeZone: string): Formatter {
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone,
  });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone });
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone });
  return {
    usd: (value) => {
      const small = value > 0 && value < 0.01;
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: small ? 4 : 2,
        maximumFractionDigits: small ? 4 : 2,
      }).format(value);
    },
    price: (cents, currency) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100),
    dateTime: (value) => dateTime.format(value),
    date: (value) => date.format(value),
    time: (value) => time.format(value),
    seconds: (value) => {
      const whole = Math.round(value);
      return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
    },
  };
}
