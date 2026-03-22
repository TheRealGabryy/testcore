import type { EditorState } from './state';

function svgIcon(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

function resolveToPixels(v: unknown, dimension: number): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v && typeof v === 'object') {
    const rec = v as Record<string, unknown>;
    if (typeof rec['value'] === 'number') return rec['value'] / 100 * dimension;
  }
  return null;
}

interface DragState {
  mode: 'move' | 'resize-nw' | 'resize-n' | 'resize-ne' | 'resize-e' | 'resize-se' | 'resize-s' | 'resize-sw' | 'resize-w';
  startMouseX: number;
  startMouseY: number;
  startClipX: number;
  startClipY: number;
  startClipW: number;
  startClipH: number;
  anchorX: number;
  anchorY: number;
}

export function setupPreview(playbackEl: HTMLElement, state: EditorState) {
  const playerContainer = document.querySelector('#player-container') as HTMLDivElement;
  const player = document.querySelector('#player') as HTMLDivElement;

  state.composition.mount(player);

  const overlay = document.createElement('div');
  overlay.id = 'canvas-overlay';
  player.appendChild(overlay);

  let currentScale = 1;
  let dragState: DragState | null = null;

  playbackEl.innerHTML = `
    <span id="time-display">00:00 / 00:00</span>
    <div class="playback-spacer"></div>
    <div class="playback-btns">
      <button class="playback-btn" id="pb-back" title="Go to start">
        ${svgIcon('<polygon points="19 20 9 12 19 4"/><line x1="5" y1="4" x2="5" y2="20"/>')}
      </button>
      <button class="playback-btn play-pause" id="pb-play" title="Play">
        ${svgIcon('<polygon points="5 3 19 12 5 21"/>')}
      </button>
      <button class="playback-btn" id="pb-forward" title="Go to end">
        ${svgIcon('<polygon points="5 4 15 12 5 20"/><line x1="19" y1="4" x2="19" y2="20"/>')}
      </button>
    </div>
    <div class="playback-spacer"></div>
    <div class="playback-right">
      <button class="playback-btn fps-badge" id="fps-btn" title="Change FPS">30 fps</button>
      <button class="playback-btn" id="pb-fullscreen" title="Fullscreen">
        ${svgIcon('<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>')}
      </button>
    </div>
  `;

  const pbPlay = playbackEl.querySelector('#pb-play') as HTMLButtonElement;
  const pbBack = playbackEl.querySelector('#pb-back') as HTMLButtonElement;
  const pbForward = playbackEl.querySelector('#pb-forward') as HTMLButtonElement;
  const timeDisplay = playbackEl.querySelector('#time-display') as HTMLSpanElement;
  const fpsBadge = playbackEl.querySelector('#fps-btn') as HTMLButtonElement;

  const playIcon = svgIcon('<polygon points="5 3 19 12 5 21"/>');
  const pauseIcon = svgIcon('<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>');

  function setPlaying(playing: boolean) {
    pbPlay.innerHTML = playing ? pauseIcon : playIcon;
    pbPlay.title = playing ? 'Pause' : 'Play';
  }

  pbPlay.addEventListener('click', () => {
    if (state.composition.playing) {
      state.composition.pause();
    } else {
      state.composition.play();
    }
  });

  pbBack.addEventListener('click', () => state.composition.seek(0));
  pbForward.addEventListener('click', () => state.composition.seek(state.composition.duration));

  fpsBadge.addEventListener('click', () => {
    const val = parseFloat(
      prompt('Enter desired frame rate (fps):', String(state.fps)) ?? String(state.fps)
    );
    if (!Number.isNaN(val) && val > 0) {
      state.fps = val;
      fpsBadge.textContent = `${val} fps`;
    }
  });

  state.composition.on('playback:start', () => setPlaying(true));
  state.composition.on('playback:end', () => setPlaying(false));
  state.composition.on('playback:time', () => {
    timeDisplay.textContent = state.composition.time();
  });

  const handleResize = () => {
    currentScale = Math.min(
      playerContainer.clientWidth / state.composition.width,
      playerContainer.clientHeight / state.composition.height
    );
    player.style.width = `${state.composition.width}px`;
    player.style.height = `${state.composition.height}px`;
    player.style.transform = `scale(${currentScale})`;
  };

  const ro = new ResizeObserver(handleResize);
  ro.observe(playerContainer);
  state.composition.on('resize', handleResize);

  timeDisplay.textContent = state.composition.time();
  state.composition.seek(0);
  setTimeout(handleResize, 50);

  function toCompCoords(clientX: number, clientY: number): { x: number; y: number } {
    const rect = overlay.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / currentScale,
      y: (clientY - rect.top) / currentScale,
    };
  }

  function getClipBounds(raw: Record<string, unknown>): { x: number; y: number; w: number; h: number; ax: number; ay: number } | null {
    const compW = state.composition.width;
    const compH = state.composition.height;

    const x = resolveToPixels(raw['x'], compW);
    const y = resolveToPixels(raw['y'], compH);
    const w = resolveToPixels(raw['width'], compW);
    const h = resolveToPixels(raw['height'], compH);

    if (x === null || y === null || w === null || h === null) return null;

    const ax = typeof raw['anchorX'] === 'number' ? raw['anchorX'] : 0.5;
    const ay = typeof raw['anchorY'] === 'number' ? raw['anchorY'] : 0.5;

    return { x, y, w, h, ax, ay };
  }

  const VISUAL_TYPES = new Set(['VIDEO', 'IMAGE', 'TEXT', 'RECT', 'ELLIPSE', 'POLYGON']);

  function renderOverlay() {
    overlay.innerHTML = '';
    overlay.style.pointerEvents = 'none';

    const sel = state.getSelectedClip();
    if (!sel) return;

    const clip = sel.editorClip.clip;
    if (!VISUAL_TYPES.has(String(clip.type))) return;

    const raw = clip as unknown as Record<string, unknown>;
    const bounds = getClipBounds(raw);
    if (!bounds) return;

    const { x, y, w, h, ax, ay } = bounds;
    const left = x - w * ax;
    const top = y - h * ay;

    overlay.style.pointerEvents = 'auto';

    const box = document.createElement('div');
    box.className = 'selection-box';
    box.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px;`;

    const handles: Array<{ dir: string; label: string }> = [
      { dir: 'nw', label: 'nw' },
      { dir: 'n', label: 'n' },
      { dir: 'ne', label: 'ne' },
      { dir: 'e', label: 'e' },
      { dir: 'se', label: 'se' },
      { dir: 's', label: 's' },
      { dir: 'sw', label: 'sw' },
      { dir: 'w', label: 'w' },
    ];

    handles.forEach(({ dir }) => {
      const handle = document.createElement('div');
      handle.className = `resize-handle resize-handle-${dir}`;
      handle.dataset.dir = dir;
      box.appendChild(handle);

      handle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const { x: mx, y: my } = toCompCoords(e.clientX, e.clientY);
        dragState = {
          mode: `resize-${dir}` as DragState['mode'],
          startMouseX: mx,
          startMouseY: my,
          startClipX: x,
          startClipY: y,
          startClipW: w,
          startClipH: h,
          anchorX: ax,
          anchorY: ay,
        };
        handle.setPointerCapture(e.pointerId);

        const onMove = (ev: PointerEvent) => handleDrag(ev, raw);
        const onUp = () => {
          dragState = null;
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
          state.emit('props:change');
          renderOverlay();
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
      });
    });

    box.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).classList.contains('resize-handle') ||
          (e.target as HTMLElement).classList.contains('resize-handle-n') ||
          (e.target as HTMLElement).classList.contains('resize-handle-s') ||
          (e.target as HTMLElement).classList.contains('resize-handle-e') ||
          (e.target as HTMLElement).classList.contains('resize-handle-w')) return;

      e.preventDefault();
      const { x: mx, y: my } = toCompCoords(e.clientX, e.clientY);
      dragState = {
        mode: 'move',
        startMouseX: mx,
        startMouseY: my,
        startClipX: x,
        startClipY: y,
        startClipW: w,
        startClipH: h,
        anchorX: ax,
        anchorY: ay,
      };
      box.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => handleDrag(ev, raw);
      const onUp = () => {
        dragState = null;
        box.removeEventListener('pointermove', onMove);
        box.removeEventListener('pointerup', onUp);
        state.emit('props:change');
        renderOverlay();
      };
      box.addEventListener('pointermove', onMove);
      box.addEventListener('pointerup', onUp);
    });

    overlay.appendChild(box);
  }

  function applySize(raw: Record<string, unknown>, w?: number, h?: number) {
    if (w !== undefined && h !== undefined) {
      raw['keepAspectRatio'] = false;
      raw['width'] = w;
      raw['height'] = h;
    } else if (w !== undefined) {
      raw['width'] = w;
    } else if (h !== undefined) {
      raw['height'] = h;
    }
  }

  function handleDrag(e: PointerEvent, raw: Record<string, unknown>) {
    if (!dragState) return;

    const { x: mx, y: my } = toCompCoords(e.clientX, e.clientY);
    const dx = mx - dragState.startMouseX;
    const dy = my - dragState.startMouseY;
    const { startClipX: sx, startClipY: sy, startClipW: sw, startClipH: sh, anchorX: ax, anchorY: ay } = dragState;

    const box = overlay.querySelector('.selection-box') as HTMLElement;
    if (!box) return;

    const MIN_SIZE = 10;

    switch (dragState.mode) {
      case 'move': {
        const nx = sx + dx;
        const ny = sy + dy;
        raw['x'] = nx;
        raw['y'] = ny;
        box.style.left = `${nx - sw * ax}px`;
        box.style.top = `${ny - sh * ay}px`;
        break;
      }
      case 'resize-se': {
        const nw = Math.max(MIN_SIZE, sw + dx);
        const nh = Math.max(MIN_SIZE, sh + dy);
        applySize(raw, nw, nh);
        box.style.width = `${nw}px`;
        box.style.height = `${nh}px`;
        break;
      }
      case 'resize-sw': {
        const nw = Math.max(MIN_SIZE, sw - dx);
        const nh = Math.max(MIN_SIZE, sh + dy);
        const nx = sx + sw * ax - nw * ax;
        applySize(raw, nw, nh);
        raw['x'] = nx;
        box.style.width = `${nw}px`;
        box.style.height = `${nh}px`;
        box.style.left = `${nx - nw * ax}px`;
        break;
      }
      case 'resize-ne': {
        const nw = Math.max(MIN_SIZE, sw + dx);
        const nh = Math.max(MIN_SIZE, sh - dy);
        const ny = sy + sh * ay - nh * ay;
        applySize(raw, nw, nh);
        raw['y'] = ny;
        box.style.width = `${nw}px`;
        box.style.height = `${nh}px`;
        box.style.top = `${ny - nh * ay}px`;
        break;
      }
      case 'resize-nw': {
        const nw = Math.max(MIN_SIZE, sw - dx);
        const nh = Math.max(MIN_SIZE, sh - dy);
        const nx = sx + sw * ax - nw * ax;
        const ny = sy + sh * ay - nh * ay;
        applySize(raw, nw, nh);
        raw['x'] = nx;
        raw['y'] = ny;
        box.style.width = `${nw}px`;
        box.style.height = `${nh}px`;
        box.style.left = `${nx - nw * ax}px`;
        box.style.top = `${ny - nh * ay}px`;
        break;
      }
      case 'resize-n': {
        const nh = Math.max(MIN_SIZE, sh - dy);
        const ny = sy + sh * ay - nh * ay;
        applySize(raw, undefined, nh);
        raw['y'] = ny;
        box.style.height = `${nh}px`;
        box.style.top = `${ny - nh * ay}px`;
        break;
      }
      case 'resize-s': {
        const nh = Math.max(MIN_SIZE, sh + dy);
        applySize(raw, undefined, nh);
        box.style.height = `${nh}px`;
        break;
      }
      case 'resize-e': {
        const nw = Math.max(MIN_SIZE, sw + dx);
        applySize(raw, nw, undefined);
        box.style.width = `${nw}px`;
        break;
      }
      case 'resize-w': {
        const nw = Math.max(MIN_SIZE, sw - dx);
        const nx = sx + sw * ax - nw * ax;
        applySize(raw, nw, undefined);
        raw['x'] = nx;
        box.style.width = `${nw}px`;
        box.style.left = `${nx - nw * ax}px`;
        break;
      }
    }

    state.composition.update();
  }

  state.on('selection:change', renderOverlay);
  state.on('layers:change', renderOverlay);

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
    e.preventDefault();
    if (state.composition.playing) {
      state.composition.pause();
    } else {
      state.composition.play();
    }
  });
}
