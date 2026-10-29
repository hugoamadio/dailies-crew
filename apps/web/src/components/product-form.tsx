'use client';

import type { Product } from '@dailies-crew/db';
import { startTransition, useActionState, useState } from 'react';
import type { Dictionary } from '../i18n/dictionary';
import { fieldError, type FormAction, IDLE } from '../lib/actions/state';
import { FormStatus } from './form-status';
import { filesTooBig } from './upload-limit';
import { useSaves } from './use-saves';
import { buttonClass, Card, Field, fileInputClass, inputClass } from './ui';

/** Cents as the person types money: 8990 → "89.90" */
function money(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2);
}

export function ProductForm(props: {
  action: FormAction;
  t: Dictionary;
  product: Product | null;
  categories: string[];
  currencies: readonly string[];
}) {
  const { t, product } = props;
  const p = t.products;
  const [state, submit, pending] = useActionState(props.action, IDLE);
  const saves = useSaves(state);
  const [tooBig, setTooBig] = useState(false);
  const error = (name: string) => fieldError(state, name);
  const input = (name: string, extra: Record<string, unknown> = {}) => ({
    id: name,
    name,
    className: inputClass,
    'aria-invalid': error(name) ? true : undefined,
    'aria-describedby': error(name) ? `${name}-error` : undefined,
    ...extra,
  });
  return (
    <form
      className="space-y-6"
      // not action={submit}: React 19 empties the fields of a form action once it answers, and
      // an error answer must keep what was typed (and the picked photos)
      onSubmit={(event) => {
        event.preventDefault();
        const big = filesTooBig(event.currentTarget);
        setTooBig(big);
        if (big) return;
        const data = new FormData(event.currentTarget);
        startTransition(() => submit(data));
      }}
    >
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={p.name}
            name="name"
            hint={p.nameHint}
            error={error('name')}
            className="sm:col-span-2"
          >
            <input
              {...input('name', { defaultValue: product?.name, required: true, maxLength: 40 })}
            />
          </Field>
          <Field
            label={p.descriptionLabel}
            name="description"
            error={error('description')}
            className="sm:col-span-2"
          >
            <textarea
              {...input('description', {
                defaultValue: product?.description,
                required: true,
                rows: 4,
                maxLength: 2000,
              })}
            />
          </Field>
          <Field label={p.price} name="priceCents" hint={p.priceHint} error={error('priceCents')}>
            <input
              {...input('priceCents', {
                defaultValue: money(product?.priceCents),
                required: true,
                inputMode: 'decimal',
              })}
            />
          </Field>
          <Field
            label={p.oldPrice}
            name="oldPriceCents"
            hint={p.oldPriceHint}
            error={error('oldPriceCents')}
          >
            <input
              {...input('oldPriceCents', {
                defaultValue: money(product?.oldPriceCents),
                inputMode: 'decimal',
              })}
            />
          </Field>
          <Field label={p.currency} name="currency" error={error('currency')}>
            <select {...input('currency', { defaultValue: product?.currency ?? 'BRL' })}>
              {props.currencies.map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </select>
          </Field>
          <Field label={p.category} name="category" error={error('category')}>
            <input
              {...input('category', {
                defaultValue: product?.category ?? '',
                list: 'product-categories',
                maxLength: 60,
              })}
            />
            <datalist id="product-categories">
              {props.categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </Field>
          <Field label={p.link} name="link" error={error('link')} className="sm:col-span-2">
            <input {...input('link', { defaultValue: product?.link ?? '', type: 'url' })} />
          </Field>
          <Field
            label={p.photos}
            name="photos"
            hint={product ? `${p.photosHint} ${p.photosReplace}` : p.photosHint}
            error={error('photos')}
            className="sm:col-span-2"
          >
            {product ? (
              <div className="mb-3 flex flex-wrap gap-2" aria-label={p.currentPhotos}>
                {product.images.map((image) => (
                  <img
                    key={image}
                    src={`/files/assets/${image}`}
                    alt=""
                    className="size-20 rounded-lg border border-line bg-sunken object-contain"
                  />
                ))}
              </div>
            ) : null}
            <input
              key={saves}
              {...input('photos', {
                type: 'file',
                multiple: true,
                accept: '.png,.jpg,.jpeg,.webp,.svg',
                required: !product,
                className: fileInputClass,
              })}
            />
          </Field>
          {product ? null : (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked />
              {p.activeNow}
            </label>
          )}
        </div>
      </Card>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass('primary')}>
          {pending ? (product ? t.common.saving : p.creating) : product ? t.common.save : p.create}
        </button>
        {tooBig ? (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {t.common.tooBig}
          </p>
        ) : (
          <FormStatus state={state} />
        )}
      </div>
    </form>
  );
}
