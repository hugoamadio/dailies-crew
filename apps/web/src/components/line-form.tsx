'use client';

import type { Line } from '@dailies-crew/studio';
import { startTransition, useActionState, useState } from 'react';
import type { Dictionary } from '../i18n/dictionary';
import { fill } from '../i18n/locale';
import { fieldError, type FormAction, IDLE } from '../lib/actions/state';
import { COLORS } from '../lib/forms/line';
import { FormStatus } from './form-status';
import { filesTooBig } from './upload-limit';
import { buttonClass, Card, Field, fileInputClass, inputClass } from './ui';

const PERSONALITIES = ['calm', 'energetic', 'playful', 'premium'] as const;
const KINDS = ['product', 'brand', 'topic'] as const;

/** A new line starts dark and energetic, with the free fake voice */
const DEFAULT_BRAND = {
  colors: {
    background: '#0f0f14',
    surface: '#1c1c24',
    text: '#ffffff',
    primary: '#7c3aed',
    accent: '#f59e0b',
  },
  headingFont: 'Montserrat',
  bodyFont: 'Inter',
  personality: 'energetic',
};

export function LineForm(props: {
  action: FormAction;
  t: Dictionary;
  line: Line | null;
  defaultHour: number;
  timezone: string;
  products: { id: string; name: string; active: boolean }[];
  categories: string[];
  music: string[];
  fonts: string[];
}) {
  const { t, line } = props;
  const l = t.lines;
  const [state, submit, pending] = useActionState(props.action, IDLE);
  const [tooBig, setTooBig] = useState(false);
  const [kind, setKind] = useState<string>(line?.kind ?? 'product');
  const productMaterial = line?.kind === 'product' ? line.material : null;
  const [select, setSelect] = useState<string>(productMaterial?.select ?? 'all');
  const brand = line?.brand ?? DEFAULT_BRAND;
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
      // an error answer must keep what was typed
      onSubmit={(event) => {
        event.preventDefault();
        const big = filesTooBig(event.currentTarget);
        setTooBig(big);
        if (big) return;
        const data = new FormData(event.currentTarget);
        startTransition(() => submit(data));
      }}
    >
      <Card title={l.sections.recipe}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={l.name} name="name" error={error('name')}>
            <input
              {...input('name', { defaultValue: line?.name, required: true, maxLength: 80 })}
            />
          </Field>
          <Field label={l.kind} name="kind" hint={l.kindHint} error={error('kind')}>
            {line ? (
              <>
                <input type="hidden" name="kind" value={line.kind} />
                <p className="py-2 text-sm">{l.kinds[line.kind]}</p>
              </>
            ) : (
              <select
                {...input('kind')}
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                {KINDS.map((each) => (
                  <option key={each} value={each}>
                    {l.kinds[each]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={l.perDay} name="perDay" error={error('perDay')}>
            <input
              {...input('perDay', {
                type: 'number',
                min: 1,
                max: 10,
                defaultValue: line?.perDay ?? 1,
              })}
            />
          </Field>
          <Field
            label={l.hour}
            name="hour"
            hint={fill(l.hourHint, { timezone: props.timezone })}
            error={error('hour')}
          >
            <input
              {...input('hour', {
                type: 'number',
                min: 0,
                max: 23,
                defaultValue: line?.hour ?? props.defaultHour,
              })}
            />
          </Field>
          <Field label={l.language} name="language" hint={l.languageHint} error={error('language')}>
            <input
              {...input('language', { defaultValue: line?.language ?? 'pt-BR', required: true })}
            />
          </Field>
          <Field label={l.tone} name="tone" error={error('tone')}>
            <input
              {...input('tone', { defaultValue: line?.tone, required: true, maxLength: 120 })}
            />
          </Field>
          <Field
            label={l.objective}
            name="objective"
            hint={l.objectiveHint}
            error={error('objective')}
            className="sm:col-span-2"
          >
            <input
              {...input('objective', {
                defaultValue: line?.objective,
                required: true,
                maxLength: 300,
              })}
            />
          </Field>
          <Field
            label={l.audience}
            name="audience"
            error={error('audience')}
            className="sm:col-span-2"
          >
            <input
              {...input('audience', {
                defaultValue: line?.audience,
                required: true,
                maxLength: 300,
              })}
            />
          </Field>
        </div>
      </Card>

      <Card title={l.sections.material}>
        {kind === 'product' ? (
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{l.productSelect}</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                {(['all', 'category', 'chosen'] as const).map((each) => (
                  <label key={each} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="material.select"
                      value={each}
                      checked={select === each}
                      onChange={() => setSelect(each)}
                    />
                    {each === 'all'
                      ? l.selectAll
                      : each === 'category'
                        ? l.selectCategory
                        : l.selectChosen}
                  </label>
                ))}
              </div>
            </fieldset>
            {select === 'category' ? (
              <Field label={l.category} name="material.category" error={error('material.category')}>
                <input
                  {...input('material.category', {
                    defaultValue:
                      productMaterial?.select === 'category' ? productMaterial.category : '',
                    list: 'line-categories',
                    required: true,
                  })}
                />
                <datalist id="line-categories">
                  {props.categories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </Field>
            ) : null}
            {select === 'chosen' ? (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">{l.chosenProducts}</legend>
                {props.products.length === 0 ? (
                  <p className="text-sm text-muted">{l.noProducts}</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {props.products.map((product) => (
                      <label key={product.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="material.productIds"
                          value={product.id}
                          defaultChecked={
                            productMaterial?.select === 'chosen' &&
                            productMaterial.productIds.includes(product.id)
                          }
                        />
                        <span className={product.active ? '' : 'text-muted line-through'}>
                          {product.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {error('material.productIds') ? (
                  <p className="mt-1 text-xs text-bad">{error('material.productIds')}</p>
                ) : null}
              </fieldset>
            ) : null}
          </div>
        ) : null}
        {kind === 'brand' ? (
          <div className="space-y-4">
            <Field label={l.about} name="material.about" error={error('material.about')}>
              <textarea
                {...input('material.about', {
                  rows: 4,
                  defaultValue: line?.kind === 'brand' ? line.material.about : '',
                  required: true,
                })}
              />
            </Field>
            <Field label={l.links} name="material.links" error={error('material.links')}>
              <textarea
                {...input('material.links', {
                  rows: 3,
                  defaultValue: line?.kind === 'brand' ? line.material.links.join('\n') : '',
                })}
              />
            </Field>
            {line?.kind === 'brand' && line.material.images.length > 0 ? (
              <>
                {line.material.images.map((image) => (
                  <input key={image} type="hidden" name="material.images" value={image} />
                ))}
                <p className="text-xs text-muted">
                  {fill(l.brandImagesKept, { count: line.material.images.length })}
                </p>
              </>
            ) : null}
          </div>
        ) : null}
        {kind === 'topic' ? (
          <div className="space-y-4">
            <Field label={l.subject} name="material.subject" error={error('material.subject')}>
              <textarea
                {...input('material.subject', {
                  rows: 3,
                  defaultValue: line?.kind === 'topic' ? line.material.subject : '',
                  required: true,
                })}
              />
            </Field>
            <Field label={l.avoid} name="material.avoid" error={error('material.avoid')}>
              <textarea
                {...input('material.avoid', {
                  rows: 2,
                  defaultValue: line?.kind === 'topic' ? line.material.avoid : '',
                })}
              />
            </Field>
          </div>
        ) : null}
      </Card>

      <Card title={l.sections.identity}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {COLORS.map((color) => (
            <Field
              key={color}
              label={l.colors[color]}
              name={`brand.colors.${color}`}
              error={error(`brand.colors.${color}`)}
            >
              <input
                {...input(`brand.colors.${color}`, {
                  type: 'color',
                  defaultValue: brand.colors[color],
                  className:
                    'h-10 w-full cursor-pointer rounded-lg border border-line bg-panel p-1',
                })}
              />
            </Field>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label={l.headingFont} name="brand.headingFont" error={error('brand.headingFont')}>
            <select {...input('brand.headingFont', { defaultValue: brand.headingFont })}>
              {props.fonts.map((font) => (
                <option key={font}>{font}</option>
              ))}
            </select>
          </Field>
          <Field label={l.bodyFont} name="brand.bodyFont" error={error('brand.bodyFont')}>
            <select {...input('brand.bodyFont', { defaultValue: brand.bodyFont })}>
              {props.fonts.map((font) => (
                <option key={font}>{font}</option>
              ))}
            </select>
          </Field>
          <Field label={l.personality} name="brand.personality" error={error('brand.personality')}>
            <select {...input('brand.personality', { defaultValue: brand.personality })}>
              {PERSONALITIES.map((personality) => (
                <option key={personality} value={personality}>
                  {l.personalities[personality]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={l.logo}
            name="logoFile"
            hint={line?.brand.logo ? `${l.logoHint} ${l.logoKeep}` : l.logoHint}
            error={error('brand.logo')}
            className="sm:col-span-3"
          >
            {line?.brand.logo ? (
              <input type="hidden" name="brand.logo" value={line.brand.logo} />
            ) : null}
            <div className="flex items-center gap-3">
              {line?.brand.logo ? (
                <img
                  src={`/files/assets/${line.brand.logo}`}
                  alt=""
                  className="size-10 rounded-lg border border-line bg-sunken object-contain p-1"
                />
              ) : null}
              <input
                {...input('logoFile', {
                  type: 'file',
                  accept: '.png,.jpg,.jpeg,.webp,.svg',
                  className: fileInputClass,
                })}
              />
            </div>
          </Field>
        </div>
      </Card>

      <Card title={l.sections.voice}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={l.voiceProvider} name="voice.provider" error={error('voice.provider')}>
            <select {...input('voice.provider', { defaultValue: line?.voice.provider ?? 'fake' })}>
              <option value="fake">{l.providers.fake}</option>
              <option value="elevenlabs">{l.providers.elevenlabs}</option>
            </select>
          </Field>
          <Field label={l.voiceId} name="voice.voiceId" error={error('voice.voiceId')}>
            <input
              {...input('voice.voiceId', {
                defaultValue: line?.voice.voiceId ?? 'demo',
                required: true,
              })}
            />
          </Field>
          <Field label={l.music} name="musicTrack" hint={l.musicHint} error={error('musicTrack')}>
            <select {...input('musicTrack', { defaultValue: line?.musicTrack ?? '' })}>
              <option value="">{l.noMusic}</option>
              {props.music.map((track) => (
                <option key={track} value={track}>
                  {track.replace(/^music\//, '')}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card title={l.sections.money}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={l.cap} name="monthlyCapUsd" hint={l.capHint} error={error('monthlyCapUsd')}>
            <input
              {...input('monthlyCapUsd', {
                type: 'number',
                min: 0,
                step: '0.01',
                defaultValue: line?.monthlyCapUsd ?? 10,
                required: true,
              })}
            />
          </Field>
          {line ? null : (
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" name="active" defaultChecked />
              {l.activeNow}
            </label>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass('primary')}>
          {pending ? (line ? t.common.saving : l.creating) : line ? t.common.save : l.create}
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
