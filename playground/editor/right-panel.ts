import type { EditorState } from './state';

function svgIcon(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const TYPE_COLORS: Record<string, string> = {
  VIDEO: '#3b7dd8',
  AUDIO: '#22c55e',
  IMAGE: '#e59d2a',
  TEXT: '#06b6d4',
  CAPTION: '#f97316',
  RECT: '#e05c8e',
  ELLIPSE: '#e05c8e',
  POLYGON: '#e05c8e',
  BASE: '#64748b',
};

const TYPE_ICONS: Record<string, string> = {
  VIDEO: svgIcon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 2l4 5-4 5"/>'),
  AUDIO: svgIcon('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  IMAGE: svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>'),
  TEXT: svgIcon('<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>'),
  CAPTION: svgIcon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  RECT: svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/>'),
  ELLIPSE: svgIcon('<circle cx="12" cy="12" r="9"/>'),
  POLYGON: svgIcon('<polygon points="12 2 22 20 2 20"/>'),
  BASE: svgIcon('<rect x="3" y="3" width="18" height="18"/>'),
};

const VISUAL_TYPES = new Set(['VIDEO', 'IMAGE', 'TEXT', 'RECT', 'ELLIPSE', 'POLYGON', 'CAPTION']);
const AUDIO_TYPES = new Set(['VIDEO', 'AUDIO']);

function formatVal(v: unknown): string {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'number') return Number.isFinite(v) ? v.toFixed(2) : '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const rec = v as Record<string, unknown>;
    if (typeof rec['value'] === 'number') return `${rec['value'].toFixed(0)}%`;
  }
  return String(v);
}

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function propSection(title: string, body: string): string {
  return `
    <div class="props-section">
      <div class="props-section-header">
        <span class="props-section-title">${title}</span>
        <span class="props-section-arrow">${svgIcon('<polyline points="6 9 12 15 18 9"/>')}</span>
      </div>
      <div class="props-body">${body}</div>
    </div>`;
}

function propRow(...fields: { label: string; value: string }[]): string {
  const cls = fields.length === 1 ? 'prop-row single' : 'prop-row';
  return `<div class="${cls}">${fields.map(f => `
    <div class="prop-field">
      <span class="prop-label">${f.label}</span>
      <input class="prop-input" type="text" value="${f.value}" readonly />
    </div>`).join('')}</div>`;
}

export function setupRightPanel(el: HTMLElement, state: EditorState) {
  el.innerHTML = `
    <div class="panel-tabs">
      <button class="panel-tab active" data-tab="props">Properties</button>
      <button class="panel-tab" data-tab="info">Info</button>
    </div>
    <div id="tab-props" class="tab-content">
      <div id="props-content"></div>
    </div>
    <div id="tab-info" class="tab-content hidden">
      <div id="info-content"></div>
    </div>
  `;

  el.querySelectorAll('.panel-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = (btn as HTMLElement).dataset.tab!;
      el.querySelectorAll('.panel-tab').forEach(b => b.classList.remove('active'));
      el.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      btn.classList.add('active');
      el.querySelector(`#tab-${target}`)!.classList.remove('hidden');
    });
  });

  const propsContent = el.querySelector('#props-content') as HTMLDivElement;
  const infoContent = el.querySelector('#info-content') as HTMLDivElement;

  function renderEmpty() {
    propsContent.innerHTML = `
      <div class="props-empty-state">
        <div class="props-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <line x1="7" y1="8" x2="17" y2="8"/>
            <line x1="7" y1="12" x2="14" y2="12"/>
            <line x1="7" y1="16" x2="11" y2="16"/>
          </svg>
        </div>
        <p class="props-empty-title">It's empty here</p>
        <p class="props-empty-sub">Click an element on the timeline to edit its properties</p>
      </div>
    `;
  }

  function renderClipProps() {
    const sel = state.getSelectedClip();
    if (!sel) { renderEmpty(); return; }

    const { editorClip } = sel;
    const clip = editorClip.clip;
    const raw = clip as unknown as Record<string, unknown>;
    const typeStr = String(clip.type);
    const color = TYPE_COLORS[typeStr] ?? TYPE_COLORS['BASE'];
    const icon = TYPE_ICONS[typeStr] ?? TYPE_ICONS['BASE'];

    const sections: string[] = [];

    sections.push(propSection('Timing',
      propRow({ label: 'Delay', value: `${formatVal(clip.delay)}s` }, { label: 'Duration', value: `${formatVal(clip.duration)}s` })
    ));

    if (VISUAL_TYPES.has(typeStr)) {
      const xVal = formatVal(raw['x']);
      const yVal = formatVal(raw['y']);
      const wVal = formatVal(raw['width']);
      const hVal = formatVal(raw['height']);
      const rotVal = formatVal(raw['rotation']);
      const opNum = asNum(raw['opacity']);
      const opPct = opNum !== null ? Math.round(opNum * 100) : 100;
      const opVal = opNum !== null ? opNum : 1;

      sections.push(propSection('Transform',
        propRow({ label: 'X', value: xVal }, { label: 'Y', value: yVal }) +
        propRow({ label: 'Width', value: wVal }, { label: 'Height', value: hVal }) +
        propRow({ label: 'Rotation', value: `${rotVal}°` }) +
        `<div class="prop-field">
          <span class="prop-label">Opacity</span>
          <div class="prop-slider-row">
            <input class="prop-slider" id="opacity-slider" type="range" min="0" max="1" step="0.01" value="${opVal}" />
            <span class="prop-slider-val" id="opacity-val">${opPct}%</span>
          </div>
        </div>`
      ));
    }

    if (typeStr === 'TEXT' || typeStr === 'CAPTION') {
      const text = raw['text'];
      const fontSize = formatVal(raw['fontSize']);
      const color2 = typeof raw['color'] === 'string' ? raw['color'] : '—';
      sections.push(propSection('Text',
        propRow({ label: 'Content', value: typeof text === 'string' ? text.slice(0, 30) : '—' }) +
        propRow({ label: 'Font Size', value: fontSize }, { label: 'Color', value: color2 })
      ));
    }

    if (AUDIO_TYPES.has(typeStr)) {
      const vol = asNum(raw['volume']);
      const muted = raw['muted'];
      sections.push(propSection('Audio',
        propRow({ label: 'Volume', value: vol !== null ? `${Math.round(vol * 100)}%` : '—' },
                { label: 'Muted', value: muted ? 'Yes' : 'No' })
      ));
    }

    propsContent.innerHTML = `
      <div class="props-clip-header">
        <div class="props-clip-badge" style="background:${color}">${icon}</div>
        <span class="props-clip-name">${editorClip.name}</span>
        <span class="props-clip-type">${typeStr}</span>
      </div>
      <div class="props-scroll">
        ${sections.join('')}
      </div>
    `;

    propsContent.querySelectorAll('.props-section-header').forEach(header => {
      header.addEventListener('click', () => {
        const body = header.nextElementSibling as HTMLElement;
        const arrow = header.querySelector('.props-section-arrow') as HTMLElement;
        body.classList.toggle('collapsed');
        arrow.classList.toggle('open');
      });
    });

    const opSlider = propsContent.querySelector('#opacity-slider') as HTMLInputElement | null;
    const opVal = propsContent.querySelector('#opacity-val') as HTMLSpanElement | null;
    if (opSlider && opVal) {
      opSlider.addEventListener('input', () => {
        const v = parseFloat(opSlider.value);
        (clip as unknown as Record<string, unknown>)['opacity'] = v;
        opVal.textContent = `${Math.round(v * 100)}%`;
      });
    }
  }

  function renderInfo() {
    const duration = state.composition.duration;
    const layers = state.editorLayers.length;
    const clips = state.editorLayers.reduce((acc, l) => acc + l.clips.length, 0);
    infoContent.innerHTML = `
      <div class="info-rows">
        <div class="info-row"><span>Duration</span><span>${duration.toFixed(2)}s</span></div>
        <div class="info-row"><span>Layers</span><span>${layers}</span></div>
        <div class="info-row"><span>Clips</span><span>${clips}</span></div>
        <div class="info-row"><span>Resolution</span><span>${state.composition.width}×${state.composition.height}</span></div>
        <div class="info-row"><span>FPS</span><span>${state.fps}</span></div>
      </div>
    `;
  }

  state.on('selection:change', renderClipProps);
  state.on('layers:change', () => { renderClipProps(); renderInfo(); });
  state.on('timeline:change', renderInfo);

  renderEmpty();
  renderInfo();
}
