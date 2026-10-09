# Dailies Crew

An open-source video factory: crews of AI agents come up with ideas, pick the best ones, write,
direct, edit (video as code, with [Remotion](https://www.remotion.dev)) and review short vertical
videos every day. You only approve or reject.

> Work in progress. **Phase 1A, the video engine, is here**: a direction plan (JSON) becomes a
> finished 1080×1920 MP4 with library scenes, camera moves, light, transitions, AI voice,
> word-by-word captions and music. The AI crews (phase 1B) and the panel (phase 1C) come next.

## Quick start

Requirements: Node 22 or newer. Remotion brings its own FFmpeg and downloads Chrome Headless
Shell on the first render.

```bash
npm install
npm run dailies -- render examples/feiraria-lamp/plan.json \
  --assets examples/feiraria-lamp/assets --out out/feiraria-lamp.mp4
```

The example uses a silent "fake" voice, so it needs no API key. For a real voice, create a `.env`
file with `ELEVENLABS_API_KEY=...`, set `"provider": "elevenlabs"` and a `"voiceId"` from your
ElevenLabs account in the plan, and render again.

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

## Tests

```bash
npm test             # unit tests
npm run test:visual  # renders frames and compares them with reference images
npm run test:e2e     # renders the example video end to end
```

## License

Dailies Crew is MIT licensed. It renders videos with Remotion, which has its own license: free for
individuals and companies of up to 3 people; companies of 4 or more people need a
[Remotion company license](https://www.remotion.dev/license).
