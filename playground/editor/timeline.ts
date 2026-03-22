import type { EditorState } from './state';

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
    <button class="tl-ctrl-btn" id="tl-add-layer-btn">
      ${svgIcon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>')}
      Add Layer
    </button>
    <div class="tl-ctrl-divider"></div>
    <div class="tl-zoom-group">
      ${svgIcon('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>')}
      <input class="zoom-slider" id="zoom-slider" type="range" min="20" max="600" value="80" />
      ${svgIcon('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>')}
      <span class="zoom-label" id="zoom-label">80 px/s</span>
    </div>
  `;

  areaEl.innerHTML = `
    <div id="tl-headers">
      <div class="tl-corner"><span class="tl-corner-label">Tracks</span></div>
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
  const zoomLabel = controlsEl.querySelector('#zoom-label') as HTMLSpanElement;
  const addLayerBtn = controlsEl.querySelector('#tl-add-layer-btn') as HTMLButtonElement;

  const tlHeaders = areaEl.querySelector('#tl-headers') as HTMLDivElement;
  const tlHeaderRows = areaEl.querySelector('#tl-header-rows') as HTMLDivElement;
  const tlScroll = areaEl.querySelector('#tl-scroll') as HTMLDivElement;
  const tlInner = areaEl.querySelector('#tl-inner') as HTMLDivElement;
  const tlRulerCanvas = areaEl.querySelector('#tl-ruler-canvas') as HTMLCanvasElement;
  const tlTracks = areaEl.querySelector('#tl-tracks') as HTMLDivElement;
  const tlPlayhead = areaEl.querySelector('#tl-playhead') as HTMLDivElement;

  let seeking = false;

  function getContentWidth(): number {
    const duration = Math.max(state.composition.duration, 10);
    return duration * state.zoom + 100;
  }

  function drawRuler() {
    const width = getContentWidth();
    tlRulerCanvas.width = width * devicePixelRatio;
    tlRulerCanvas.height = 28 * devicePixelRatio;
    tlRulerCanvas.style.width = `${width}px`;
    tlRulerCanvas.style.height = '28px';
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
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60];
    for (const s of steps) {
      if (s * state.zoom >= minPixels) return s;
    }
    return 60;
  }

  function renderHeaders() {
    tlHeaderRows.innerHTML = state.editorLayers.map(l => `
      <div class="tl-header-row${l.id === state.selectedLayerId ? ' selected' : ''}" data-layer-id="${l.id}">
        <div class="tl-header-color" style="background:${l.color}"></div>
        <span class="tl-header-name">${l.name}</span>
        <button class="tl-header-vis${!l.visible ? ' layer-hidden' : ''}" data-layer-id="${l.id}">
          ${l.visible
            ? svgIcon('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>')
            : svgIcon('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/>')}
        </button>
      </div>
    `).join('');

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
      const clips = l.clips.map(ec => {
        const s = ec.clip.delay;
        const d = ec.clip.duration;
        const left = s * state.zoom;
        const w = Math.max(d * state.zoom, 4);
        return `<div class="tl-clip clip-type-${ec.clip.type}${ec.id === state.selectedClipId ? ' selected' : ''}"
          style="left:${left}px;width:${w}px;opacity:${l.visible ? 1 : 0.3}"
          data-clip-id="${ec.id}" data-layer-id="${l.id}">
          <span class="tl-clip-label">${ec.name}</span>
        </div>`;
      }).join('');
      return `<div class="tl-track" data-layer-id="${l.id}">${clips}</div>`;
    }).join('');

    tlTracks.querySelectorAll('.tl-clip').forEach(clip => {
      clip.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (clip as HTMLElement).dataset.clipId!;
        const lid = (clip as HTMLElement).dataset.layerId!;
        state.selectClip(id);
        state.selectLayer(lid);
      });
    });

    tlTracks.querySelectorAll('.tl-track').forEach(track => {
      track.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('tl-clip')) return;
        if ((e.target as HTMLElement).classList.contains('tl-clip-label')) return;
        state.selectClip(null);
      });
    });
  }

  function updatePlayhead() {
    const x = state.composition.currentTime * state.zoom;
    tlPlayhead.style.left = `${x}px`;
    tlPlayhead.style.height = `${28 + state.editorLayers.length * 40}px`;
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
    tlHeaderRows.style.height = `${state.editorLayers.length * 40}px`;
  }

  tlScroll.addEventListener('scroll', () => {
    syncHeaderScroll();
    drawRuler();
  });

  tlScroll.addEventListener('click', (e) => {
    const rect = tlScroll.getBoundingClientRect();
    const x = e.clientX - rect.left + tlScroll.scrollLeft;
    const t = x / state.zoom;
    if (t >= 0) state.composition.seek(Math.min(t, state.composition.duration));
  });

  tlScroll.addEventListener('mousemove', async (e) => {
    if (!(e.buttons & 1)) return;
    if (seeking) return;
    seeking = true;
    const rect = tlScroll.getBoundingClientRect();
    const x = e.clientX - rect.left + tlScroll.scrollLeft;
    const t = Math.max(0, Math.min(x / state.zoom, state.composition.duration));
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
    zoomLabel.textContent = `${state.zoom} px/s`;
  });

  addLayerBtn.addEventListener('click', async () => {
    await state.addLayer();
  });

  tlHeaders.style.flexShrink = '0';

  state.on('layers:change', fullRender);
  state.on('timeline:change', fullRender);
  state.on('selection:change', () => { renderHeaders(); renderTracks(); });
  state.on('zoom:change', () => {
    zoomSlider.value = String(state.zoom);
    zoomLabel.textContent = `${state.zoom} px/s`;
    fullRender();
  });

  fullRender();
}
