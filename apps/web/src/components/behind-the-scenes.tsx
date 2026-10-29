import type { ReactNode } from 'react';
import type { Dictionary } from '../i18n/dictionary';
import { fill } from '../i18n/locale';
import type { Formatter } from '../lib/format';
import type { LoadedVideo } from '../lib/loaders/videos';
import { Badge, Card } from './ui';

function Section(props: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={props.open} className="group rounded-xl border border-line">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold">
        {props.title}
      </summary>
      <div className="border-t border-line px-4 py-4 text-sm">{props.children}</div>
    </details>
  );
}

/**
 * "Bastidores": the whole history of the video, from the briefing to Hugo's decisions, with what
 * each stage cost (spec section 7, item 5)
 */
export function BehindTheScenes(props: { data: LoadedVideo; t: Dictionary; format: Formatter }) {
  const { data, t, format } = props;
  const v = t.videos;
  const nothing = <p className="text-muted">{v.nothingYet}</p>;
  const total = data.costs.reduce((sum, cost) => sum + cost.usd, 0);
  return (
    <Card title={v.behind}>
      <div className="space-y-3" data-testid="behind-the-scenes">
        <Section title={v.briefing} open>
          {data.briefing ? (
            <div className="space-y-3">
              <p>{data.briefing.summary}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-muted">{v.keyFacts}</h4>
                  <ul className="list-disc space-y-1 pl-5">
                    {data.briefing.keyFacts.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-muted">{v.mustAvoid}</h4>
                  <ul className="list-disc space-y-1 pl-5">
                    {data.briefing.mustAvoid.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            nothing
          )}
        </Section>

        <Section title={v.ideas}>
          {data.ideas.length === 0 ? (
            nothing
          ) : (
            <ul className="space-y-4">
              {data.ideas.map((idea) => (
                <li key={idea.id} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{idea.title}</strong>
                    <Badge
                      tone={idea.status === 'chosen' || idea.status === 'used' ? 'good' : 'neutral'}
                    >
                      {v.ideaStatus[idea.status]}
                    </Badge>
                    <Badge>{idea.style}</Badge>
                    {idea.total !== null ? (
                      <span className="text-xs text-muted">
                        {fill(v.total, { score: idea.total })}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-muted">
                    <em>{idea.hook}</em> — {idea.angle} → {idea.cta}
                  </p>
                  {Object.keys(idea.scores).length > 0 ? (
                    <ul className="grid gap-1 text-xs sm:grid-cols-3">
                      {Object.entries(idea.scores).map(([judge, score]) => (
                        <li key={judge} className="rounded-lg bg-sunken px-2 py-1">
                          <span className="font-semibold">
                            {v.judges[judge as keyof typeof v.judges] ?? judge} {score.score}
                          </span>
                          : {score.reason}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={v.script}>
          {data.script ? (
            <div className="space-y-2">
              <ol className="list-decimal space-y-2 pl-5">
                {data.script.lines.map((line) => (
                  <li key={line.id}>
                    <p>{line.text}</p>
                    <p className="text-xs text-muted">
                      {line.purpose} · ~{line.estimatedSeconds}s
                    </p>
                  </li>
                ))}
              </ol>
              {data.script.notes ? <p className="text-muted">{data.script.notes}</p> : null}
            </div>
          ) : (
            nothing
          )}
        </Section>

        <Section title={v.plan}>
          {data.plan ? (
            <details>
              <summary className="cursor-pointer text-muted">
                {fill(v.planScenes, { count: data.plan.scenes?.length ?? 0 })}
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-sunken p-3 font-mono text-xs">
                {JSON.stringify(data.plan, null, 2)}
              </pre>
            </details>
          ) : (
            nothing
          )}
        </Section>

        <Section title={v.reviewRounds}>
          {data.reviewRounds.length === 0 ? (
            nothing
          ) : (
            <div className="space-y-4">
              {data.reviewRounds.map((round) => (
                <div key={round.round}>
                  <h4 className="mb-2 font-semibold">{fill(v.roundN, { round: round.round })}</h4>
                  <ul className="space-y-2">
                    {round.verdicts.map((verdict) => (
                      <li key={verdict.focus} className="rounded-lg bg-sunken p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <strong>{v.reviewers[verdict.focus]}</strong>
                          <Badge tone={verdict.verdict === 'approve' ? 'good' : 'warn'}>
                            {v.verdicts[verdict.verdict]}
                          </Badge>
                        </div>
                        <p>{verdict.notes}</p>
                        {verdict.adjustments.length > 0 ? (
                          <ul className="mt-1 list-disc pl-5 text-xs text-muted">
                            {verdict.adjustments.map((adjustment) => (
                              <li key={adjustment.instruction}>
                                {t.stages[adjustment.stage]}: {adjustment.instruction}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title={v.frames}>
          {data.frames.length === 0 ? (
            nothing
          ) : (
            <>
              <p className="mb-3 text-xs text-muted">{v.framesNote}</p>
              <ul
                className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8"
                data-testid="contact-sheet"
              >
                {data.frames.map((frame, index) => (
                  <li key={frame}>
                    <img
                      src={frame}
                      alt={`${index + 1}`}
                      loading="lazy"
                      className="aspect-[9/16] w-full rounded-md border border-line bg-black object-cover"
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>

        <Section title={v.decisions}>
          {data.decisions.length === 0 ? (
            nothing
          ) : (
            <ul className="space-y-2">
              {data.decisions.map((decision) => (
                <li key={decision.id}>
                  <span className="text-xs text-muted">{format.dateTime(decision.createdAt)}</span>{' '}
                  <strong>
                    {decision.kind === 'approve'
                      ? v.decisionApprove
                      : fill(v.decisionReject, {
                          mode: decision.mode === 'learn' ? v.modeLearn : v.modeRedo,
                        })}
                  </strong>
                  {decision.targetStage ? ` → ${t.stages[decision.targetStage]}` : ''}
                  {decision.reason ? <p className="text-muted">“{decision.reason}”</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={v.costs} open>
          <table className="w-full text-left">
            <tbody className="divide-y divide-line">
              {data.costs.map((cost) => (
                <tr key={cost.stage ?? 'outside'}>
                  <td className="py-1.5">{cost.stage ? t.stages[cost.stage] : v.outsideStages}</td>
                  <td className="py-1.5 text-right tabular-nums">{format.usd(cost.usd)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1.5">{v.totalCost}</td>
                <td className="py-1.5 text-right tabular-nums">{format.usd(total)}</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section title={v.stageRuns}>
          {data.stageRuns.length === 0 ? (
            nothing
          ) : (
            <ul className="space-y-1 text-xs">
              {data.stageRuns.map((run) => (
                <li key={run.id} className="flex flex-wrap gap-x-3">
                  <span className="w-28 font-medium">{t.stages[run.stage]}</span>
                  <span className="text-muted">
                    {fill(t.today.round, { round: run.round })} ·{' '}
                    {fill(v.attempt, { attempt: run.attempt })}
                  </span>
                  <Badge
                    tone={
                      run.status === 'done' ? 'good' : run.status === 'failed' ? 'bad' : 'accent'
                    }
                  >
                    {v.runStatus[run.status]}
                  </Badge>
                  <span className="tabular-nums text-muted">{format.dateTime(run.startedAt)}</span>
                  {run.error ? <span className="w-full text-bad">{run.error}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </Card>
  );
}
