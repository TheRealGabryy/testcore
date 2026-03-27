import type { EditorState } from './state';
import { getSettings } from './settings';

const RULER_H = 16;
const PADDING_RIGHT = 24;
const MIN_CLIP_W = 3;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${ms}`;
}

function computeAutoZoom(containerWidth: number, duration: number): number {
  if (duration <= 0) return 20;
  const usable = Math.max(containerWidth - PADDING_RIGHT, 40);
  return usable / duration;
}

function computeRulerStep(zoom: number): number {
  const minPixels = 48;
  const steps = [0.25, 0.5, 1, 2, 5, 10, 30, 60];
  for (const s of steps) {
    if (s * zoom >= minPixels) return s;
  }
  return 60;
}

export function setupMicroScrub(sectionEl: HTMLElement, state: EditorState): void {
  sectionEl.innerHTML = `
    <div class="ms-container">
      <canvas class="ms-ruler"></canvas>
      <div class="ms-tracks-wrap">
        <div class="ms-tracks"></div>
        <div class="ms-playhead"></div>
      </div>
    </div>
  `;

  const container = sectionEl.querySelector('.ms-container') as HTMLElement;
  const rulerCanvas = sectionEl.querySelector('.ms-ruler') as HTMLCanvasElement;
  const tracksWrap = sectionEl.querySelector('.ms-tracks-wrap') as HTMLElement;
  const tracksEl = sectionEl.querySelector('.ms-tracks') as HTMLElement;
  const playheadEl = sectionEl.querySelector('.ms-playhead') as HTMLElement;

  let zoom = 20;
  let seeking = false;

  function getCompositionDuration(): number {
    return Math.max((state.composition as any).duration ?? 0, 1);
  }

  function recalcZoom(): void {
    const w = container.clientWidth;
    if (w <= 0) return;
    zoom = computeAutoZoom(w, getCompositionDuration());
  }

  function drawRuler(): void {
    const w = container.clientWidth;
    if (w <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    rulerCanvas.width = w * dpr;
    rulerCanvas.height = RULER_H * dpr;
    rulerCanvas.style.width = `${w}px`;
    rulerCanvas.style.height = `${RULER_H}px`;

    const ctx = rulerCanvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const s = getSettings();
    ctx.fillStyle = s.appearance.bgSurface;
    ctx.fillRect(0, 0, w, RULER_H);

    ctx.fillStyle = s.appearance.borderPrimary;
    ctx.fillRect(0, RULER_H - 1, w, 1);

    const step = computeRulerStep(zoom);
    const duration = getCompositionDuration();
    const endT = duration + step;

    ctx.fillStyle = s.timeline.rulerText;
    ctx.font = `9px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';

    for (let t = 0; t <= endT; t += step) {
      const x = t * zoom;
      if (x > w) break;

      ctx.fillStyle = s.timeline.rulerMajorTick;
      ctx.fillRect(x, RULER_H - 5, 1, 5);

      if (t > 0 || step >= 1) {
        ctx.fillStyle = s.timeline.rulerText;
        ctx.fillText(formatTime(t), x + 2, RULER_H / 2 - 1);
      }
    }
  }

  function renderTracks(): void {
    const w = container.clientWidth;
    if (w <= 0) return;

    tracksEl.innerHTML = state.editorLayers.map(layer => {
      const clips = layer.clips.map(ec => {
        const delay = (ec.clip as any).delay ?? 0;
        const dur = (ec.clip as any).duration ?? 0;
        const left = delay * zoom;
        const clipW = Math.max(dur * zoom, MIN_CLIP_W);
        const isSelected = ec.id === state.selectedClipId;
        const opacity = layer.visible ? 1 : 0.3;

        const labelVisible = clipW > 28;
        const label = labelVisible
          ? `<span class="ms-clip-label">${ec.name}</span>`
          : '';

        return `<div class="ms-clip clip-type-${String(ec.clip.type)}${isSelected ? ' selected' : ''}"
          style="left:${left}px;width:${clipW}px;opacity:${opacity}"
          data-clip-id="${ec.id}" data-layer-id="${layer.id}">${label}</div>`;
      }).join('');

      return `<div class="ms-track" data-layer-id="${layer.id}">${clips}</div>`;
    }).join('');

    tracksEl.querySelectorAll('.ms-clip').forEach(clipEl => {
      clipEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = (clipEl as HTMLElement).dataset.clipId!;
        const lid = (clipEl as HTMLElement).dataset.layerId!;
        state.selectClip(id);
        state.selectLayer(lid);
      });
    });

  }

  function updatePlayhead(): void {
    const t = (state.composition as any).currentTime ?? 0;
    const x = t * zoom;
    playheadEl.style.left = `${x}px`;
  }

  function fullRender(): void {
    recalcZoom();
    drawRuler();
    renderTracks();
    updatePlayhead();
  }

  function seekFromEvent(e: MouseEvent): void {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = Math.max(0, Math.min(x / zoom, getCompositionDuration()));
    state.composition.seek(t);
  }

  rulerCanvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    seeking = true;
    seekFromEvent(e);
  });

  tracksWrap.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.ms-clip')) return;
    seeking = true;
    seekFromEvent(e);
  });

  document.addEventListener('mousemove', (e) => {
    if (!seeking) return;
    seekFromEvent(e);
  });

  document.addEventListener('mouseup', () => {
    seeking = false;
  });

  state.composition.on('playback:time', () => {
    updatePlayhead();
  });

  state.on('layers:change', fullRender);
  state.on('timeline:change', fullRender);
  state.on('selection:change', () => renderTracks());
  state.on('zoom:change', () => {
    /* micro scrub ignores zoom:change — it uses auto-fit */
  });

  const ro = new ResizeObserver(() => fullRender());
  ro.observe(sectionEl);

  fullRender();
}
