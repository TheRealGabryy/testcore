import type { EditorState } from './state';
import type * as core from '@diffusionstudio/core';

function svgIcon(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const TYPE_ICONS: Record<string, string> = {
  VIDEO: svgIcon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 2l4 5-4 5"/>'),
  AUDIO: svgIcon('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  IMAGE: svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>'),
  TEXT: svgIcon('<path d="M17 6.1H3"/><path d="M21 12.1H3"/><path d="M15.1 18H3"/>'),
  CAPTION: svgIcon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  RECT: svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/>'),
  ELLIPSE: svgIcon('<circle cx="12" cy="12" r="9"/>'),
  POLYGON: svgIcon('<polygon points="12 2 22 20 2 20"/>'),
  BASE: svgIcon('<rect x="3" y="3" width="18" height="18"/>'),
};

const TYPE_COLORS: Record<string, string> = {
  VIDEO: '#3b7dd8', AUDIO: '#22c55e', IMAGE: '#e59d2a',
  TEXT: '#06b6d4', CAPTION: '#f97316', RECT: '#e05c8e',
  ELLIPSE: '#e05c8e', POLYGON: '#e05c8e', BASE: '#64748b',
};

function isVisual(clip: core.Clip): boolean {
  return ['VIDEO', 'IMAGE', 'TEXT', 'RECT', 'ELLIPSE', 'POLYGON', 'CAPTION'].includes(clip.type);
}

function propSection(title: string, body: string): string {
  return `<div class="props-section">
    <div class="props-section-header">
      <span class="props-section-title">${title}</span>
      <span class="props-section-arrow">${svgIcon('<polyline points="6 9 12 15 18 9"/>')}</span>
    </div>
    <div class="props-body">${body}</div>
  </div>`;
}

function propRow(fields: { label: string; value: string | number }[]): string {
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
      <button class="panel-tab" data-tab="fx">Info</button>
    </div>
    <div class="tab-content" id="tab-props">
      <div id="props-content" style="display:flex;flex-direction:column;height:100%;overflow:hidden;"></div>
    </div>
    <div class="tab-content hidden" id="tab-fx">
      <div id="info-content" style="padding:12px;"></div>
    </div>
  `;

  const tabBtns = el.querySelectorAll('.panel-tab');
  const tabContents = el.querySelectorAll('.tab-content');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = (btn as HTMLElement).dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.add('hidden'));
      btn.classList.add('active');
      el.querySelector(`#tab-${target}`)?.classList.remove('hidden');
    });
  });

  const propsContent = el.querySelector('#props-content') as HTMLDivElement;
  const infoContent = el.querySelector('#info-content') as HTMLDivElement;

  function renderEmpty() {
    propsContent.innerHTML = `<div class="props-no-selection">
      ${svgIcon('<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>')}
      <p>Select a clip to<br/>view its properties</p>
    </div>`;
  }

  function renderClipProps() {
    const sel = state.getSelectedClip();
    if (!sel) { renderEmpty(); return; }

    const { editorClip } = sel;
    const clip = editorClip.clip;
    const typeColor = TYPE_COLORS[clip.type] ?? '#64748b';
    const typeIcon = TYPE_ICONS[clip.type] ?? TYPE_ICONS['BASE'];

    const visual = isVisual(clip);
    const vc = clip as unknown as Record<string, number>;

    const timingSection = propSection('Timing', `
      ${propRow([{ label: 'Delay (s)', value: clip.delay.toFixed(3) }, { label: 'Duration (s)', value: clip.duration.toFixed(3) }])}
      ${propRow([{ label: 'Start', value: clip.start.toFixed(3) }, { label: 'End', value: clip.end.toFixed(3) }])}
    `);

    const transformSection = visual ? propSection('Transform', `
      ${propRow([{ label: 'X', value: typeof vc['x'] === 'number' ? Math.round(vc['x']) : '—' }, { label: 'Y', value: typeof vc['y'] === 'number' ? Math.round(vc['y']) : '—' }])}
      ${propRow([{ label: 'Width', value: typeof vc['width'] === 'number' ? Math.round(vc['width']) : '—' }, { label: 'Height', value: typeof vc['height'] === 'number' ? Math.round(vc['height']) : '—' }])}
      ${propRow([{ label: 'Rotation', value: typeof vc['rotation'] === 'number' ? vc['rotation'].toFixed(1) : '—' }])}
      <div class="prop-field">
        <span class="prop-label">Opacity</span>
        <div class="prop-slider-row">
          <input class="prop-slider" type="range" min="0" max="1" step="0.01" value="${typeof vc['opacity'] === 'number' ? vc['opacity'] : 1}" />
          <span class="prop-slider-val">${typeof vc['opacity'] === 'number' ? Math.round(vc['opacity'] * 100) : 100}%</span>
        </div>
      </div>
    `) : '';

    propsContent.innerHTML = `
      <div class="props-clip-header">
        <div class="props-clip-badge" style="background:${typeColor}">${typeIcon}</div>
        <span class="props-clip-name">${editorClip.name}</span>
      </div>
      <div class="props-scroll">
        ${timingSection}
        ${transformSection}
      </div>
    `;

    propsContent.querySelectorAll('.props-section-header').forEach(header => {
      header.addEventListener('click', () => {
        const body = header.nextElementSibling as HTMLElement;
        const arrow = header.querySelector('.props-section-arrow') as HTMLElement;
        body.classList.toggle('collapsed');
        arrow.classList.toggle('collapsed');
      });
    });

    if (visual) {
      const opacitySlider = propsContent.querySelector('.prop-slider') as HTMLInputElement;
      const opacityVal = propsContent.querySelector('.prop-slider-val') as HTMLSpanElement;
      opacitySlider?.addEventListener('input', () => {
        const val = parseFloat(opacitySlider.value);
        (clip as unknown as Record<string, number>)['opacity'] = val;
        opacityVal.textContent = `${Math.round(val * 100)}%`;
      });
    }
  }

  function renderInfo() {
    const duration = state.composition.duration;
    const layers = state.editorLayers.length;
    const clips = state.editorLayers.reduce((acc, l) => acc + l.clips.length, 0);
    infoContent.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;color:var(--text-2);font-size:12px;">
        <div style="display:flex;justify-content:space-between;padding:8px;background:var(--bg-active);border-radius:4px;">
          <span>Duration</span><span style="color:var(--text);font-variant-numeric:tabular-nums;">${duration.toFixed(2)}s</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px;background:var(--bg-active);border-radius:4px;">
          <span>Layers</span><span style="color:var(--text)">${layers}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px;background:var(--bg-active);border-radius:4px;">
          <span>Clips</span><span style="color:var(--text)">${clips}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px;background:var(--bg-active);border-radius:4px;">
          <span>Resolution</span><span style="color:var(--text)">${state.composition.width} × ${state.composition.height}</span>
        </div>
      </div>
    `;
  }

  state.on('selection:change', renderClipProps);
  state.on('layers:change', () => { renderClipProps(); renderInfo(); });
  state.on('timeline:change', () => { renderInfo(); });

  renderEmpty();
  renderInfo();
}
