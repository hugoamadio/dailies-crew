import {
  type Brand,
  fakeWords,
  limitsFromCatalog,
  type PlanInput,
  type ResolvedPlan,
  resolvePlan,
  validatePlan,
  type VoiceTrack,
} from '@dailies-crew/plan';
import { pieceCatalog } from './specs';

/** Brand of the demo, the visual tests and the Studio */
export const DEMO_BRAND: Brand = {
  colors: {
    background: '#0E0E10',
    surface: '#1C1C22',
    text: '#FFFFFF',
    primary: '#2B2B33',
    accent: '#FFC83D',
  },
  headingFont: 'Montserrat',
  bodyFont: 'Inter',
  logo: 'brand/logo.svg',
  personality: 'energetic',
};

/** A complete product video: the example of the README and of examples/feiraria-lamp */
export const DEMO_PLAN: PlanInput = {
  version: 1,
  brand: DEMO_BRAND,
  voice: {
    provider: 'fake',
    voiceId: 'demo',
    language: 'pt-BR',
    lines: [
      { id: 'hook', text: 'Sua mesa merece uma lua só dela?' },
      { id: 'hero', text: 'Essa é a Luminária Lua, impressa em 3D camada por camada.' },
      { id: 'detail', text: 'Repara no acabamento: liso, sem rebarba, pronto para presentear.' },
      { id: 'price', text: 'De cento e vinte e nove por oitenta e nove e noventa.' },
      { id: 'cta', text: 'Corre que é só hoje. O link está na bio!' },
    ],
  },
  scenes: [
    {
      id: 'hook',
      piece: 'hook-question',
      params: { question: 'Sua mesa merece uma lua só dela?', emphasis: 'lua' },
      timing: { kind: 'line', lineId: 'hook' },
      camera: { move: 'push-in', intensity: 'subtle' },
      background: { kind: 'particles', density: 'medium' },
      transitionOut: { kind: 'whip', seconds: 0.4, direction: 'left' },
    },
    {
      id: 'hero',
      piece: 'product-hero',
      params: {
        image: 'products/lamp.svg',
        name: 'Luminária Lua',
        tagline: 'Impressa em 3D, acende em 3 cores',
      },
      timing: { kind: 'line', lineId: 'hero' },
      camera: { move: 'push-in', intensity: 'medium' },
      light: { sweep: true, vignette: 0.35 },
      transitionOut: { kind: 'zoom-punch', seconds: 0.5 },
    },
    {
      id: 'detail',
      piece: 'product-loupe',
      params: {
        image: 'products/lamp.svg',
        focus: { x: 0.5, y: 0.3 },
        zoom: 2.5,
        label: 'Acabamento liso',
      },
      timing: { kind: 'line', lineId: 'detail' },
      camera: { move: 'handheld', intensity: 'subtle' },
      transitionOut: { kind: 'slide', seconds: 0.4, direction: 'left' },
    },
    {
      id: 'offer',
      piece: 'hook-burst',
      params: { text: 'OFERTA!' },
      timing: { kind: 'seconds', seconds: 1.5 },
      background: { kind: 'gradient', angle: 200 },
      transitionOut: { kind: 'push', seconds: 0.4 },
    },
    {
      id: 'price',
      piece: 'product-price',
      params: {
        image: 'products/lamp.svg',
        price: 8990,
        oldPrice: 12990,
        currency: 'BRL',
        locale: 'pt-BR',
        label: 'Só hoje',
      },
      timing: { kind: 'line', lineId: 'price' },
      light: { sweep: true, vignette: 0.35 },
      transitionOut: { kind: 'fade', seconds: 0.4 },
    },
    {
      id: 'cta',
      piece: 'cta-end',
      params: { cta: 'Link na bio', handle: '@feiraria' },
      timing: { kind: 'line', lineId: 'cta' },
      background: { kind: 'particles', density: 'low' },
    },
  ],
};

/** The demo with the fake voice's timings and no audio files: what the Studio and the tests play */
export function demoResolvedPlan(): ResolvedPlan {
  const validated = validatePlan(DEMO_PLAN, pieceCatalog);
  if (!validated.ok)
    throw new Error(`The demo plan is invalid: ${JSON.stringify(validated.issues)}`);
  const tracks: VoiceTrack[] = validated.value.voice.lines.map((line) => ({
    lineId: line.id,
    src: '',
    ...fakeWords(line.text),
  }));
  const resolved = resolvePlan(validated.value, tracks, limitsFromCatalog(pieceCatalog));
  if (!resolved.ok)
    throw new Error(`The demo plan does not resolve: ${JSON.stringify(resolved.issues)}`);
  return { ...resolved.value, voice: [] };
}
