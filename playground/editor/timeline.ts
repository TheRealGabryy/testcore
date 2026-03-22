import type { EditorState } from './state';
import type { EditorLayer } from './types';

const TRACK_H_NORMAL = 44;
const TRACK_H_AUDIO  = 30;
const TRACK_H_TEXT   = 22;

const AUDIO_TYPES  = new Set(['AUDIO']);
const TEXT_TYPES   = new Set(['TEXT', 'CAPTION']);

function layerType(layer: EditorLayer): 'visual' | 'audio' | 'text' {
  for (const ec of layer.clips) {
    const t = String(ec.clip.type);
    if (AUDIO_TYPES.has(t)) return 'audio';
    if (TEXT_TYPES.has(t))  return 'text';
  }
  return 'visual';
}

function trackHeight(layer: EditorLayer): number {
  const t = layerType(layer);
  if (t === 'audio') return TRACK_H_AUDIO;
  if (t === 'text')  return TRACK_H_TEXT;
  return TRACK_H_NORMAL;
}

function totalTracksHeight(layers: EditorLayer[]): number {
  return layers.reduce((sum, l) => sum + trackHeight(l), 0);
}

const thumbCache = new Map<string, HTMLCanvasElement[]>();

async function generateThumbnails(
  clipEl: HTMLElement,
  clip: Record<string, unknown>,
  clipId: string
) {
  const type = String((clip as any).type);
  if (type !== 'VIDEO' && type !== 'IMAGE') return;

  const strip = clipEl.querySelector('.tl-thumb-strip') as HTMLElement | null;
  if (!strip) return;

  const trackH = clipEl.offsetHeight;
  const thumbH = Math.max(8, Math.floor(trackH * 0.67));
  const aspectW = Math.round(thumbH * (16 / 9));
  const stripW  = Math.max(1, clipEl.offsetWidth);
  const count   = Math.max(1, Math.ceil(stripW / aspectW));

  const cacheKey = `${clipId}:${thumbH}:${count}`;
  if (thumbCache.has(cacheKey)) {
    strip.innerHTML = '';
    for (const c of thumbCache.get(cacheKey)!) {
      const clone = c.cloneNode(true) as HTMLCanvasElement;
      clone.style.cssText = `width:${aspectW}px;height:${thumbH}px;flex-shrink:0;display:block;`;
      strip.appendChild(clone);
    }
    return;
  }

  const source = (clip as any).source;
  const src: string =
    source?.src     ??
    source?.url     ??
    source?.objectURL ??
    source?.objectUrl ??
    (clip as any).src ??
    '';

  if (!src) return;

  const canvases: HTMLCanvasElement[] = [];
  strip.innerHTML = '';

  try {
    if (type === 'IMAGE') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('img load fail'));
      });
      for (let i = 0; i < count; i++) {
        const cv = document.createElement('canvas');
        cv.width = aspectW * devicePixelRatio;
        cv.height = thumbH * devicePixelRatio;
        cv.style.cssText = `width:${aspectW}px;height:${thumbH}px;flex-shrink:0;display:block;`;
        const ctx = cv.getContext('2d')!;
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        canvases.push(cv);
        strip.appendChild(cv);
      }
    } else {
      const vid = document.createElement('video');
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = 'metadata';
      vid.src = src;
      await new Promise<void>((res) => {
        vid.addEventListener('loadedmetadata', () => res(), { once: true });
        vid.addEventListener('error', () => res(), { once: true });
      });
      const dur = (clip as any).duration as number ?? vid.duration ?? 1;
      for (let i = 0; i < count; i++) {
        const t = i === 0 ? 0.05 : (i / count) * dur;
        vid.currentTime = t;
        await new Promise<void>((res) => {
          vid.addEventListener('seeked', () => res(), { once: true });
          vid.addEventListener('error',  () => res(), { once: true });
        });
        const cv = document.createElement('canvas');
        cv.width = aspectW * devicePixelRatio;
        cv.height = thumbH * devicePixelRatio;
        cv.style.cssText = `width:${aspectW}px;height:${thumbH}px;flex-shrink:0;display:block;`;
        const ctx = cv.getContext('2d')!;
        ctx.drawImage(vid, 0, 0, cv.width, cv.height);
        canvases.push(cv);
        strip.appendChild(cv);
      }
    }
    thumbCache.set(cacheKey, canvases);
  } catch {
    strip.innerHTML = '';
  }
}

function svgIcon(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${ms}`;
}

export function setupTimeline(controlsEl: HTMLElement, areaEl: HTMLElement, state: EditorState) {
  controlsEl.innerHTML = `
    <div class="tl-toolbar-left">
      <button class="tl-tool-btn" title="Split clip">
        ${svgIcon('<path d="M8 3l4 8 5-5 5 15H2L8 3z"/><line x1="4.14" y1="15.99" x2="19.86" y2="15.99"/>')}
      </button>
      <button class="tl-tool-btn" title="Group">
        ${svgIcon('<rect x="2" y="7" width="7" height="10" rx="1"/><rect x="9" y="7" width="7" height="10" rx="1"/><rect x="16" y="7" width="6" height="10" rx="1"/>')}
      </button>
      <button class="tl-tool-btn" title="Ungroup">
        ${svgIcon('<rect x="2" y="3" width="7" height="7" rx="1"/><rect x="15" y="3" width="7" height="7" rx="1"/><rect x="2" y="14" width="7" height="7" rx="1"/><rect x="15" y="14" width="7" height="7" rx="1"/>')}
      </button>
      <button class="tl-tool-btn" title="Cut / Trim">
        ${svgIcon('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>')}
      </button>
      <button class="tl-tool-btn" title="Duplicate">
        ${svgIcon('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>')}
      </button>
      <button class="tl-tool-btn" title="Delete selected" id="tl-delete-btn">
        ${svgIcon('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>')}
      </button>
      <button class="tl-tool-btn" title="Add marker">
        ${svgIcon('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>')}
      </button>
    </div>
    <div class="tl-toolbar-center">
      <div class="tl-scene-label">
        <span>Main scene</span>
        <button class="tl-tool-btn" title="Scene settings">
          ${svgIcon('<path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>')}
        </button>
      </div>
    </div>
    <div class="tl-toolbar-right">
      <button class="tl-tool-btn" title="Add layer" id="tl-add-layer-btn">
        ${svgIcon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>')}
      </button>
      <button class="tl-tool-btn" title="Snap to playhead">
        ${svgIcon('<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 7l-5-5-5 5"/>')}
      </button>
      <button class="tl-tool-btn" title="Link clips">
        ${svgIcon('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>')}
      </button>
      <div class="tl-ctrl-divider"></div>
      <button class="tl-zoom-btn" id="tl-zoom-out" title="Zoom out">
        ${svgIcon('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>')}
      </button>
      <input class="zoom-slider" id="zoom-slider" type="range" min="20" max="600" value="80" />
      <button class="tl-zoom-btn" id="tl-zoom-in" title="Zoom in">
        ${svgIcon('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>')}
      </button>
    </div>
  `;

  areaEl.innerHTML = `
    <div id="tl-headers">
      <div class="tl-corner"></div>
      <div id="tl-header-rows"></div>
    </div>
    <div id="tl-scroll">
      <div id="tl-inner">
        <div id="tl-ruler"><canvas id="tl-ruler-canvas"></canvas></div>
        <div id="tl-tracks"></div>
        <div id="tl-playhead"></div>
      </div>
    </div>
  `;

  const zoomSlider = controlsEl.querySelector('#zoom-slider') as HTMLInputElement;
  const zoomOutBtn = controlsEl.querySelector('#tl-zoom-out') as HTMLButtonElement;
  const zoomInBtn = controlsEl.querySelector('#tl-zoom-in') as HTMLButtonElement;
  const addLayerBtn = controlsEl.querySelector('#tl-add-layer-btn') as HTMLButtonElement;

  const tlHeaders = areaEl.querySelector('#tl-headers') as HTMLDivElement;
  const tlHeaderRows = areaEl.querySelector('#tl-header-rows') as HTMLDivElement;
  const tlScroll = areaEl.querySelector('#tl-scroll') as HTMLDivElement;
  const tlInner = areaEl.querySelector('#tl-inner') as HTMLDivElement;
  const tlRulerCanvas = areaEl.querySelector('#tl-ruler-canvas') as HTMLCanvasElement;
  const tlTracks = areaEl.querySelector('#tl-tracks') as HTMLDivElement;
  const tlPlayhead = areaEl.querySelector('#tl-playhead') as HTMLDivElement;

  let seeking = false;
  let playheadDragging = false;

  const EDGE_ZONE = 8;
  const GRID = 1 / 16;

  function snap(t: number): number {
    return Math.round(t / GRID) * GRID;
  }

  interface DragState {
    clipEl: HTMLElement;
    ghostEl: HTMLElement;
    clipId: string;
    layerId: string;
    originalDelay: number;
    originalDuration: number;
    startClientX: number;
    moved: boolean;
    mode: 'move' | 'resize-left' | 'resize-right';
    pendingDelay: number;
    pendingDuration: number;
  }
  let drag: DragState | null = null;

  function createGhost(clipEl: HTMLElement, trackEl: HTMLElement): HTMLElement {
    const ghost = document.createElement('div');
    ghost.className = 'tl-clip-ghost';
    ghost.style.left = clipEl.style.left;
    ghost.style.width = clipEl.style.width;
    ghost.style.backgroundColor = window.getComputedStyle(clipEl).backgroundColor;
    trackEl.appendChild(ghost);
    return ghost;
  }

  document.addEventListener('mousemove', (e) => {
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientX - drag.startClientX) > 3) {
      drag.moved = true;
      document.body.style.cursor = drag.mode === 'move' ? 'grabbing' : 'ew-resize';
      drag.clipEl.style.opacity = '0.35';
    }
    if (!drag.moved) return;

    const deltaSeconds = (e.clientX - drag.startClientX) / state.zoom;

    if (drag.mode === 'move') {
      const newDelay = snap(Math.max(0, drag.originalDelay + deltaSeconds));
      drag.pendingDelay = newDelay;
      drag.ghostEl.style.left = `${newDelay * state.zoom}px`;
    } else if (drag.mode === 'resize-right') {
      const newDuration = snap(Math.max(GRID, drag.originalDuration + deltaSeconds));
      drag.pendingDuration = newDuration;
      drag.ghostEl.style.width = `${Math.max(newDuration * state.zoom, 4)}px`;
    } else if (drag.mode === 'resize-left') {
      const maxDelta = drag.originalDelay;
      const clampedDelta = Math.max(-maxDelta, deltaSeconds);
      const newDelay = snap(Math.max(0, drag.originalDelay + clampedDelta));
      const newDuration = snap(Math.max(GRID, drag.originalDuration - (newDelay - drag.originalDelay)));
      drag.pendingDelay = newDelay;
      drag.pendingDuration = newDuration;
      drag.ghostEl.style.left = `${newDelay * state.zoom}px`;
      drag.ghostEl.style.width = `${Math.max(newDuration * state.zoom, 4)}px`;
    }
  });

  document.addEventListener('mouseup', async () => {
    playheadDragging = false;
    if (!drag) return;
    const moved = drag.moved;
    const { clipId, layerId, pendingDelay, pendingDuration } = drag;

    drag.ghostEl.remove();
    drag.clipEl.style.opacity = '';
    document.body.style.cursor = '';
    drag = null;

    if (moved) {
      const editorLayer = state.editorLayers.find(l => l.id === layerId);
      const editorClip = editorLayer?.clips.find(c => c.id === clipId);
      if (editorClip) {
        const raw = editorClip.clip as unknown as Record<string, unknown>;
        raw['delay'] = pendingDelay;
        raw['duration'] = pendingDuration;
      }
      state.emit('timeline:change');
      await state.composition.seek(state.composition.currentTime);
    }
  });

  document.addEventListener('click', (e) => {
    if (drag?.moved) {
      e.stopPropagation();
    }
  }, true);

  function getContentWidth(): number {
    const duration = Math.max(state.composition.duration, 10);
    const natural = duration * state.zoom + 100;
    return Math.max(natural, tlScroll.clientWidth || 0);
  }

  function drawRuler() {
    const width = getContentWidth();
    tlRulerCanvas.width = width * devicePixelRatio;
    tlRulerCanvas.height = 22 * devicePixelRatio;
    tlRulerCanvas.style.width = `${width}px`;
    tlRulerCanvas.style.height = '22px';
    const ctx = tlRulerCanvas.getContext('2d')!;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const step = computeStep();
    ctx.fillStyle = '#55556a';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'top';

    for (let t = 0; t <= Math.ceil(getContentWidth() / state.zoom) + step; t += step) {
      const x = t * state.zoom;
      const isMajor = Math.round(t * 10) % Math.round(step * 10 * 2) === 0;
      ctx.fillStyle = isMajor ? '#55556a' : '#33333d';
      ctx.fillRect(x, isMajor ? 14 : 20, 1, isMajor ? 14 : 8);
      if (isMajor) {
        ctx.fillStyle = '#8e8e9e';
        ctx.fillText(formatTime(t), x + 3, 4);
      }
    }
  }

  function computeStep(): number {
    const minPixels = 50;
    const steps = [1 / 16, 0.25, 0.5, 1, 2, 5, 10, 30, 60];
    for (const s of steps) {
      if (s * state.zoom >= minPixels) return s;
    }
    return 60;
  }

  function renderHeaders() {
    tlHeaderRows.innerHTML = state.editorLayers.map(l => {
      const h = trackHeight(l);
      const lt = layerType(l);
      return `
      <div class="tl-header-row tl-header-row--${lt}${l.id === state.selectedLayerId ? ' selected' : ''}"
           data-layer-id="${l.id}" style="height:${h}px">
        <button class="tl-track-icon-btn" title="Mute" data-layer-id="${l.id}">
          ${svgIcon('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>')}
        </button>
        <button class="tl-track-icon-btn tl-header-vis${!l.visible ? ' layer-hidden' : ''}" data-layer-id="${l.id}" title="${l.visible ? 'Hide' : 'Show'}">
          ${l.visible
            ? svgIcon('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>')
            : svgIcon('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/>')}
        </button>
        <button class="tl-track-icon-btn" title="Track type">
          ${svgIcon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 2l4 5-4 5V2z"/>')}
        </button>
      </div>
    `}).join('');

    tlHeaderRows.querySelectorAll('.tl-header-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        state.selectLayer((row as HTMLElement).dataset.layerId!);
      });
    });

    tlHeaderRows.querySelectorAll('.tl-header-vis').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.toggleLayerVisibility((btn as HTMLElement).dataset.layerId!);
      });
    });
  }

  function renderTracks() {
    const width = getContentWidth();
    tlInner.style.width = `${width}px`;

    tlTracks.innerHTML = state.editorLayers.map(l => {
      const h = trackHeight(l);
      const lt = layerType(l);
      const clips = l.clips.map(ec => {
        const s = ec.clip.delay;
        const d = ec.clip.duration;
        const left = s * state.zoom;
        const w = Math.max(d * state.zoom, 4);
        const t = String(ec.clip.type);
        const hasThumb = t === 'VIDEO' || t === 'IMAGE';
        const thumbStrip = hasThumb
          ? `<div class="tl-thumb-strip" data-clip-id-thumb="${ec.id}"></div>`
          : '';
        return `<div class="tl-clip clip-type-${t}${ec.id === state.selectedClipId ? ' selected' : ''}"
          style="left:${left}px;width:${w}px;opacity:${l.visible ? 1 : 0.3}"
          data-clip-id="${ec.id}" data-layer-id="${l.id}">
          ${thumbStrip}
          <div class="tl-clip-footer"><span class="tl-clip-label">${ec.name}</span></div>
        </div>`;
      }).join('');
      return `<div class="tl-track tl-track--${lt}" data-layer-id="${l.id}" style="height:${h}px">${clips}</div>`;
    }).join('');

    tlTracks.querySelectorAll('.tl-clip').forEach(clip => {
      const clipEl = clip as HTMLElement;

      clipEl.addEventListener('mousemove', (e) => {
        if (drag) return;
        const rect = clipEl.getBoundingClientRect();
        const distFromLeft = e.clientX - rect.left;
        const distFromRight = rect.right - e.clientX;
        if (distFromRight <= EDGE_ZONE || distFromLeft <= EDGE_ZONE) {
          clipEl.style.cursor = 'ew-resize';
        } else {
          clipEl.style.cursor = '';
        }
      });

      clipEl.addEventListener('mouseleave', () => {
        if (!drag) clipEl.style.cursor = '';
      });

      clipEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const rect = clipEl.getBoundingClientRect();
        const distFromLeft = e.clientX - rect.left;
        const distFromRight = rect.right - e.clientX;
        let mode: 'move' | 'resize-left' | 'resize-right' = 'move';
        if (distFromRight <= EDGE_ZONE) mode = 'resize-right';
        else if (distFromLeft <= EDGE_ZONE) mode = 'resize-left';

        const id = clipEl.dataset.clipId!;
        const lid = clipEl.dataset.layerId!;
        const editorLayer = state.editorLayers.find(l => l.id === lid);
        const editorClip = editorLayer?.clips.find(c => c.id === id);
        if (!editorClip) return;
        state.selectClip(id);
        state.selectLayer(lid);
        const trackEl = clipEl.closest('.tl-track') as HTMLElement;
        const ghost = createGhost(clipEl, trackEl);
        drag = {
          clipEl,
          ghostEl: ghost,
          clipId: id,
          layerId: lid,
          originalDelay: editorClip.clip.delay,
          originalDuration: editorClip.clip.duration,
          startClientX: e.clientX,
          moved: false,
          mode,
          pendingDelay: editorClip.clip.delay,
          pendingDuration: editorClip.clip.duration,
        };
        e.preventDefault();
        e.stopPropagation();
      });

      clipEl.addEventListener('click', (e) => {
        if (drag?.moved) return;
        e.stopPropagation();
      });
    });

    tlTracks.querySelectorAll('.tl-track').forEach(track => {
      track.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('tl-clip')) return;
        if ((e.target as HTMLElement).classList.contains('tl-clip-label')) return;
        state.selectClip(null);
      });
    });

    requestAnimationFrame(() => {
      tlTracks.querySelectorAll<HTMLElement>('.tl-clip').forEach(clipEl => {
        const clipId = clipEl.dataset.clipId;
        if (!clipId) return;
        for (const l of state.editorLayers) {
          const ec = l.clips.find(c => c.id === clipId);
          if (ec) {
            generateThumbnails(
              clipEl,
              ec.clip as unknown as Record<string, unknown>,
              clipId
            );
            break;
          }
        }
      });
    });
  }

  function updatePlayhead() {
    const x = state.composition.currentTime * state.zoom;
    tlPlayhead.style.left = `${x}px`;
    tlPlayhead.style.height = `${22 + totalTracksHeight(state.editorLayers)}px`;
  }

  function fullRender() {
    renderHeaders();
    renderTracks();
    drawRuler();
    updatePlayhead();
    syncHeaderScroll();
  }

  function syncHeaderScroll() {
    const scrollTop = tlScroll.scrollTop;
    tlHeaderRows.style.transform = `translateY(-${scrollTop}px)`;
    tlHeaderRows.style.height = `${totalTracksHeight(state.editorLayers)}px`;
  }

  tlScroll.addEventListener('scroll', () => {
    syncHeaderScroll();
    drawRuler();
  });

  tlRulerCanvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    playheadDragging = true;
    const rect = tlScroll.getBoundingClientRect();
    const x = e.clientX - rect.left + tlScroll.scrollLeft;
    const t = snap(Math.max(0, Math.min(x / state.zoom, state.composition.duration)));
    state.composition.seek(t);
  });

  tlScroll.addEventListener('mousemove', async (e) => {
    if (!(e.buttons & 1)) return;
    if (!playheadDragging) return;
    if (seeking) return;
    seeking = true;
    const rect = tlScroll.getBoundingClientRect();
    const x = e.clientX - rect.left + tlScroll.scrollLeft;
    const t = snap(Math.max(0, Math.min(x / state.zoom, state.composition.duration)));
    await state.composition.seek(t);
    seeking = false;
  });

  state.composition.on('playback:time', () => {
    updatePlayhead();
    const playheadX = state.composition.currentTime * state.zoom;
    const scrollLeft = tlScroll.scrollLeft;
    const visWidth = tlScroll.clientWidth;
    if (playheadX > scrollLeft + visWidth - 40) {
      tlScroll.scrollLeft = playheadX - 40;
    }
  });

  zoomSlider.addEventListener('input', () => {
    state.setZoom(parseInt(zoomSlider.value));
  });

  zoomOutBtn.addEventListener('click', () => {
    const newZoom = Math.max(20, state.zoom - 20);
    state.setZoom(newZoom);
    zoomSlider.value = String(newZoom);
  });

  zoomInBtn.addEventListener('click', () => {
    const newZoom = Math.min(600, state.zoom + 20);
    state.setZoom(newZoom);
    zoomSlider.value = String(newZoom);
  });

  addLayerBtn.addEventListener('click', async () => {
    await state.addLayer();
  });

  tlHeaders.style.flexShrink = '0';

  const scrollResizeObserver = new ResizeObserver(() => {
    drawRuler();
    renderTracks();
  });
  scrollResizeObserver.observe(tlScroll);

  state.on('layers:change', fullRender);
  state.on('timeline:change', fullRender);
  state.on('selection:change', () => { renderHeaders(); renderTracks(); });
  state.on('zoom:change', () => {
    zoomSlider.value = String(state.zoom);
    fullRender();
  });

  fullRender();
}
