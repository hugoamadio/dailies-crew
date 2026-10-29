# Dailies Crew

An open-source video factory: crews of AI agents come up with ideas, pick the best ones, write,
direct, edit (video as code, with [Remotion](https://www.remotion.dev)) and review short vertical
videos every day. You only approve or reject.

> Work in progress. **The video engine (phase 1A) and the studio (phase 1B) are here**: production
> lines run every day, crews of Claude agents write, direct and review each video, and you approve
> or reject it with the `crew` command. The web panel (phase 1C) comes next.

## Quick start

Requirements: Node 22 or newer, and internet access for every render: the fonts come from Google
Fonts, and the first render also downloads Chrome Headless Shell. Remotion brings its own FFmpeg.

```bash
npm install
npm run dailies -- render examples/feiraria-lamp/plan.json \
  --assets examples/feiraria-lamp/assets --out out/feiraria-lamp.mp4
```

The example uses a silent "fake" voice, so it needs no API key. For a real voice, create a `.env`
file in the repository root (next to `package.json`) with `ELEVENLABS_API_KEY=...`, set
`"provider": "elevenlabs"` in the plan, replace the placeholder `"voiceId": "demo"` with the id of
a real voice from your ElevenLabs account, and render again.

Preview the scene library and the demo video live: `npm run studio`.

## How a video is described

A **direction plan** (`examples/feiraria-lamp/plan.json`) has:

- `brand`: five colors, a heading and a body font, an optional logo and a personality
  (`calm`, `energetic`, `playful`, `premium`) that sets how springy every entrance is;
- `voice`: the provider, the voice id, the language and the narration split into lines;
- `music` (optional): a track from the assets folder, lowered automatically under the voice;
- `captions`: on by default, word by word, the spoken word highlighted;
- `scenes`: each one picks a **piece** from the library, its `params`, and either a voice line
  (the scene lasts as long as the line) or a number of seconds, plus `camera`
  (`push-in`, `pull-out`, `pan-left`, `pan-right`, `handheld`, `rack-focus`), `light`
  (light sweep, vignette), `background` (`gradient`, `particles`, `grain`, `solid`) and the
  `transitionOut` (`fade`, `slide`, `wipe`, `iris`, `push`, `whip`, `zoom-punch`, `cut`).

Every plan is validated before anything is rendered, and every text stays inside the area that
TikTok, Reels and Shorts leave free.

## Scene library

| Piece           | What it does                                                            |
| --------------- | ----------------------------------------------------------------------- |
| `hook-question` | A question that fills the screen, words popping in, emphasis underlined |
| `hook-burst`    | One word that explodes onto the screen                                  |
| `kinetic-title` | One to three big lines sliding up                                       |
| `product-hero`  | The product floating above its shadow, name and tagline                 |
| `product-price` | The price counting down from the old one, with a label                  |
| `product-loupe` | A magnifying glass gliding to a detail                                  |
| `cta-end`       | The logo, the call to action and the handle                             |

## The studio

The studio turns **production lines** ("3 videos a day of my store's products") into videos
waiting for your review. Each video goes through eight stages, each one a job in a Postgres
queue ([pg-boss](https://github.com/timgit/pg-boss)), so nothing is lost or paid twice when the
computer stops:

| Stage     | Who                                                  | What                                                                      |
| --------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| prepare   | producer (Haiku)                                     | a briefing from the line, the product, the learned rules, past rejections |
| ideas     | 3 creators (Sonnet): funny, emotional, demonstration | two ideas each: hook, angle, structure, call to action                    |
| committee | 3 judges (Sonnet): objective, retention, brand       | the best idea wins; good leftovers go to the idea bank                    |
| script    | scriptwriter (Sonnet)                                | the narration, line by line                                               |
| direction | director (Opus)                                      | the direction plan, checked against the library before any voice is paid  |
| produce   | the engine                                           | voice, render and review frames (two per second)                          |
| review    | 3 reviewers (Opus): art, rhythm, fidelity            | approve, or send the video back (twice at most, then "needs you")         |
| social    | social media manager (Sonnet)                        | title, description and hashtags for YouTube, TikTok, Instagram, Facebook  |

Run it (Docker for Postgres, Node 22.12 or newer):

```bash
cp .env.example .env     # DAILIES_FAKE_AI=1: the fake AI, free and offline
npm install
npm run db:up            # Postgres 17 on 127.0.0.1:5436
npm run db:deploy        # creates the tables
npm run worker           # keep it running: it makes the videos
```

**After a reboot**: the database container restarts by itself; if it does not (`docker ps` shows
no `postgres`), run `npm run db:up`, then `npm run worker` again.

Then, in another terminal:

```bash
npm run crew -- line:add --file examples/studio/line.json --logo examples/feiraria-lamp/assets/brand/logo.svg
npm run crew -- product:add --file examples/studio/product.json --image examples/feiraria-lamp/assets/products/lamp.svg
npm run crew -- run-now --line <lineId> --count 1
npm run crew -- status
npm run crew -- show <videoId>
npm run crew -- approve <videoId>
npm run crew -- reject <videoId> --reason "the price comes too late" --mode redo   # or --mode learn
```

`npm run crew -- --help` lists every command. Videos, frames and assets live in `data/`.

With the fake AI every line also uses the silent fake voice, so nothing is paid; set
`DAILIES_REAL_VOICE=1` to let lines use their real voice provider (ElevenLabs, which costs money)
even then.

**With the real AI**, set `DAILIES_FAKE_AI=0` and `ANTHROPIC_API_KEY` in `.env`; lines whose voice
provider is `elevenlabs` also need `ELEVENLABS_API_KEY` and a real `voiceId`. Every Claude call and
every voice synthesis is recorded with its cost (`npm run crew -- costs`). Each line has a monthly
cap and the settings have a global one: reaching a cap stops the line from starting new stages (caps
are checked before each stage, so the stages already running, up to the concurrency, can go a little over). The prices used for the
costs are in the settings (`npm run crew -- settings`); check them against the current Claude and
ElevenLabs prices. If the key is refused or the credit runs out, every line stops and
`npm run crew -- status` says why: fix it, then run `npm run crew -- resume`.

## The panel

The panel is a web app for one person on this machine: it answers only on `127.0.0.1`, has no
login, and refuses any request whose host is not `127.0.0.1` or `localhost`. In English and
Portuguese. Next.js telemetry is turned off in every web script.

```bash
npm run worker           # in one terminal: the panel never makes videos itself
npm run web:build        # once, and again after each update of the code
npm run web:start        # in another: http://127.0.0.1:3300
```

Use `web:build` + `web:start` for daily use. `npm run web` (the development server, same address)
is for changing the panel: it keeps a `.next` cache that keeps growing, and disk is limited.

The worker is a separate process: the panel only queues jobs, so without the worker nothing gets
made (the sidebar says so). With `DAILIES_FAKE_AI=1` the crews' AI calls are fake and cost nothing.
Two things still go online: the voice, when `DAILIES_REAL_VOICE=1` is set (paid), and the "Check
keys" button, which calls each provider's free endpoint.

- **Today**: what is in production, ready for review, waiting for you or failed (with "Try
  again"), this month's spending against the caps, and the next daily runs.
- **Lines**: turn lines on and off, "Run now", create and edit them (logo upload), and see, edit,
  turn off or delete the rules learned from your rejections.
- **Products**: photos, prices, categories; turn products on and off.
- **Videos**: the review queue and every video. The review page plays the video in a phone frame,
  shows the post texts of each network with copy buttons, and lets you approve, reject (redo or
  learn only) and download. "Behind the scenes" shows the whole history: briefing, ideas and the
  committee's notes, script, plan, review rounds and frames, your decisions and the cost of each
  stage.
- **Settings**: whether the keys are configured (and a "Check keys" button that calls each
  provider's free endpoint), the default hour, the time zone, the global cap, the model and effort
  of each crew role, and the prices used for the costs.

Pages with work in progress refresh themselves every few seconds. For a production build:
`npm run web:build`, then `npm run web:start` (same port). Job folders under `data/jobs` are not
cleaned yet (about 6.5 MB per fake video).

## Tests

```bash
npm test                  # unit tests, no database
npm run test:integration  # against Postgres (npm run db:up first; uses the dailies_test database)
npm run test:visual       # renders frames and compares them with reference images
npm run test:e2e          # renders the example video end to end
npm run test:web          # the panel in a real browser (builds it; uses dailies_test, port 3310)
```

`npm run test:web` and `npm run test:integration` share the `dailies_test` database: never run them
at the same time. `npm run test:web` drives the panel with [Playwright](https://playwright.dev)'s
own headless Chromium. Install that browser once with `npx playwright install --only-shell chromium`;
Playwright keeps its browsers in `~/.cache/ms-playwright` (Linux), or in the folder
`PLAYWRIGHT_BROWSERS_PATH` names.

## License

Dailies Crew is MIT licensed. It renders videos with Remotion, which has its own license: free for
individuals and companies of up to 3 people; companies of 4 or more people need a
[Remotion company license](https://www.remotion.dev/license).
