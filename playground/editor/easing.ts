export type EasingId =
  | 'linear'
  | 'ease-in-cubic'   | 'ease-out-cubic'   | 'ease-in-out-cubic'
  | 'ease-in-quad'    | 'ease-out-quad'    | 'ease-in-out-quad'
  | 'ease-in-expo'    | 'ease-out-expo'    | 'ease-in-out-expo'
  | 'ease-out-back'   | 'ease-out-elastic' | 'ease-out-bounce';

export interface EasingPreset {
  id: EasingId;
  label: string;
  group: string;
  coreEasing: string;
}

const C1 = 1.70158;
const C3 = C1 + 1;

export function applyEasing(t: number, id: string): number {
  t = Math.max(0, Math.min(1, t));
  switch (id as EasingId) {
    case 'linear':
      return t;

    case 'ease-in-cubic':
      return t * t * t;
    case 'ease-out-cubic':
      return 1 - Math.pow(1 - t, 3);
    case 'ease-in-out-cubic':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    case 'ease-in-quad':
      return t * t;
    case 'ease-out-quad':
      return 1 - (1 - t) * (1 - t);
    case 'ease-in-out-quad':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    case 'ease-in-expo':
      return t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
    case 'ease-out-expo':
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    case 'ease-in-out-expo':
      if (t === 0) return 0;
      if (t === 1) return 1;
      return t < 0.5
        ? Math.pow(2, 20 * t - 10) / 2
        : (2 - Math.pow(2, -20 * t + 10)) / 2;

    case 'ease-out-back':
      return 1 + C3 * Math.pow(t - 1, 3) + C1 * Math.pow(t - 1, 2);

    case 'ease-out-elastic': {
      if (t === 0) return 0;
      if (t === 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
    }

    case 'ease-out-bounce': {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1)       return n1 * t * t;
      if (t < 2 / d1)       return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1)     return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }

    default:
      return t;
  }
}

export function toCoreEasing(id: string): string {
  switch (id as EasingId) {
    case 'linear':          return 'linear';
    case 'ease-in-cubic':   return 'ease-in';
    case 'ease-in-quad':    return 'ease-in';
    case 'ease-in-expo':    return 'ease-in';
    case 'ease-out-cubic':  return 'ease-out';
    case 'ease-out-quad':   return 'ease-out';
    case 'ease-out-expo':   return 'ease-out';
    case 'ease-out-back':   return 'ease-out';
    case 'ease-out-elastic':return 'ease-out';
    case 'ease-out-bounce': return 'ease-out';
    case 'ease-in-out-cubic':  return 'ease-in-out';
    case 'ease-in-out-quad':   return 'ease-in-out';
    case 'ease-in-out-expo':   return 'ease-in-out';
    default:                return 'linear';
  }
}

export const EASING_PRESETS: EasingPreset[] = [
  { id: 'linear',           label: 'Linear',               group: 'Basic',        coreEasing: 'linear' },
  { id: 'ease-in-cubic',    label: 'Ease In (cubic)',       group: 'Cubic',        coreEasing: 'ease-in' },
  { id: 'ease-out-cubic',   label: 'Ease Out (cubic)',      group: 'Cubic',        coreEasing: 'ease-out' },
  { id: 'ease-in-out-cubic',label: 'Ease In-Out (cubic)',   group: 'Cubic',        coreEasing: 'ease-in-out' },
  { id: 'ease-in-quad',     label: 'Ease In (quadratic)',   group: 'Quadratic',    coreEasing: 'ease-in' },
  { id: 'ease-out-quad',    label: 'Ease Out (quadratic)',  group: 'Quadratic',    coreEasing: 'ease-out' },
  { id: 'ease-in-out-quad', label: 'Ease In-Out (quadratic)', group: 'Quadratic', coreEasing: 'ease-in-out' },
  { id: 'ease-in-expo',     label: 'Ease In (expo)',        group: 'Exponential',  coreEasing: 'ease-in' },
  { id: 'ease-out-expo',    label: 'Ease Out (expo)',       group: 'Exponential',  coreEasing: 'ease-out' },
  { id: 'ease-in-out-expo', label: 'Ease In-Out (expo)',    group: 'Exponential',  coreEasing: 'ease-in-out' },
  { id: 'ease-out-back',    label: 'Ease Out (back)',       group: 'Special',      coreEasing: 'ease-out' },
  { id: 'ease-out-elastic', label: 'Ease Out (elastic)',    group: 'Special',      coreEasing: 'ease-out' },
  { id: 'ease-out-bounce',  label: 'Ease Out (bounce)',     group: 'Special',      coreEasing: 'ease-out' },
];

export function buildCurveSvgPath(id: string, w: number, h: number): string {
  const pad = 3;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  const steps = 40;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const et = applyEasing(t, id);
    const x = pad + t * iw;
    const y = pad + (1 - et) * ih;
    d += i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : ` L${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d;
}

export function makeCurveSvg(id: string, w = 48, h = 28, stroke = '#3b7dd8', strokeWidth = 1.5): string {
  const path = buildCurveSvgPath(id, w, h);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="${path}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
