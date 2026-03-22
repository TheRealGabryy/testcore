import type { EditorState } from './state';
import { getSettings } from './settings';

function ROW_H() { return getSettings().keyframes.rowHeight; }
function LABEL_W() { return getSettings().keyframes.labelWidth; }
function RULER_H() { return getSettings().keyframes.rulerHeight; }
function DIAMOND() { return getSettings().keyframes.diamondSize; }

interface PropDef {
  key: string;
  label: string;
  unit: string;
  decimals: number;
  group: string;
}

const BASE_VISUAL: PropDef[] = [
  { key: 'opacity',   label: 'Opacity',    unit: '%',  decimals: 1, group: 'Transform' },
  { key: 'x',        label: 'Position X',  unit: 'px', decimals: 0, group: 'Transform' },
  { key: 'y',        label: 'Position Y',  unit: 'px', decimals: 0, group: 'Transform' },
  { key: 'scale',    label: 'Scale',       unit: '',   decimals: 3, group: 'Transform' },
  { key: 'rotation', label: 'Rotation',    unit: '°',  decimals: 1, group: 'Transform' },
  { key: 'scaleX',   label: 'Scale X',     unit: '',   decimals: 3, group: 'Transform' },
  { key: 'scaleY',   label: 'Scale Y',     unit: '',   decimals: 3, group: 'Transform' },
  { key: 'anchorX',  label: 'Anchor X',    unit: '',   decimals: 3, group: 'Transform' },
  { key: 'anchorY',  label: 'Anchor Y',    unit: '',   decimals: 3, group: 'Transform' },
];

const ANIMATABLE: Record<string, PropDef[]> = {
  VIDEO:   BASE_VISUAL,
  IMAGE:   BASE_VISUAL,
  TEXT:    [...BASE_VISUAL,
    { key: 'fontSize', label: 'Font Size', unit: 'px', decimals: 0, group: 'Text' },
  ],
  RECT:    [...BASE_VISUAL,
    { key: 'width',  label: 'Width',  unit: 'px', decimals: 0, group: 'Size' },
    { key: 'height', label: 'Height', unit: 'px', decimals: 0, group: 'Size' },
    { key: 'radius', label: 'Radius', unit: 'px', decimals: 1, group: 'Style' },
  ],
  ELLIPSE: [...BASE_VISUAL,
    { key: 'width',  label: 'Width',  unit: 'px', decimals: 0, group: 'Size' },
    { key: 'height', label: 'Height', unit: 'px', decimals: 0, group: 'Size' },
  ],
  POLYGON: [...BASE_VISUAL,
    { key: 'width',  label: 'Width',  unit: 'px', decimals: 0, group: 'Size' },
    { key: 'height', label: 'Height', unit: 'px', decimals: 0, group: 'Size' },
    { key: 'sides',  label: 'Sides',  unit: '',   decimals: 0, group: 'Style' },
  ],
};

function timeToSecs(t: unknown): number {
  if (typeof t === 'number') return t;
  if (typeof t === 'string') {
    const n = parseFloat(t);
    if (t.endsWith('ms'))  return n / 1000;
    if (t.endsWith('min')) return n * 60;
    if (t.endsWith('s'))   return n;
    if (t.endsWith('f'))   return n / 30;
    return n;
  }
  return 0;
}

function readValue(clip: Record<string, unknown>, key: string, compW: number, compH: number): number {
  const v = clip[key];
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object') {
    const r = v as Record<string, unknown>;
    if (typeof r['value'] === 'number') {
      if (key === 'x' || key === 'width')  return r['value'] / 100 * compW;
      if (key === 'y' || key === 'height') return r['value'] / 100 * compH;
      return r['value'];
    }
  }
  return 0;
}

interface SelectedKf { propKey: string; frameIndex: number }

function getFrames(clip: Record<string, unknown>, key: string): Array<{ time: unknown; value: unknown }> {
  const anims = (clip['animations'] ?? []) as Array<Record<string, unknown>>;
  const anim = anims.find(a => a['key'] === key);
  return (anim?.['frames'] ?? []) as Array<{ time: unknown; value: unknown }>;
}

function addOrUpdateKf(
  clip: Record<string, unknown>,
  key: string,
  relTimeSecs: number,
  value: number,
  fps: number
): void {
  const anims = (clip['animations'] ?? []) as Array<Record<string, unknown>>;
  let anim = anims.find(a => a['key'] === key) as Record<string, unknown> | undefined;
  if (!anim) {
    anim = { key, frames: [] };
    anims.push(anim);
    if (!clip['animations']) clip['animations'] = anims;
  }
  const frames = anim['frames'] as Array<{ time: number; value: number }>;
  const threshold = 0.5 / fps;
  const existing = frames.findIndex(f => Math.abs(timeToSecs(f.time) - relTimeSecs) < threshold);
  if (existing >= 0) {
    frames[existing].value = value;
  } else {
    frames.push({ time: relTimeSecs, value });
    frames.sort((a, b) => timeToSecs(a.time) - timeToSecs(b.time));
  }
}

function removeKf(clip: Record<string, unknown>, key: string, frameIndex: number): void {
  const anims = (clip['animations'] ?? []) as Array<Record<string, unknown>>;
  const anim = anims.find(a => a['key'] === key);
  if (!anim) return;
  const frames = anim['frames'] as unknown[];
  frames.splice(frameIndex, 1);
}

function drawRuler(ctx: CanvasRenderingContext2D, w: number, zoom: number, scrollX: number, dpr: number) {
  const sett = getSettings();
  const rulerH = RULER_H();
  const h = rulerH * dpr;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = sett.appearance.bgSurface;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = sett.appearance.borderPrimary;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h - 0.5); ctx.lineTo(w, h - 0.5);
  ctx.stroke();

  const pxPerSec = zoom * dpr;
  const secStart = scrollX / zoom;
  const interval = pxPerSec < 30 * dpr ? 5 : pxPerSec < 80 * dpr ? 2 : pxPerSec < 200 * dpr ? 1 : 0.5;
  const startSec = Math.floor(secStart / interval) * interval;
  const endSec = (scrollX + w / dpr) / zoom + interval;

  ctx.fillStyle = sett.appearance.textSecondary;
  ctx.font = `${sett.typography.rulerFontSize * dpr}px Inter, sans-serif`;
  ctx.textAlign = 'left';

  for (let s = startSec; s <= endSec; s += interval) {
    const x = (s * zoom - scrollX) * dpr;
    if (x < 0 || x > w) continue;
    ctx.strokeStyle = sett.appearance.borderLight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.55); ctx.lineTo(x, h);
    ctx.stroke();
    const label = `${s.toFixed(interval < 1 ? 1 : 0)}s`;
    ctx.fillText(label, x + 2, h * 0.45);
  }
}

function drawTracks(
  canvas: HTMLCanvasElement,
  clip: Record<string, unknown>,
  props: PropDef[],
  zoom: number,
  scrollX: number,
  selKf: SelectedKf | null,
  dpr: number
) {
  const cw = canvas.width;
  const ch = canvas.height;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, cw, ch);

  const sett = getSettings();
  const rowH = ROW_H();
  const diamondSize = DIAMOND();
  const clipDelay = timeToSecs((clip as any).delay ?? (clip as any)._delay ?? 0);

  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    const rowY = i * rowH * dpr;

    ctx.fillStyle = i % 2 === 0 ? sett.timeline.trackBg : sett.timeline.trackAltBg;
    ctx.fillRect(0, rowY, cw, rowH * dpr);

    ctx.strokeStyle = sett.appearance.borderPrimary;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, rowY + rowH * dpr - 0.5);
    ctx.lineTo(cw, rowY + rowH * dpr - 0.5);
    ctx.stroke();

    const centerY = rowY + rowH * dpr / 2;
    ctx.strokeStyle = sett.appearance.bgActive;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, centerY); ctx.lineTo(cw, centerY);
    ctx.stroke();

    const frames = getFrames(clip, prop.key);
    if (frames.length >= 2) {
      ctx.strokeStyle = sett.keyframes.keyframeLine;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let first = true;
      for (const f of frames) {
        const t = clipDelay + timeToSecs(f.time);
        const x = (t * zoom - scrollX) * dpr;
        if (first) { ctx.moveTo(x, centerY); first = false; }
        else ctx.lineTo(x, centerY);
      }
      ctx.stroke();
    }

    frames.forEach((f, fi) => {
      const t = clipDelay + timeToSecs(f.time);
      const x = (t * zoom - scrollX) * dpr;
      if (x < -20 || x > cw + 20) return;
      const isSelected = selKf?.propKey === prop.key && selKf.frameIndex === fi;
      const d = diamondSize * dpr;
      ctx.save();
      ctx.translate(x, centerY);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = isSelected ? sett.keyframes.keyframeSelected : sett.keyframes.keyframeColor;
      ctx.strokeStyle = isSelected ? '#16a34a' : '#a07820';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(-d / 2, -d / 2, d, d);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }
}

export function setupAnimationPanel(
  propsEl: HTMLElement,
  timelineEl: HTMLElement,
  state: EditorState
) {
  propsEl.innerHTML = '';
  timelineEl.innerHTML = '';

  let props: PropDef[] = [];
  let selKf: SelectedKf | null = null;
  let scrollX = 0;
  const dpr = window.devicePixelRatio || 1;

  let rulerCanvas: HTMLCanvasElement | null = null;
  let tracksCanvas: HTMLCanvasElement | null = null;
  let playheadEl: HTMLElement | null = null;
  let tracksScrollEl: HTMLElement | null = null;
  let propRowEls: Map<string, HTMLElement> = new Map();

  function getCurrentTimeSecs(): number {
    return (state.composition as any).currentTime ?? 0;
  }

  function getClipRelTime(): number {
    const sel = state.getSelectedClip();
    if (!sel) return 0;
    const clip = sel.editorClip.clip as any;
    const delay = timeToSecs(clip._delay ?? clip.delay ?? 0);
    return Math.max(0, getCurrentTimeSecs() - delay);
  }

  function getClip() {
    const sel = state.getSelectedClip();
    return sel ? (sel.editorClip.clip as unknown as Record<string, unknown>) : null;
  }

  function compW() { return (state.composition as any).width ?? 1920; }
  function compH() { return (state.composition as any).height ?? 1080; }

  function formatVal(clip: Record<string, unknown>, prop: PropDef): string {
    const v = readValue(clip, prop.key, compW(), compH());
    return `${v.toFixed(prop.decimals)}${prop.unit}`;
  }

  function hasKfAtCurrentTime(clip: Record<string, unknown>, key: string): boolean {
    const relT = getClipRelTime();
    const fps = state.fps;
    const frames = getFrames(clip, key);
    return frames.some(f => Math.abs(timeToSecs(f.time) - relT) < 0.5 / fps);
  }

  function updatePropValues() {
    const clip = getClip();
    if (!clip) return;
    for (const [key, rowEl] of propRowEls) {
      const prop = props.find(p => p.key === key);
      if (!prop) continue;
      const valEl = rowEl.querySelector('.kfp-val') as HTMLElement;
      if (valEl) valEl.textContent = formatVal(clip, prop);
      const btn = rowEl.querySelector('.kfp-kf-btn') as HTMLElement;
      if (btn) {
        const atTime = hasKfAtCurrentTime(clip, key);
        btn.classList.toggle('kfp-kf-btn--active', atTime);
        btn.title = atTime ? 'Update keyframe' : 'Add keyframe at playhead';
      }
    }
  }

  function updatePlayhead() {
    if (!playheadEl || !tracksScrollEl) return;
    const t = getCurrentTimeSecs();
    const x = t * state.zoom - scrollX;
    playheadEl.style.left = `${x}px`;
  }

  function redrawTracks() {
    const clip = getClip();
    if (!tracksCanvas || !clip) return;
    const h = props.length * ROW_H();
    const pw = tracksScrollEl?.clientWidth ?? 400;
    tracksCanvas.style.width = `${pw}px`;
    tracksCanvas.style.height = `${h}px`;
    tracksCanvas.width = Math.round(pw * dpr);
    tracksCanvas.height = Math.round(h * dpr);
    drawTracks(tracksCanvas, clip, props, state.zoom, scrollX, selKf, dpr);

    if (rulerCanvas && tracksScrollEl) {
      const rw = tracksScrollEl.clientWidth;
      rulerCanvas.style.width = `${rw}px`;
      rulerCanvas.style.height = `${RULER_H()}px`;
      rulerCanvas.width = Math.round(rw * dpr);
      rulerCanvas.height = Math.round(RULER_H() * dpr);
      const ctx = rulerCanvas.getContext('2d')!;
      drawRuler(ctx, rulerCanvas.width, state.zoom, scrollX, dpr);
    }

    updatePlayhead();
    updatePropValues();
  }

  function buildPropsPanel(clip: Record<string, unknown>) {
    propsEl.innerHTML = '';
    propRowEls.clear();

    const header = document.createElement('div');
    header.className = 'kfp-header';
    const clipType = String((clip as any).type ?? 'CLIP');
    const badge = document.createElement('span');
    badge.className = 'kfp-type-badge';
    badge.textContent = clipType;
    header.appendChild(badge);
    const title = document.createElement('span');
    title.className = 'kfp-title';
    title.textContent = 'Effect Controls';
    header.appendChild(title);
    propsEl.appendChild(header);

    const scroll = document.createElement('div');
    scroll.className = 'kfp-scroll';
    propsEl.appendChild(scroll);

    let lastGroup = '';
    for (const prop of props) {
      if (prop.group !== lastGroup) {
        lastGroup = prop.group;
        const gh = document.createElement('div');
        gh.className = 'kfp-group';
        gh.textContent = prop.group;
        scroll.appendChild(gh);
      }

      const row = document.createElement('div');
      row.className = 'kfp-row';
      row.dataset.key = prop.key;

      const btn = document.createElement('button');
      btn.className = 'kfp-kf-btn';
      btn.title = 'Add keyframe at playhead';
      btn.innerHTML = `<svg viewBox="0 0 10 10"><polygon points="5,1 9,5 5,9 1,5"/></svg>`;
      btn.addEventListener('click', () => {
        const c = getClip();
        if (!c) return;
        const relT = getClipRelTime();
        const v = readValue(c, prop.key, compW(), compH());
        addOrUpdateKf(c, prop.key, relT, v, state.fps);
        selKf = null;
        redrawTracks();
        state.composition.update();
      });

      const label = document.createElement('span');
      label.className = 'kfp-prop-name';
      label.textContent = prop.label;

      const val = document.createElement('span');
      val.className = 'kfp-val';
      val.textContent = formatVal(clip, prop);

      const frames = getFrames(clip, prop.key);
      const navRow = document.createElement('div');
      navRow.className = 'kfp-nav';

      const prevBtn = document.createElement('button');
      prevBtn.className = 'kfp-nav-btn';
      prevBtn.title = 'Previous keyframe';
      prevBtn.innerHTML = `<svg viewBox="0 0 8 8"><polyline points="6,1 2,4 6,7"/></svg>`;
      prevBtn.addEventListener('click', () => {
        const c = getClip() as any;
        if (!c) return;
        const delay = timeToSecs(c._delay ?? c.delay ?? 0);
        const frs = getFrames(c, prop.key);
        const relNow = getClipRelTime();
        const prev = frs.filter(f => timeToSecs(f.time) < relNow - 0.01).pop();
        if (prev) state.composition.seek(delay + timeToSecs(prev.time));
      });

      const nextBtn = document.createElement('button');
      nextBtn.className = 'kfp-nav-btn';
      nextBtn.title = 'Next keyframe';
      nextBtn.innerHTML = `<svg viewBox="0 0 8 8"><polyline points="2,1 6,4 2,7"/></svg>`;
      nextBtn.addEventListener('click', () => {
        const c = getClip() as any;
        if (!c) return;
        const delay = timeToSecs(c._delay ?? c.delay ?? 0);
        const frs = getFrames(c, prop.key);
        const relNow = getClipRelTime();
        const next = frs.find(f => timeToSecs(f.time) > relNow + 0.01);
        if (next) state.composition.seek(delay + timeToSecs(next.time));
      });

      if (frames.length === 0) {
        prevBtn.disabled = true; nextBtn.disabled = true;
      }

      navRow.appendChild(prevBtn);
      navRow.appendChild(nextBtn);

      row.appendChild(btn);
      row.appendChild(label);
      row.appendChild(val);
      row.appendChild(navRow);
      scroll.appendChild(row);
      propRowEls.set(prop.key, row);
    }

    const atTime = (key: string) => hasKfAtCurrentTime(clip, key);
    for (const [key, rowEl] of propRowEls) {
      const btn = rowEl.querySelector('.kfp-kf-btn') as HTMLElement;
      if (btn) btn.classList.toggle('kfp-kf-btn--active', atTime(key));
    }
  }

  function buildTimelinePanel(_clip: Record<string, unknown>) {
    timelineEl.innerHTML = '';
    selKf = null;

    const headerRow = document.createElement('div');
    headerRow.className = 'kft-header';

    rulerCanvas = document.createElement('canvas');
    rulerCanvas.className = 'kft-ruler-canvas';
    headerRow.appendChild(rulerCanvas);
    timelineEl.appendChild(headerRow);

    const body = document.createElement('div');
    body.className = 'kft-body';
    timelineEl.appendChild(body);

    const labelsCol = document.createElement('div');
    labelsCol.className = 'kft-labels';
    labelsCol.style.width = `${LABEL_W()}px`;
    body.appendChild(labelsCol);

    for (const prop of props) {
      const lbl = document.createElement('div');
      lbl.className = 'kft-label-row';
      lbl.textContent = prop.label;
      labelsCol.appendChild(lbl);
    }

    const tracksWrap = document.createElement('div');
    tracksWrap.className = 'kft-tracks-wrap';
    body.appendChild(tracksWrap);

    tracksScrollEl = document.createElement('div');
    tracksScrollEl.className = 'kft-tracks-scroll';
    tracksWrap.appendChild(tracksScrollEl);

    tracksCanvas = document.createElement('canvas');
    tracksCanvas.className = 'kft-tracks-canvas';
    tracksScrollEl.appendChild(tracksCanvas);

    playheadEl = document.createElement('div');
    playheadEl.className = 'kft-playhead';
    tracksScrollEl.appendChild(playheadEl);

    tracksScrollEl.addEventListener('scroll', () => {
      scrollX = tracksScrollEl!.scrollLeft;
      redrawTracks();
    });

    tracksCanvas.addEventListener('click', (e) => {
      const rect = tracksCanvas!.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const clickedTimeSecs = (cx + scrollX) / state.zoom;
      const rowIndex = Math.floor(cy / ROW_H());
      const prop = props[rowIndex];
      if (!prop) { state.composition.seek(clickedTimeSecs); return; }

      const c = getClip();
      if (!c) return;
      const clipDelay = timeToSecs((c as any)._delay ?? (c as any).delay ?? 0);
      const frames = getFrames(c, prop.key);
      for (let fi = 0; fi < frames.length; fi++) {
        const t = clipDelay + timeToSecs(frames[fi].time);
        const dx = (t * state.zoom - scrollX) - cx;
        const dy = (rowIndex + 0.5) * ROW_H() - cy;
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
          selKf = { propKey: prop.key, frameIndex: fi };
          redrawTracks();
          return;
        }
      }
      selKf = null;
      state.composition.seek(clickedTimeSecs);
      redrawTracks();
    });

    tracksCanvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!selKf) return;
      const c = getClip();
      if (!c) return;
      removeKf(c, selKf.propKey, selKf.frameIndex);
      selKf = null;
      redrawTracks();
      state.composition.update();
    });

    const roTracks = new ResizeObserver(() => redrawTracks());
    roTracks.observe(tracksScrollEl);

    setTimeout(() => redrawTracks(), 50);
  }

  function buildEmpty() {
    propsEl.innerHTML = '';
    timelineEl.innerHTML = '';

    const emptyP = document.createElement('div');
    emptyP.className = 'kf-empty';
    emptyP.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      <p>Select a clip to view and edit its keyframes</p>
    `;
    propsEl.appendChild(emptyP);

    const emptyT = document.createElement('div');
    emptyT.className = 'kf-empty';
    emptyT.innerHTML = `<p>Keyframe tracks appear here when a clip is selected</p>`;
    timelineEl.appendChild(emptyT);

    rulerCanvas = null;
    tracksCanvas = null;
    playheadEl = null;
    tracksScrollEl = null;
  }

  function refresh() {
    const clip = getClip();
    if (!clip) { buildEmpty(); return; }
    const clipType = String((clip as any).type ?? '');
    props = ANIMATABLE[clipType] ?? BASE_VISUAL;
    buildPropsPanel(clip);
    buildTimelinePanel(clip);
  }

  state.on('selection:change', () => { refresh(); });
  state.on('layers:change', () => { if (!state.getSelectedClip()) buildEmpty(); });
  state.on('props:change', () => { updatePropValues(); redrawTracks(); });
  state.on('zoom:change', () => { redrawTracks(); });

  state.composition.on('playback:time', () => {
    updatePlayhead();
    updatePropValues();
  });

  buildEmpty();
}
