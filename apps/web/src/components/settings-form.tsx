'use client';

import { startTransition, useActionState } from 'react';
import type { Dictionary } from '../i18n/dictionary';
import { fieldError, type FormAction, IDLE } from '../lib/actions/state';
import { PRICE_KEYS } from '../lib/forms/settings-prices';
import type { LoadedSettings } from '../lib/loaders/settings';
import { FormStatus } from './form-status';
import { buttonClass, Card, Field, inputClass } from './ui';

const numberInput = `${inputClass} tabular-nums`;

export function SettingsForm(props: { action: FormAction; t: Dictionary; data: LoadedSettings }) {
  const { t, data } = props;
  const s = t.settings;
  const { values } = data;
  const [state, submit, pending] = useActionState(props.action, IDLE);
  const error = (name: string) => fieldError(state, name);
  const models = Object.keys(values.prices.models).sort();
  return (
    <form
      className="space-y-6"
      // not action={submit}: React 19 empties the fields of a form action once it answers, and
      // a refused save must keep what was typed
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => submit(data));
      }}
    >
      <Card title={s.general}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={s.defaultHour} name="defaultHour" error={error('defaultHour')}>
            <input
              id="defaultHour"
              name="defaultHour"
              type="number"
              min={0}
              max={23}
              defaultValue={values.defaultHour}
              className={numberInput}
            />
          </Field>
          <Field label={s.timezone} name="timezone" hint={s.timezoneHint} error={error('timezone')}>
            <select
              id="timezone"
              name="timezone"
              defaultValue={values.timezone}
              className={inputClass}
            >
              {data.timezones.map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </Field>
          <Field
            label={s.globalCap}
            name="globalMonthlyCapUsd"
            hint={s.capHint}
            error={error('globalMonthlyCapUsd')}
          >
            <input
              id="globalMonthlyCapUsd"
              name="globalMonthlyCapUsd"
              type="number"
              min={0}
              step="0.01"
              defaultValue={values.globalMonthlyCapUsd}
              className={numberInput}
            />
          </Field>
        </div>
      </Card>

      <Card title={s.roles}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="pb-2 font-medium">{s.role}</th>
                <th className="pb-2 font-medium">{s.model}</th>
                <th className="pb-2 font-medium">{s.effort}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.roleNames.map((role) => (
                <tr key={role}>
                  <td className="py-2 pr-3">{s.roleNames[role]}</td>
                  <td className="py-2 pr-3">
                    <select
                      name={`roles.${role}.model`}
                      aria-label={`${s.roleNames[role]}: ${s.model}`}
                      defaultValue={values.roles[role].model}
                      className={inputClass}
                    >
                      {models.map((model) => (
                        <option key={model}>{model}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2">
                    <select
                      name={`roles.${role}.effort`}
                      aria-label={`${s.roleNames[role]}: ${s.effort}`}
                      defaultValue={values.roles[role].effort}
                      className={inputClass}
                    >
                      {data.efforts.map((effort) => (
                        <option key={effort}>{effort}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error('prices.models') ? (
          <p className="mt-2 text-xs text-bad">{error('prices.models')}</p>
        ) : null}
      </Card>

      <Card title={s.prices}>
        <p className="mb-4 text-xs text-muted">{s.pricesHint}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="pb-2 font-medium">{s.model}</th>
                {PRICE_KEYS.map((key) => (
                  <th key={key} className="pb-2 font-medium">
                    {s[key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {models.map((model) => (
                <tr key={model}>
                  <td className="py-2 pr-3 font-mono text-xs">{model}</td>
                  {PRICE_KEYS.map((key) => {
                    const name = `prices.models.${model}.${key}`;
                    return (
                      <td key={key} className="py-2 pr-2">
                        <input
                          name={name}
                          aria-label={`${model}: ${s[key]}`}
                          inputMode="decimal"
                          defaultValue={values.prices.models[model]![key]}
                          className={numberInput}
                        />
                        {error(name) ? (
                          <p className="mt-1 text-xs text-bad">{error(name)}</p>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="py-2 pr-3">
                  <input
                    name="newModel.name"
                    placeholder={s.newModelName}
                    aria-label={s.newModel}
                    pattern="[a-z0-9.\-]+"
                    className={`${inputClass} font-mono text-xs`}
                  />
                </td>
                {PRICE_KEYS.map((key) => (
                  <td key={key} className="py-2 pr-2">
                    <input
                      name={`newModel.${key}`}
                      aria-label={`${s.newModel}: ${s[key]}`}
                      inputMode="decimal"
                      className={numberInput}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <h3 className="mt-6 mb-2 text-sm font-medium">{s.voicePrices}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['elevenlabs', 'fake'] as const).map((voice) => {
            const name = `prices.voicePer1kChars.${voice}`;
            return (
              <Field key={voice} label={t.lines.providers[voice]} name={name} error={error(name)}>
                <input
                  id={name}
                  name={name}
                  inputMode="decimal"
                  defaultValue={values.prices.voicePer1kChars[voice]}
                  className={numberInput}
                />
              </Field>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass('primary')}>
          {pending ? t.common.saving : t.common.save}
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
