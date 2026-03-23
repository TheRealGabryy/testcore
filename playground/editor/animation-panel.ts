import type { EditorState } from './state';
import { getSettings } from './settings';
import { applyEasing, EASING_PRESETS, makeCurveSvg, toCoreEasing } from './easing';

function ROW_H() { return getSettings().keyframes.rowHeight; }
function LABEL_W() { return getSettings().keyframes.labelWidth; }
function RULER_H() { return getSettings().keyframes.rulerHeight; }
function DIAMOND() { return getSettings().keyframes.diamondSize; }
const CURVE_H_MULT = 3;

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
type KfFrame = { time: unknown; value: unknown; easing?: string; _customEasing?: string };

function getFrames(clip: Record<string, unknown>, key: string): KfFrame[] {
  const anims = (clip['animations'] ?? []) as Array<Record<string, unknown>>;
  const anim = anims.find(a => a['key'] === key);
  return (anim?.['frames'] ?? []) as KfFrame[];
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
  const frames = anim['frames'] as KfFrame[];
  const threshold = 0.5 / fps;
  const existing = frames.findIndex(f => Math.abs(timeToSecs(f.time) - relTimeSecs) < threshold);
  if (existing >= 0) {
    (frames[existing] as any).value = value;
  } else {
    frames.push({ time: relTimeSecs, value, easing: 'linear', _customEasing: 'linear' });
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

function drawCurveGraph(
  ctx: CanvasRenderingContext2D,
  frames: KfFrame[],
  clipDelay: number,
  rowIndex: number,
  graphY: number,
  graphH: number,
  zoom: number,
  scrollX: number,
  cw: number,
  dpr: number,
  propKey: string,
  selKf: SelectedKf | null
) {
  const sett = getSettings();
  ctx.fillStyle = rowIndex % 2 === 0 ? '#0d1523' : '#0a1118';
  ctx.fillRect(0, graphY * dpr, cw, graphH * dpr);

  const padV = 8;
  const innerH = graphH - padV * 2;

  let minVal = Infinity, maxVal = -Infinity;
  for (const f of frames) {
    const v = typeof f.value === 'number' ? f.value : 0;
    minVal = Math.min(minVal, v);
    maxVal = Math.max(maxVal, v);
  }
  if (!isFinite(minVal)) { minVal = 0; maxVal = 1; }
  if (minVal === maxVal) { minVal -= 1; maxVal += 1; }
  const valRange = maxVal - minVal;

  function valToCanvasY(v: number): number {
    const norm = (v - minVal) / valRange;
    return (graphY + padV + (1 - norm) * innerH) * dpr;
  }

  const gridFracs = [0, 0.25, 0.5, 0.75, 1.0];
  ctx.lineWidth = 0.5 * dpr;
  for (const g of gridFracs) {
    const y = valToCanvasY(minVal + g * valRange);
    ctx.strokeStyle = g === 0 || g === 1 ? '#1e2d3d' : '#151f2a';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cw, y);
    ctx.stroke();
  }

  if (frames.length >= 2) {
    const STEPS = 60;
    for (let seg = 0; seg < frames.length - 1; seg++) {
      const f0 = frames[seg];
      const f1 = frames[seg + 1];
      const t0 = clipDelay + timeToSecs(f0.time);
      const t1 = clipDelay + timeToSecs(f1.time);
      const v0 = typeof f0.value === 'number' ? f0.value : 0;
      const v1 = typeof f1.value === 'number' ? f1.value : 0;
      const easingId = f0._customEasing ?? f0.easing ?? 'linear';

      ctx.strokeStyle = sett.keyframes.keyframeLine;
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      for (let s = 0; s <= STEPS; s++) {
        const progress = s / STEPS;
        const easedProgress = applyEasing(progress, easingId);
        const timeAtPoint = t0 + (t1 - t0) * progress;
        const valueAtPoint = v0 + (v1 - v0) * easedProgress;
        const x = (timeAtPoint * zoom - scrollX) * dpr;
        const y = valToCanvasY(valueAtPoint);
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  for (let fi = 0; fi < frames.length; fi++) {
    const f = frames[fi];
    const t = clipDelay + timeToSecs(f.time);
    const v = typeof f.value === 'number' ? f.value : 0;
    const x = (t * zoom - scrollX) * dpr;
    const y = valToCanvasY(v);
    if (x < -20 * dpr || x > cw + 20 * dpr) continue;

    const isSel = selKf?.propKey === propKey && selKf.frameIndex === fi;
    ctx.beginPath();
    ctx.arc(x, y, 4.5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = isSel ? sett.keyframes.keyframeSelected : sett.keyframes.keyframeColor;
    ctx.strokeStyle = isSel ? '#16a34a' : '#a07820';
    ctx.lineWidth = 1.5 * dpr;
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = '#7a93bc';
  ctx.font = `${9 * dpr}px Inter, sans-serif`;
  ctx.textAlign = 'left';
  const maxLabel = maxVal.toFixed(1);
  const minLabel = minVal.toFixed(1);
  ctx.fillText(maxLabel, 3 * dpr, (graphY + padV + 8) * dpr);
  ctx.fillText(minLabel, 3 * dpr, (graphY + graphH - padV - 2) * dpr);
}

function drawTracks(
  canvas: HTMLCanvasElement,
  clip: Record<string, unknown>,
  props: PropDef[],
  expandedProps: Set<string>,
  zoom: number,
  scrollX: number,
  selKf: SelectedKf | null,
  dpr: number
) {
  const cw = canvas.width;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, cw, canvas.height);

  const sett = getSettings();
  const diamondSize = DIAMOND();
  const clipDelay = timeToSecs((clip as any).delay ?? (clip as any)._delay ?? 0);

  let currentY = 0;

  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    const isExpanded = expandedProps.has(prop.key);
    const normalH = ROW_H();
    const rowH = isExpanded ? normalH + normalH * CURVE_H_MULT : normalH;

    ctx.fillStyle = i % 2 === 0 ? sett.timeline.trackBg : sett.timeline.trackAltBg;
    ctx.fillRect(0, currentY * dpr, cw, rowH * dpr);

    ctx.strokeStyle = sett.appearance.borderPrimary;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, (currentY + rowH) * dpr - 0.5);
    ctx.lineTo(cw, (currentY + rowH) * dpr - 0.5);
    ctx.stroke();

    const centerY = (currentY + normalH / 2) * dpr;
    const frames = getFrames(clip, prop.key);

    if (!isExpanded) {
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

    if (isExpanded) {
      drawCurveGraph(
        ctx,
        frames,
        clipDelay,
        i,
        currentY + normalH,
        normalH * CURVE_H_MULT,
        zoom,
        scrollX,
        cw,
        dpr,
        prop.key,
        selKf
      );
    }

    currentY += rowH;
  }
}

function dismissEasingMenu() {
  document.querySelectorAll('.kf-curve-menu').forEach(el => el.remove());
}

function showEasingMenu(
  clientX: number,
  clientY: number,
  frame: KfFrame,
  onSelect: (id: string) => void
) {
  dismissEasingMenu();

  const currentEasing = frame._customEasing ?? frame.easing ?? 'linear';
  const menu = document.createElement('div');
  menu.className = 'kf-curve-menu';

  const groups = [...new Set(EASING_PRESETS.map(p => p.group))];
  for (const group of groups) {
    const presets = EASING_PRESETS.filter(p => p.group === group);
    const groupEl = document.createElement('div');
    groupEl.className = 'kf-curve-menu-section';

    const label = document.createElement('div');
    label.className = 'kf-curve-menu-section-label';
    label.textContent = group;
    groupEl.appendChild(label);

    for (const preset of presets) {
      const item = document.createElement('button');
      item.className = 'kf-curve-menu-item';
      if (preset.id === currentEasing) item.classList.add('kf-curve-menu-item--active');

      const preview = document.createElement('span');
      preview.className = 'kf-curve-preview';
      preview.innerHTML = makeCurveSvg(preset.id, 48, 26,
        preset.id === currentEasing ? '#f5ca5a' : '#3b7dd8', 1.5);

      const text = document.createElement('span');
      text.className = 'kf-curve-item-label';
      text.textContent = preset.label;

      if (preset.id === currentEasing) {
        const check = document.createElement('span');
        check.className = 'kf-curve-item-check';
        check.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>`;
        item.appendChild(preview);
        item.appendChild(text);
        item.appendChild(check);
      } else {
        item.appendChild(preview);
        item.appendChild(text);
      }

      item.addEventListener('click', e => {
        e.stopPropagation();
        onSelect(preset.id);
        dismissEasingMenu();
      });

      groupEl.appendChild(item);
    }

    menu.appendChild(groupEl);
  }

  document.body.appendChild(menu);

  const w = 220;
  let left = clientX + 4;
  let top = clientY;
  if (left + w > window.innerWidth) left = clientX - w - 4;
  if (top + menu.offsetHeight > window.innerHeight) top = window.innerHeight - menu.offsetHeight - 8;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  const close = (e: Event) => {
    if (!menu.contains(e.target as Node)) {
      dismissEasingMenu();
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEsc);
    }
  };
  const closeOnEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      dismissEasingMenu();
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEsc);
    }
  };
  setTimeout(() => {
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEsc);
  }, 10);
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
  const expandedProps = new Set<string>();

  let rulerCanvas: HTMLCanvasElement | null = null;
  let tracksCanvas: HTMLCanvasElement | null = null;
  let playheadEl: HTMLElement | null = null;
  let tracksScrollEl: HTMLElement | null = null;
  let labelsColEl: HTMLElement | null = null;
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

  function getTotalTracksHeight(): number {
    let h = 0;
    for (const prop of props) {
      h += expandedProps.has(prop.key) ? ROW_H() * (1 + CURVE_H_MULT) : ROW_H();
    }
    return h;
  }

  function redrawTracks() {
    const clip = getClip();
    if (!tracksCanvas || !clip) return;
    const totalH = getTotalTracksHeight();
    const pw = tracksScrollEl?.clientWidth ?? 400;
    tracksCanvas.style.width = `${pw}px`;
    tracksCanvas.style.height = `${totalH}px`;
    tracksCanvas.width = Math.round(pw * dpr);
    tracksCanvas.height = Math.round(totalH * dpr);
    drawTracks(tracksCanvas, clip, props, expandedProps, state.zoom, scrollX, selKf, dpr);

    if (rulerCanvas && tracksScrollEl) {
      const rw = tracksScrollEl.clientWidth;
      rulerCanvas.style.width = `${rw}px`;
      rulerCanvas.style.height = `${RULER_H()}px`;
      rulerCanvas.width = Math.round(rw * dpr);
      rulerCanvas.height = Math.round(RULER_H() * dpr);
      const ctx = rulerCanvas.getContext('2d')!;
      drawRuler(ctx, rulerCanvas.width, state.zoom, scrollX, dpr);
    }

    rebuildLabels();
    updatePlayhead();
    updatePropValues();
  }

  function rebuildLabels() {
    if (!labelsColEl) return;
    labelsColEl.innerHTML = '';
    for (const prop of props) {
      const isExpanded = expandedProps.has(prop.key);
      const normalH = ROW_H();
      const rowH = isExpanded ? normalH + normalH * CURVE_H_MULT : normalH;

      const lbl = document.createElement('div');
      lbl.className = 'kft-label-row';
      lbl.style.height = `${rowH}px`;
      lbl.style.alignItems = 'flex-start';
      lbl.style.paddingTop = '0';
      lbl.style.flexDirection = 'column';
      lbl.style.justifyContent = 'flex-start';

      const topRow = document.createElement('div');
      topRow.className = 'kft-label-top-row';
      topRow.style.height = `${normalH}px`;
      topRow.style.display = 'flex';
      topRow.style.alignItems = 'center';
      topRow.style.width = '100%';
      topRow.style.paddingLeft = '6px';
      topRow.style.gap = '4px';

      const arrowBtn = document.createElement('button');
      arrowBtn.className = `kft-expand-btn${isExpanded ? ' kft-expand-btn--open' : ''}`;
      arrowBtn.title = isExpanded ? 'Collapse curve' : 'Expand curve';
      arrowBtn.innerHTML = `<svg viewBox="0 0 8 8" fill="currentColor"><polygon points="${isExpanded ? '1,2 7,2 4,7' : '2,1 7,4 2,7'}"/></svg>`;
      arrowBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (expandedProps.has(prop.key)) expandedProps.delete(prop.key);
        else expandedProps.add(prop.key);
        redrawTracks();
      });

      const nameEl = document.createElement('span');
      nameEl.className = 'kft-label-name';
      nameEl.textContent = prop.label;
      nameEl.style.overflow = 'hidden';
      nameEl.style.textOverflow = 'ellipsis';
      nameEl.style.whiteSpace = 'nowrap';

      topRow.appendChild(arrowBtn);
      topRow.appendChild(nameEl);
      lbl.appendChild(topRow);

      if (isExpanded) {
        const curveLabel = document.createElement('div');
        curveLabel.className = 'kft-label-curve-hint';
        const c = getClip();
        if (c) {
          const frames = getFrames(c, prop.key);
          if (selKf?.propKey === prop.key && selKf.frameIndex < frames.length) {
            const f = frames[selKf.frameIndex];
            const easingId = f._customEasing ?? f.easing ?? 'linear';
            const preset = EASING_PRESETS.find(p => p.id === easingId);
            curveLabel.textContent = preset?.label ?? easingId;
          } else {
            curveLabel.textContent = 'value curve';
          }
        }
        lbl.appendChild(curveLabel);
      }

      labelsColEl.appendChild(lbl);
    }
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

  function hitTestKeyframe(cx: number, cy: number): { propKey: string; frameIndex: number; frame: KfFrame } | null {
    const c = getClip();
    if (!c) return null;
    const clipDelay = timeToSecs((c as any)._delay ?? (c as any).delay ?? 0);
    let currentY = 0;
    for (const prop of props) {
      const normalH = ROW_H();
      const isExpanded = expandedProps.has(prop.key);
      const rowH = isExpanded ? normalH + normalH * CURVE_H_MULT : normalH;
      if (cy >= currentY && cy < currentY + rowH) {
        const frames = getFrames(c, prop.key);

        if (isExpanded && cy >= currentY + normalH) {
          const graphY = currentY + normalH;
          const graphH = normalH * CURVE_H_MULT;
          const padV = 8;
          const innerH = graphH - padV * 2;

          let minVal = Infinity, maxVal = -Infinity;
          for (const f of frames) {
            const v = typeof f.value === 'number' ? f.value : 0;
            minVal = Math.min(minVal, v);
            maxVal = Math.max(maxVal, v);
          }
          if (!isFinite(minVal)) { minVal = 0; maxVal = 1; }
          if (minVal === maxVal) { minVal -= 1; maxVal += 1; }
          const valRange = maxVal - minVal;

          for (let fi = 0; fi < frames.length; fi++) {
            const f = frames[fi];
            const t = clipDelay + timeToSecs(f.time);
            const v = typeof f.value === 'number' ? f.value : 0;
            const fx = t * state.zoom - scrollX;
            const norm = (v - minVal) / valRange;
            const fy = graphY + padV + (1 - norm) * innerH;
            if (Math.abs(fx - cx) < 10 && Math.abs(fy - cy) < 10) {
              return { propKey: prop.key, frameIndex: fi, frame: frames[fi] };
            }
          }
          return null;
        }

        if (!isExpanded) {
          const centerY = currentY + normalH / 2;
          for (let fi = 0; fi < frames.length; fi++) {
            const t = clipDelay + timeToSecs(frames[fi].time);
            const dx = (t * state.zoom - scrollX) - cx;
            const dy = centerY - cy;
            if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
              return { propKey: prop.key, frameIndex: fi, frame: frames[fi] };
            }
          }
        }
        return null;
      }
      currentY += rowH;
    }
    return null;
  }

  function buildTimelinePanel(_clip: Record<string, unknown>) {
    timelineEl.innerHTML = '';
    selKf = null;

    const body = document.createElement('div');
    body.className = 'kft-body';
    timelineEl.appendChild(body);

    const labelsCol = document.createElement('div');
    labelsCol.className = 'kft-labels';
    labelsCol.style.width = `${LABEL_W()}px`;
    body.appendChild(labelsCol);
    labelsColEl = labelsCol;

    rebuildLabels();

    const tracksPanel = document.createElement('div');
    tracksPanel.className = 'kft-tracks-panel';
    body.appendChild(tracksPanel);

    const headerRow = document.createElement('div');
    headerRow.className = 'kft-header';

    rulerCanvas = document.createElement('canvas');
    rulerCanvas.className = 'kft-ruler-canvas';
    headerRow.appendChild(rulerCanvas);
    tracksPanel.appendChild(headerRow);

    const tracksWrap = document.createElement('div');
    tracksWrap.className = 'kft-tracks-wrap';
    tracksPanel.appendChild(tracksWrap);

    tracksScrollEl = document.createElement('div');
    tracksScrollEl.className = 'kft-tracks-scroll';
    tracksWrap.appendChild(tracksScrollEl);

    tracksCanvas = document.createElement('canvas');
    tracksCanvas.className = 'kft-tracks-canvas';
    tracksScrollEl.appendChild(tracksCanvas);

    playheadEl = document.createElement('div');
    playheadEl.className = 'kft-playhead';
    tracksPanel.appendChild(playheadEl);

    tracksScrollEl.addEventListener('scroll', () => {
      scrollX = tracksScrollEl!.scrollLeft;
      redrawTracks();
    });

    tracksCanvas.addEventListener('click', (e) => {
      const rect = tracksCanvas!.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const hit = hitTestKeyframe(cx, cy);
      if (hit) {
        selKf = { propKey: hit.propKey, frameIndex: hit.frameIndex };
        redrawTracks();
        return;
      }

      selKf = null;
      state.composition.seek((cx + scrollX) / state.zoom);
      redrawTracks();
    });

    tracksCanvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = tracksCanvas!.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const hit = hitTestKeyframe(cx, cy);
      if (hit) {
        selKf = { propKey: hit.propKey, frameIndex: hit.frameIndex };
        redrawTracks();
        showEasingMenu(e.clientX, e.clientY, hit.frame, (easingId) => {
          (hit.frame as any)._customEasing = easingId;
          (hit.frame as any).easing = toCoreEasing(easingId);
          redrawTracks();
          state.composition.update();
        });
        return;
      }

      if (selKf) {
        const c = getClip();
        if (c) {
          removeKf(c, selKf.propKey, selKf.frameIndex);
          selKf = null;
          redrawTracks();
          state.composition.update();
        }
      }
    });

    const roTracks = new ResizeObserver(() => redrawTracks());
    roTracks.observe(tracksScrollEl);

    setTimeout(() => redrawTracks(), 50);
  }

  function buildEmpty() {
    propsEl.innerHTML = '';
    timelineEl.innerHTML = '';
    labelsColEl = null;

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
