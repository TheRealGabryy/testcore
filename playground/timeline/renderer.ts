import type { TimelineState, TLTrack } from './state';
import type { TimelineView } from './view';
import { timeToX, durationToWidth, formatTimecode, getRulerStep } from './timeMapping';

function svgStr(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

export class TimelineRenderer {
  private headerRowsEl!: HTMLElement;
  private rulerCanvas!: HTMLCanvasElement;
  private tracksBodyEl!: HTMLElement;
  private playheadLineEl!: HTMLElement;
  private playheadRulerEl!: HTMLElement;
  private contentEl!: HTMLElement;
  private timecodeEl!: HTMLElement;
  private selectedClipId: string | null = null;
  private innerEl!: HTMLElement;
  private container: HTMLElement;
  private state: TimelineState;
  private view: TimelineView;

  constructor(
    container: HTMLElement,
    state: TimelineState,
    view: TimelineView,
  ) {
    this.container = container;
    this.state = state;
    this.view = view;
  }

  private resizeObserver: ResizeObserver | null = null;
  private onResize: (() => void) | null = null;

  setResizeCallback(fn: () => void): void {
    this.onResize = fn;
  }

  mount(): void {
    this.container.innerHTML = `
      <div id="tl-panel">
        <div id="tl-toolbar">
          <span id="tl-timecode">00:00:00</span>
          <div id="tl-tb-sep"></div>
          <button class="tl-tb-btn" id="tl-btn-start" title="Go to start">
            ${svgStr('<polygon points="19 20 9 12 19 4"/><line x1="5" y1="4" x2="5" y2="20"/>')}
          </button>
          <button class="tl-tb-btn tl-btn-play" id="tl-btn-play" title="Play/Pause">
            ${svgStr('<polygon points="5 3 19 12 5 21"/>')}
          </button>
          <button class="tl-tb-btn" id="tl-btn-end" title="Go to end">
            ${svgStr('<polygon points="5 4 15 12 5 20"/><line x1="19" y1="4" x2="19" y2="20"/>')}
          </button>
          <div id="tl-tb-sep2"></div>
          <span class="tl-tb-label">Zoom:</span>
          <input id="tl-zoom-range" type="range" min="10" max="600" step="5" value="80" />
          <span id="tl-zoom-val">80px/s</span>
          <div id="tl-tb-sep3"></div>
          <span id="tl-duration-label">00:00:00</span>
        </div>
        <div id="tl-body">
          <div id="tl-header-col">
            <div id="tl-ruler-corner"></div>
            <div id="tl-header-rows"></div>
          </div>
          <div id="tl-content">
            <div id="tl-ruler-row">
              <canvas id="tl-ruler-canvas"></canvas>
              <div id="tl-ph-ruler"></div>
            </div>
            <div id="tl-inner">
              <div id="tl-tracks-body"></div>
              <div id="tl-ph-line"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.headerRowsEl = this.container.querySelector('#tl-header-rows')!;
    this.rulerCanvas = this.container.querySelector('#tl-ruler-canvas')!;
    this.tracksBodyEl = this.container.querySelector('#tl-tracks-body')!;
    this.playheadLineEl = this.container.querySelector('#tl-ph-line')!;
    this.playheadRulerEl = this.container.querySelector('#tl-ph-ruler')!;
    this.contentEl = this.container.querySelector('#tl-content')!;
    this.timecodeEl = this.container.querySelector('#tl-timecode')!;
    this.innerEl = this.container.querySelector('#tl-inner')!;

    // Sync vertical scroll between headers and tracks
    this.contentEl.addEventListener('scroll', () => {
      const scrollTop = this.contentEl.scrollTop;
      this.headerRowsEl.style.transform = `translateY(-${scrollTop}px)`;
    });

    // Re-render when container resizes (catches initial layout and window resize)
    this.resizeObserver = new ResizeObserver(() => {
      this.drawRuler();
      this.renderTracks();
      this.updatePlayhead();
      this.onResize?.();
    });
    this.resizeObserver.observe(this.contentEl);
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
  }

  getTracksEl(): HTMLElement { return this.tracksBodyEl; }
  getRulerEl(): HTMLElement { return this.container.querySelector('#tl-ruler-row')!; }
  getContentEl(): HTMLElement { return this.contentEl; }
  getPlayBtn(): HTMLButtonElement { return this.container.querySelector('#tl-btn-play')!; }
  getStartBtn(): HTMLButtonElement { return this.container.querySelector('#tl-btn-start')!; }
  getEndBtn(): HTMLButtonElement { return this.container.querySelector('#tl-btn-end')!; }
  getZoomRange(): HTMLInputElement { return this.container.querySelector('#tl-zoom-range')!; }
  getZoomLabel(): HTMLSpanElement { return this.container.querySelector('#tl-zoom-val')!; }

  setSelectedClip(id: string | null): void {
    this.selectedClipId = id;
    this.tracksBodyEl.querySelectorAll('.tl-clip').forEach(el => {
      const clipEl = el as HTMLElement;
      clipEl.classList.toggle('selected', clipEl.dataset.clipId === id);
    });
  }

  renderAll(): void {
    this.renderHeaders();
    this.renderTracks();
    this.drawRuler();
    this.updatePlayhead();
    this.updateTimecode();
    this.updateDuration();
  }

  private renderHeaders(): void {
    const videoTracks = this.state.tracks.filter(t => t.type === 'video').reverse();
    const audioTracks = this.state.tracks.filter(t => t.type === 'audio');
    const orderedTracks = [...videoTracks, ...audioTracks];

    this.headerRowsEl.innerHTML = orderedTracks.map(track => `
      <div class="tl-track-header tl-track-header-${track.type}" data-track-id="${track.id}">
        <span class="tl-track-label">${track.label}</span>
        <div class="tl-track-controls">
          <button class="tl-track-btn tl-lock-btn${track.locked ? ' active' : ''}" data-track-id="${track.id}" title="Lock">
            ${track.locked
              ? svgStr('<rect x="3" y="11" width="18" height="11" rx="0"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>')
              : svgStr('<rect x="3" y="11" width="18" height="11" rx="0"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>')}
          </button>
          <button class="tl-track-btn tl-mute-btn${track.muted ? ' active' : ''}" data-track-id="${track.id}" title="${track.type === 'video' ? 'Toggle visibility' : 'Mute'}">
            ${track.type === 'video'
              ? svgStr('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>')
              : svgStr('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>')}
          </button>
        </div>
      </div>
    `).join('');

    this.headerRowsEl.querySelectorAll('.tl-lock-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.trackId!;
        const track = this.state.tracks.find(t => t.id === id);
        if (track) { track.locked = !track.locked; this.renderHeaders(); }
      });
    });

    this.headerRowsEl.querySelectorAll('.tl-mute-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.trackId!;
        const track = this.state.tracks.find(t => t.id === id);
        if (track) { track.muted = !track.muted; this.renderHeaders(); }
      });
    });
  }

  renderTracks(): void {
    const videoTracks = this.state.tracks.filter(t => t.type === 'video').reverse();
    const audioTracks = this.state.tracks.filter(t => t.type === 'audio');
    const orderedTracks = [...videoTracks, ...audioTracks];

    // Compute total content width from live clip positions — never use clientWidth
    // which may be 0 during initial layout
    let maxEnd = Math.max(this.state.duration, 10);
    for (const track of orderedTracks) {
      for (const clip of track.clips) {
        const liveDur = clip.clipRef.duration > 0 ? clip.clipRef.duration : clip.duration;
        maxEnd = Math.max(maxEnd, clip.start + liveDur);
      }
    }
    const totalWidth = Math.max(timeToX(maxEnd, this.view.zoom) + 300, 600);
    this.innerEl.style.width = `${totalWidth}px`;

    const rows = orderedTracks.map((track, i) => {
      const isAudio = track.type === 'audio';
      const clips = track.clips.map(clip => {
        // Always read duration live from the clip reference so async-loaded
        // sources (video, audio) are picked up on every render pass
        const liveDur = clip.clipRef.duration > 0 ? clip.clipRef.duration : clip.duration;
        const left = timeToX(clip.start, this.view.zoom);
        const width = Math.max(durationToWidth(liveDur, this.view.zoom), 4);
        const isSelected = clip.id === this.selectedClipId;
        return `<div class="tl-clip${isSelected ? ' selected' : ''}"
          data-clip-id="${clip.id}"
          style="left:${left}px;width:${width}px">
          <div class="tl-clip-cap" style="background:${clip.color}"></div>
          <div class="tl-clip-body" style="background:${clip.color}33;border-left:1px solid ${clip.color}80;border-right:1px solid ${clip.color}80;border-bottom:1px solid ${clip.color}80">
            <span class="tl-clip-name">${clip.name}</span>
            ${isAudio ? '<div class="tl-audio-wave"></div>' : ''}
          </div>
        </div>`;
      }).join('');

      const separatorClass = i === videoTracks.length - 1 && audioTracks.length > 0 ? ' tl-av-separator' : '';
      return `<div class="tl-track-row tl-track-${track.type}${separatorClass}" data-track-id="${track.id}">${clips}</div>`;
    }).join('');

    this.tracksBodyEl.innerHTML = rows || `<div class="tl-empty-msg">No tracks. Add layers to see them here.</div>`;
    this.updatePlayheadHeight(orderedTracks.length);
  }

  drawRuler(): void {
    const totalWidth = Math.max(timeToX(Math.max(this.state.duration, 10), this.view.zoom) + 300, 600);
    const dpr = devicePixelRatio || 1;
    const height = 24;

    this.rulerCanvas.width = totalWidth * dpr;
    this.rulerCanvas.height = height * dpr;
    this.rulerCanvas.style.width = `${totalWidth}px`;
    this.rulerCanvas.style.height = `${height}px`;

    const ctx = this.rulerCanvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, totalWidth, height);

    const { major, minor } = getRulerStep(this.view.zoom);
    const visibleEnd = totalWidth / this.view.zoom + 2;

    // Minor ticks
    ctx.fillStyle = '#3a3a3a';
    for (let t = 0; t < visibleEnd; t += minor) {
      const x = timeToX(t, this.view.zoom);
      ctx.fillRect(x, height - 6, 1, 6);
    }

    // Major ticks + labels
    ctx.fillStyle = '#555';
    ctx.font = `10px 'Courier New', monospace`;
    ctx.textBaseline = 'top';
    for (let t = 0; t < visibleEnd; t += major) {
      const x = timeToX(t, this.view.zoom);
      ctx.fillStyle = '#555';
      ctx.fillRect(x, 0, 1, height);
      ctx.fillStyle = '#888';
      ctx.fillText(formatTimecode(t), x + 3, 4);
    }
  }

  updatePlayhead(): void {
    const x = timeToX(this.state.currentTime, this.view.zoom);
    this.playheadLineEl.style.left = `${x}px`;
    this.playheadRulerEl.style.left = `${x}px`;
    this.updateTimecode();
  }

  updateTimecode(): void {
    this.timecodeEl.textContent = formatTimecode(this.state.currentTime);
  }

  updateDuration(): void {
    const durEl = this.container.querySelector('#tl-duration-label');
    if (durEl) durEl.textContent = formatTimecode(this.state.duration);
  }

  private updatePlayheadHeight(trackCount: number): void {
    const height = Math.max(trackCount * this.view.TRACK_HEIGHT, 200);
    this.playheadLineEl.style.height = `${height}px`;
  }

  updateZoomDisplay(): void {
    this.drawRuler();
    this.renderTracks();
    this.updatePlayhead();
  }

  getOrderedTracks(): TLTrack[] {
    const v = this.state.tracks.filter(t => t.type === 'video').reverse();
    const a = this.state.tracks.filter(t => t.type === 'audio');
    return [...v, ...a];
  }
}
