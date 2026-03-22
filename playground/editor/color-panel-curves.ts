import { evaluateCurve, type CurvePoint, type ColorGrading } from './color-grading';
import { hsvToRgb } from './color-wheel-widget';

const CURVE_SIZE = 200;
const PT_HIT = 9;

type RgbChannel = 'master' | 'red' | 'green' | 'blue';
type HueChannel = 'HvsH' | 'HvsS' | 'HvsL' | 'LvsS' | 'SvsS';

const RGB_CHANNELS: { key: RgbChannel; label: string; color: string }[] = [
  { key: 'master', label: 'Master', color: '#e0e0e0' },
  { key: 'red',    label: 'Red',    color: '#e05c5c' },
  { key: 'green',  label: 'Green',  color: '#4caf6a' },
  { key: 'blue',   label: 'Blue',   color: '#5580e0' },
];

const HUE_CHANNELS: { key: HueChannel; label: string; color: string }[] = [
  { key: 'HvsH', label: 'H vs H',  color: '#e0c060' },
  { key: 'HvsS', label: 'H vs S',  color: '#c060e0' },
  { key: 'HvsL', label: 'H vs L',  color: '#60c0e0' },
  { key: 'LvsS', label: 'L vs S',  color: '#60e0a0' },
  { key: 'SvsS', label: 'S vs S',  color: '#e08060' },
];

function cgCurveKey(ch: RgbChannel | HueChannel): keyof ColorGrading {
  const map: Record<string, keyof ColorGrading> = {
    master: 'curveMaster', red: 'curveRed', green: 'curveGreen', blue: 'curveBlue',
    HvsH: 'curveHvsH', HvsS: 'curveHvsS', HvsL: 'curveHvsL',
    LvsS: 'curveLvsS', SvsS: 'curveSvsS',
  };
  return map[ch];
}

function identityPts(ch: RgbChannel | HueChannel): CurvePoint[] {
  const isHueCh = ['HvsH','HvsS','HvsL','LvsS','SvsS'].includes(ch);
  return isHueCh ? [[0, 0.5], [1, 0.5]] : [[0, 0], [1, 1]];
}

class CurveEditor {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pts: CurvePoint[] = [];
  private isHue: boolean;
  channelColor: string;
  private dragging: number | null = null;
  onChange: (pts: CurvePoint[]) => void = () => {};

  constructor(size: number, isHue: boolean, color: string) {
    this.isHue = isHue;
    this.channelColor = color;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.canvas.className = 'crv-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    this.bindEvents();
  }

  setPoints(pts: CurvePoint[]) {
    this.pts = pts.map(p => [p[0], p[1]] as CurvePoint);
    this.draw();
  }

  getPoints(): CurvePoint[] {
    return this.pts.map(p => [p[0], p[1]] as CurvePoint);
  }

  private toCanvas(x: number, y: number): [number, number] {
    const pad = 12, s = this.canvas.width;
    return [pad + x * (s - pad * 2), pad + (1 - y) * (s - pad * 2)];
  }

  private fromCanvas(cx: number, cy: number): [number, number] {
    const pad = 12, s = this.canvas.width, inner = s - pad * 2;
    return [
      Math.max(0, Math.min(1, (cx - pad) / inner)),
      Math.max(0, Math.min(1, 1 - (cy - pad) / inner)),
    ];
  }

  private hitTest(cx: number, cy: number): number {
    for (let i = 0; i < this.pts.length; i++) {
      const [px, py] = this.toCanvas(this.pts[i][0], this.pts[i][1]);
      if (Math.hypot(cx - px, cy - py) <= PT_HIT) return i;
    }
    return -1;
  }

  private canvasPos(e: PointerEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    const sc = this.canvas.width / r.width;
    return [(e.clientX - r.left) * sc, (e.clientY - r.top) * sc];
  }

  private bindEvents() {
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const [cx, cy] = this.canvasPos(e);
      let idx = this.hitTest(cx, cy);
      if (idx >= 0) {
        if (e.detail === 2 && this.pts.length > 2) {
          this.pts.splice(idx, 1);
          this.onChange(this.getPoints()); this.draw(); return;
        }
      } else {
        const [x, y] = this.fromCanvas(cx, cy);
        this.pts.push([x, y]);
        this.pts.sort((a, b) => a[0] - b[0]);
        idx = this.pts.findIndex(p => p[0] === x && p[1] === y);
      }
      this.dragging = idx;
      this.canvas.setPointerCapture(e.pointerId);
      this.onChange(this.getPoints()); this.draw();
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (this.dragging === null) return;
      const [cx, cy] = this.canvasPos(e);
      const [x, y] = this.fromCanvas(cx, cy);
      const pt = this.pts[this.dragging];
      const isEnd = this.dragging === 0 || this.dragging === this.pts.length - 1;
      if (isEnd) { pt[1] = y; } else {
        pt[0] = x; pt[1] = y;
        this.pts.sort((a, b) => a[0] - b[0]);
        this.dragging = this.pts.indexOf(pt);
      }
      this.onChange(this.getPoints()); this.draw();
    });

    this.canvas.addEventListener('pointerup', (e) => {
      this.canvas.releasePointerCapture(e.pointerId);
      this.dragging = null;
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const [cx, cy] = this.canvasPos(e);
      const idx = this.hitTest(cx, cy);
      if (idx >= 0 && this.pts.length > 2) {
        this.pts.splice(idx, 1);
        this.onChange(this.getPoints()); this.draw();
      }
    });
  }

  draw() {
    const ctx = this.ctx;
    const s = this.canvas.width, pad = 12, inner = s - pad * 2;

    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = '#141418';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(pad, pad, inner, inner);

    if (this.isHue) {
      const grad = ctx.createLinearGradient(pad, 0, pad + inner, 0);
      for (let i = 0; i <= 12; i++) {
        const [r, g, b] = hsvToRgb(i / 12, 0.85, 0.65);
        grad.addColorStop(i / 12, `rgba(${r},${g},${b},0.18)`);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(pad, pad, inner, inner);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (const t of [0.25, 0.5, 0.75]) {
      const [gx] = this.toCanvas(t, 0);
      ctx.beginPath(); ctx.moveTo(gx, pad); ctx.lineTo(gx, pad + inner); ctx.stroke();
      const [, gy] = this.toCanvas(0, t);
      ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(pad + inner, gy); ctx.stroke();
    }

    ctx.setLineDash([2, 4]);
    ctx.lineWidth = 0.75;
    if (this.isHue) {
      const [, ny] = this.toCanvas(0, 0.5);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.moveTo(pad, ny); ctx.lineTo(pad + inner, ny); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.moveTo(pad, pad + inner); ctx.lineTo(pad + inner, pad); ctx.stroke();
    }
    ctx.setLineDash([]);

    if (this.pts.length >= 2) {
      const lut = evaluateCurve(this.pts, inner, !this.isHue);
      ctx.beginPath();
      for (let i = 0; i <= inner; i++) {
        const val = lut[Math.min(i, lut.length - 1)];
        const x = pad + i, y = pad + (1 - val) * inner;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = this.channelColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    for (const [px, py] of this.pts) {
      const [cx, cy] = this.toCanvas(px, py);
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#1e1e2c'; ctx.fill();
      ctx.strokeStyle = this.channelColor; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
}

function makeCurveSection(
  label: string,
  channels: { key: string; label: string; color: string }[],
  isHue: boolean,
  getGrading: () => ColorGrading,
  onChange: () => void
): HTMLElement {
  const section = document.createElement('div');
  section.className = 'crv-section';

  const header = document.createElement('div');
  header.className = 'crv-section-header';
  const title = document.createElement('span');
  title.className = 'crv-section-title';
  title.textContent = label;
  const resetBtn = document.createElement('button');
  resetBtn.className = 'crv-btn';
  resetBtn.title = 'Reset curve';
  resetBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
  header.appendChild(title); header.appendChild(resetBtn);
  section.appendChild(header);

  const tabs = document.createElement('div');
  tabs.className = 'crv-ch-tabs';
  const tabBtns: HTMLButtonElement[] = [];
  channels.forEach(ch => {
    const btn = document.createElement('button');
    btn.className = 'crv-ch-tab';
    btn.textContent = ch.label;
    btn.dataset.key = ch.key;
    btn.style.setProperty('--ch-color', ch.color);
    tabBtns.push(btn);
    tabs.appendChild(btn);
  });
  section.appendChild(tabs);

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'crv-canvas-wrap';
  const ed = new CurveEditor(CURVE_SIZE, isHue, channels[0].color);
  canvasWrap.appendChild(ed.canvas);
  section.appendChild(canvasWrap);

  const hint = document.createElement('div');
  hint.className = 'crv-hint';
  hint.textContent = 'Click to add · Dbl-click or right-click to remove';
  section.appendChild(hint);

  let activeCh = channels[0].key;

  function activateChannel(key: string) {
    activeCh = key;
    const ch = channels.find(c => c.key === key)!;
    ed.channelColor = ch.color;
    const pts = (getGrading() as any)[cgCurveKey(key as any)] as CurvePoint[];
    ed.setPoints(pts);
    ed.onChange = (newPts) => {
      (getGrading() as any)[cgCurveKey(activeCh as any)] = newPts;
      onChange();
    };
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.key === key));
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => activateChannel(btn.dataset.key!));
  });

  resetBtn.addEventListener('click', () => {
    const identity = identityPts(activeCh as any);
    (getGrading() as any)[cgCurveKey(activeCh as any)] = [...identity];
    ed.setPoints([...identity]);
    onChange();
  });

  activateChannel(channels[0].key);

  return Object.assign(section, {
    refresh() { activateChannel(activeCh); }
  });
}

export function setupCurvesTab(
  el: HTMLElement,
  getGrading: () => ColorGrading,
  onChange: () => void
) {
  el.innerHTML = '';
  el.className = 'crv-tab';

  const rgbSection = makeCurveSection('RGB Curves', RGB_CHANNELS, false, getGrading, onChange);
  const divider = document.createElement('div');
  divider.className = 'crv-sep';
  const hueSection = makeCurveSection('Hue Curves', HUE_CHANNELS, true, getGrading, onChange);

  el.appendChild(rgbSection);
  el.appendChild(divider);
  el.appendChild(hueSection);

  return {
    refresh() {
      (rgbSection as any).refresh();
      (hueSection as any).refresh();
    }
  };
}
