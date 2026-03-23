import type { EditorState } from './state';
import { defaultColorGrading, evaluateCurve, type CurvePoint, type ColorGrading } from './color-grading';
import { setupWheelsTab } from './color-panel-wheels';

type RgbCh = 'master' | 'red' | 'green' | 'blue';

const CH_DEFS: { key: RgbCh; label: string; color: string; ghostColor: string; cgKey: keyof ColorGrading }[] = [
  { key: 'master', label: 'Master', color: 'rgba(220,220,220,1)',  ghostColor: 'rgba(220,220,220,0.18)', cgKey: 'curveMaster' },
  { key: 'red',    label: 'R',      color: 'rgba(224,92,92,1)',    ghostColor: 'rgba(224,92,92,0.18)',   cgKey: 'curveRed'    },
  { key: 'green',  label: 'G',      color: 'rgba(76,175,106,1)',   ghostColor: 'rgba(76,175,106,0.18)', cgKey: 'curveGreen'  },
  { key: 'blue',   label: 'B',      color: 'rgba(85,128,224,1)',   ghostColor: 'rgba(85,128,224,0.18)', cgKey: 'curveBlue'   },
];

class StudioCurvesEditor {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  activeCh: RgbCh = 'master';
  private dragging: number | null = null;
  private getGrading: () => ColorGrading;
  onChange: () => void = () => {};
  private PAD = 20;

  constructor(getGrading: () => ColorGrading) {
    this.getGrading = getGrading;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'studio-curves-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    this.bindEvents();
  }

  setSize(w: number, h: number) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.draw();
  }

  private pts(): CurvePoint[] {
    const def = CH_DEFS.find(d => d.key === this.activeCh)!;
    return (this.getGrading() as any)[def.cgKey] as CurvePoint[];
  }

  private toCanvas(x: number, y: number): [number, number] {
    const pad = this.PAD;
    const w = this.canvas.width, h = this.canvas.height;
    return [pad + x * (w - pad * 2), pad + (1 - y) * (h - pad * 2)];
  }

  private fromCanvas(cx: number, cy: number): [number, number] {
    const pad = this.PAD;
    const w = this.canvas.width, h = this.canvas.height;
    return [
      Math.max(0, Math.min(1, (cx - pad) / (w - pad * 2))),
      Math.max(0, Math.min(1, 1 - (cy - pad) / (h - pad * 2))),
    ];
  }

  private canvasPos(e: PointerEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [
      (e.clientX - r.left) * (this.canvas.width / r.width),
      (e.clientY - r.top)  * (this.canvas.height / r.height),
    ];
  }

  private hitTest(cx: number, cy: number): number {
    const pts = this.pts();
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = this.toCanvas(pts[i][0], pts[i][1]);
      if (Math.hypot(cx - px, cy - py) <= 10) return i;
    }
    return -1;
  }

  private bindEvents() {
    this.canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      const [cx, cy] = this.canvasPos(e);
      let idx = this.hitTest(cx, cy);
      if (idx >= 0) {
        if (e.detail === 2) {
          const pts = this.pts();
          if (pts.length > 2) { pts.splice(idx, 1); this.onChange(); this.draw(); return; }
        }
      } else {
        const [x, y] = this.fromCanvas(cx, cy);
        const pts = this.pts();
        pts.push([x, y]);
        pts.sort((a, b) => a[0] - b[0]);
        idx = pts.findIndex(p => p[0] === x && p[1] === y);
      }
      this.dragging = idx;
      this.canvas.setPointerCapture(e.pointerId);
      this.onChange(); this.draw();
    });

    this.canvas.addEventListener('pointermove', e => {
      if (this.dragging === null) return;
      const [cx, cy] = this.canvasPos(e);
      const [x, y] = this.fromCanvas(cx, cy);
      const pts = this.pts();
      const pt = pts[this.dragging];
      const isEnd = this.dragging === 0 || this.dragging === pts.length - 1;
      if (isEnd) {
        pt[1] = y;
      } else {
        pt[0] = x; pt[1] = y;
        pts.sort((a, b) => a[0] - b[0]);
        this.dragging = pts.indexOf(pt);
      }
      this.onChange(); this.draw();
    });

    this.canvas.addEventListener('pointerup', e => {
      this.canvas.releasePointerCapture(e.pointerId);
      this.dragging = null;
    });

    this.canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      const [cx, cy] = this.canvasPos(e);
      const idx = this.hitTest(cx, cy);
      const pts = this.pts();
      if (idx >= 0 && pts.length > 2) { pts.splice(idx, 1); this.onChange(); this.draw(); }
    });
  }

  draw() {
    if (this.canvas.width === 0 || this.canvas.height === 0) return;
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const pad = this.PAD;
    const innerW = w - pad * 2, innerH = h - pad * 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0d1420';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#111820';
    ctx.fillRect(pad, pad, innerW, innerH);

    ctx.lineWidth = 1;
    for (let step = 1; step <= 9; step++) {
      const t = step / 10;
      const isMid = step === 5;
      ctx.strokeStyle = isMid ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)';
      const [gx] = this.toCanvas(t, 0);
      ctx.beginPath(); ctx.moveTo(gx, pad); ctx.lineTo(gx, pad + innerH); ctx.stroke();
      const [, gy] = this.toCanvas(0, t);
      ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(pad + innerW, gy); ctx.stroke();
    }

    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 0.75;
    const [dx0, dy0] = this.toCanvas(0, 0);
    const [dx1, dy1] = this.toCanvas(1, 1);
    ctx.beginPath(); ctx.moveTo(dx0, dy0); ctx.lineTo(dx1, dy1); ctx.stroke();
    ctx.setLineDash([]);

    for (const def of CH_DEFS) {
      if (def.key === this.activeCh) continue;
      const pts = (this.getGrading() as any)[def.cgKey] as CurvePoint[];
      if (pts.length < 2) continue;
      const lut = evaluateCurve(pts, innerW, true);
      ctx.beginPath();
      for (let i = 0; i <= innerW; i++) {
        const val = lut[Math.min(i, lut.length - 1)];
        const x = pad + i, y = pad + (1 - val) * innerH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = def.ghostColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const activeDef = CH_DEFS.find(d => d.key === this.activeCh)!;
    const activePts = (this.getGrading() as any)[activeDef.cgKey] as CurvePoint[];
    if (activePts.length >= 2) {
      const lut = evaluateCurve(activePts, innerW, true);
      ctx.beginPath();
      for (let i = 0; i <= innerW; i++) {
        const val = lut[Math.min(i, lut.length - 1)];
        const x = pad + i, y = pad + (1 - val) * innerH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = activeDef.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (const [px, py] of activePts) {
      const [cx, cy] = this.toCanvas(px, py);
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#0d1420'; ctx.fill();
      ctx.strokeStyle = activeDef.color; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
}

export function setupStudioColorsPanel(
  el: HTMLElement,
  state: EditorState,
  onChange: () => void
) {
  el.innerHTML = '';
  el.className = 'studio-colors-panel';

  const tabBar = document.createElement('div');
  tabBar.className = 'studio-colors-tabbar';
  const TABS = [{ key: 'wheels', label: 'Wheels' }, { key: 'curves', label: 'Curves' }];
  const tabBtns: HTMLButtonElement[] = [];
  for (const t of TABS) {
    const btn = document.createElement('button');
    btn.className = 'studio-colors-tab';
    btn.dataset.tab = t.key;
    btn.textContent = t.label;
    tabBtns.push(btn);
    tabBar.appendChild(btn);
  }
  el.appendChild(tabBar);

  const contentArea = document.createElement('div');
  contentArea.className = 'studio-colors-content';
  el.appendChild(contentArea);

  const wheelsEl = document.createElement('div');
  wheelsEl.className = 'studio-wheels-wrap';
  contentArea.appendChild(wheelsEl);

  const curvesEl = document.createElement('div');
  curvesEl.className = 'studio-curves-wrap';
  contentArea.appendChild(curvesEl);

  let currentClipId: string | null = null;
  let grading: ColorGrading = defaultColorGrading();
  let activeTab = 'wheels';
  let wheelsCtrl: { refresh: () => void } | null = null;
  let curvesEditor: StudioCurvesEditor | null = null;
  let activeCh: RgbCh = 'master';
  let roHandle: ResizeObserver | null = null;

  function getOrCreateGrading(clipId: string): ColorGrading {
    if (!state.colorGradingMap.has(clipId)) {
      state.colorGradingMap.set(clipId, defaultColorGrading());
    }
    return state.colorGradingMap.get(clipId)!;
  }

  function triggerChange() {
    if (currentClipId) state.colorGradingMap.set(currentClipId, { ...grading });
    onChange();
  }

  function getGrading(): ColorGrading { return grading; }

  function buildCurvesPanel() {
    curvesEl.innerHTML = '';
    if (roHandle) { roHandle.disconnect(); roHandle = null; }

    const topRow = document.createElement('div');
    topRow.className = 'studio-curves-toprow';

    const chBar = document.createElement('div');
    chBar.className = 'studio-curves-chbar';
    const chBtns: HTMLButtonElement[] = [];
    for (const def of CH_DEFS) {
      const btn = document.createElement('button');
      btn.className = 'studio-curves-chbtn';
      btn.textContent = def.label;
      btn.dataset.ch = def.key;
      btn.style.setProperty('--ch-color', def.color);
      chBtns.push(btn);
      chBar.appendChild(btn);
    }

    const resetBtn = document.createElement('button');
    resetBtn.className = 'studio-curves-reset';
    resetBtn.title = 'Reset active channel';
    resetBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
    resetBtn.addEventListener('click', () => {
      const def = CH_DEFS.find(d => d.key === activeCh)!;
      const identity: CurvePoint[] = [[0, 0], [1, 1]];
      (getGrading() as any)[def.cgKey] = identity.map(p => [...p]);
      triggerChange();
      curvesEditor?.draw();
    });

    const hint = document.createElement('div');
    hint.className = 'studio-curves-hint';
    hint.textContent = 'Click to add · Dbl-click or right-click to remove';

    topRow.appendChild(chBar);
    topRow.appendChild(hint);
    topRow.appendChild(resetBtn);
    curvesEl.appendChild(topRow);

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'studio-curves-canvas-wrap';
    curvesEl.appendChild(canvasWrap);

    curvesEditor = new StudioCurvesEditor(getGrading);
    curvesEditor.activeCh = activeCh;
    curvesEditor.onChange = triggerChange;
    canvasWrap.appendChild(curvesEditor.canvas);

    roHandle = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const dpr = window.devicePixelRatio || 1;
          curvesEditor!.setSize(Math.floor(width * dpr), Math.floor(height * dpr));
          curvesEditor!.canvas.style.width = `${width}px`;
          curvesEditor!.canvas.style.height = `${height}px`;
        }
      }
    });
    roHandle.observe(canvasWrap);

    function activateChannel(ch: RgbCh) {
      activeCh = ch;
      curvesEditor!.activeCh = ch;
      curvesEditor!.draw();
      chBtns.forEach(b => b.classList.toggle('active', b.dataset.ch === ch));
    }
    chBtns.forEach(btn => btn.addEventListener('click', () => activateChannel(btn.dataset.ch as RgbCh)));
    activateChannel(activeCh);
  }

  function activateTab(key: string) {
    activeTab = key;
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === key));
    wheelsEl.style.display = key === 'wheels' ? '' : 'none';
    curvesEl.style.display = key === 'curves' ? '' : 'none';
    if (key === 'curves' && curvesEditor) {
      requestAnimationFrame(() => {
        const wrap = curvesEl.querySelector('.studio-curves-canvas-wrap') as HTMLElement;
        if (wrap && wrap.clientWidth > 0 && wrap.clientHeight > 0) {
          const dpr = window.devicePixelRatio || 1;
          curvesEditor!.setSize(Math.floor(wrap.clientWidth * dpr), Math.floor(wrap.clientHeight * dpr));
          curvesEditor!.canvas.style.width = `${wrap.clientWidth}px`;
          curvesEditor!.canvas.style.height = `${wrap.clientHeight}px`;
        }
      });
    }
  }

  function buildPanels() {
    wheelsEl.innerHTML = '';
    wheelsCtrl = setupWheelsTab(wheelsEl, getGrading, triggerChange);
    wheelsEl.classList.add('studio-wheels-wrap');
    buildCurvesPanel();
    activateTab(activeTab);
  }

  function refresh() {
    const sel = state.getSelectedClip();
    if (!sel) {
      currentClipId = null;
      grading = defaultColorGrading();
      buildPanels();
      return;
    }
    const clipId = sel.editorClip.id;
    const newGrading = getOrCreateGrading(clipId);
    const isNew = clipId !== currentClipId;
    currentClipId = clipId;
    grading = newGrading;
    if (isNew) {
      buildPanels();
    } else {
      wheelsCtrl?.refresh();
      curvesEditor?.draw();
      activateTab(activeTab);
    }
  }

  tabBtns.forEach(btn => btn.addEventListener('click', () => activateTab(btn.dataset.tab!)));
  state.on('selection:change', refresh);
  state.on('layers:change', refresh);
  buildPanels();
}
