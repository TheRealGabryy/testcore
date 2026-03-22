import * as core from '@diffusionstudio/core';
import type { EditorState } from './state';

function svgIcon(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}


const VISUAL_TYPES = new Set(['VIDEO', 'IMAGE', 'TEXT', 'RECT', 'ELLIPSE', 'POLYGON', 'CAPTION']);
const AUDIO_TYPES = new Set(['VIDEO', 'AUDIO']);

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resolveClipDimension(v: unknown, compDim: number): number {
  if (typeof v === 'number' && v > 0) return v;
  if (v && typeof v === 'object') {
    const r = v as Record<string, unknown>;
    if (typeof r['value'] === 'number') return r['value'] / 100 * compDim;
  }
  return compDim;
}

function resolveEditValue(v: unknown, dimension?: number): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.round(v * 10) / 10);
  if (v && typeof v === 'object') {
    const rec = v as Record<string, unknown>;
    if (typeof rec['value'] === 'number') {
      if (dimension !== undefined) return String(Math.round(rec['value'] / 100 * dimension * 10) / 10);
      return String(rec['value']);
    }
  }
  if (typeof v === 'string') return v;
  return '';
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

function propField(label: string, value: string, prop?: string, inputType = 'text', extra = ''): string {
  const editable = prop ? `data-prop="${prop}"` : 'readonly';
  return `<div class="prop-field">
    <span class="prop-label">${label}</span>
    <input class="prop-input${prop ? ' editable' : ''}" type="${inputType}" value="${escapeAttr(value)}" ${editable} ${extra} />
  </div>`;
}

function propRow(...fields: Array<{ label: string; value: string; prop?: string; type?: string; extra?: string }>): string {
  const cls = fields.length === 1 ? 'prop-row single' : 'prop-row';
  return `<div class="${cls}">${fields.map(f => propField(f.label, f.value, f.prop, f.type, f.extra)).join('')}</div>`;
}

function updateClipProp(clip: core.Clip, prop: string, value: string, composition: core.Composition) {
  const raw = clip as unknown as Record<string, unknown>;
  const num = parseFloat(value);
  const compW = (composition as unknown as Record<string, unknown>)['width'] as number ?? 1920;
  const compH = (composition as unknown as Record<string, unknown>)['height'] as number ?? 1080;

  switch (prop) {
    case 'delay':
      if (!isNaN(num) && num >= 0) (clip as unknown as Record<string, unknown>)['delay'] = num;
      break;
    case 'duration':
      if (!isNaN(num) && num > 0) (clip as unknown as Record<string, unknown>)['duration'] = num;
      break;
    case 'x':
    case 'y':
      if (!isNaN(num)) raw[prop] = num;
      break;
    case 'width':
    case 'height':
      if (!isNaN(num) && num > 0) raw[prop] = num;
      break;
    case 'rotation':
      if (!isNaN(num)) raw['rotation'] = num;
      break;
    case 'opacityPct':
      if (!isNaN(num)) raw['opacity'] = Math.max(0, Math.min(1, num / 100));
      break;
    case 'text':
      raw['text'] = value;
      break;
    case 'fontSize':
      if (!isNaN(num) && num > 0) raw['fontSize'] = num;
      break;
    case 'color':
      raw['color'] = value;
      break;
    case 'volumePct':
      if (!isNaN(num)) raw['volume'] = Math.max(0, Math.min(2, num / 100));
      break;
    case 'anchorXPx': {
      if (!isNaN(num)) {
        const w = resolveClipDimension(raw['width'], compW);
        raw['anchorX'] = w > 0 ? Math.max(0, num / w) : 0.5;
      }
      break;
    }
    case 'anchorYPx': {
      if (!isNaN(num)) {
        const h = resolveClipDimension(raw['height'], compH);
        raw['anchorY'] = h > 0 ? Math.max(0, num / h) : 0.5;
      }
      break;
    }
  }

  composition.seek(composition.currentTime);
}

export function setupRightPanel(el: HTMLElement, state: EditorState) {
  el.innerHTML = `
    <div class="panel-header-row">
      <span class="panel-header-title">Properties</span>
      <div class="panel-tabs">
        <button class="panel-tab active" data-tab="props">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
          Design
        </button>
        <button class="panel-tab" data-tab="fx">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          FX
        </button>
      </div>
    </div>
    <div id="tab-props" class="tab-content">
      <div id="props-content"></div>
    </div>
    <div id="tab-fx" class="tab-content hidden">
      <div id="fx-content"></div>
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
  const fxContent = el.querySelector('#fx-content') as HTMLDivElement;

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

  function bindPropInputs(clip: core.Clip) {
    propsContent.querySelectorAll<HTMLInputElement>('[data-prop]').forEach(input => {
      const prop = input.dataset.prop!;

      const commitAndRerender = () => {
        updateClipProp(clip, prop, input.value, state.composition);
        state.emit('props:change');
      };

      const commitLive = () => {
        updateClipProp(clip, prop, input.value, state.composition);
      };

      if (input.type === 'range') {
        input.addEventListener('input', commitLive);
        input.addEventListener('change', commitAndRerender);
      } else if (input.type === 'color') {
        input.addEventListener('input', commitAndRerender);
      } else {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { commitAndRerender(); input.blur(); }
          if (e.key === 'Escape') input.blur();
        });
        input.addEventListener('blur', commitAndRerender);
      }
    });
  }

  function renderClipProps() {
    const sel = state.getSelectedClip();
    if (!sel) { renderEmpty(); return; }

    const { editorClip } = sel;
    const clip = editorClip.clip;
    const raw = clip as unknown as Record<string, unknown>;
    const typeStr = String(clip.type);
    const compW = state.composition.width;
    const compH = state.composition.height;

    const sections: string[] = [];

    const delayVal = resolveEditValue(clip.delay);
    const durVal = resolveEditValue(clip.duration);
    sections.push(propSection('Timing',
      propRow(
        { label: 'Delay (s)', value: delayVal, prop: 'delay', type: 'number', extra: 'min="0" step="0.1"' },
        { label: 'Duration (s)', value: durVal, prop: 'duration', type: 'number', extra: 'min="0.1" step="0.1"' }
      )
    ));

    if (VISUAL_TYPES.has(typeStr)) {
      const xVal = resolveEditValue(raw['x'], compW);
      const yVal = resolveEditValue(raw['y'], compH);
      const wVal = resolveEditValue(raw['width'], compW);
      const hVal = resolveEditValue(raw['height'], compH);
      const rotVal = resolveEditValue(raw['rotation']);
      const opNum = typeof raw['opacity'] === 'number' ? raw['opacity'] : 1;
      const opPct = Math.round(opNum * 100);

      const resolvedW = resolveClipDimension(raw['width'], compW);
      const resolvedH = resolveClipDimension(raw['height'], compH);
      const anchorXNorm = typeof raw['anchorX'] === 'number' ? raw['anchorX'] : 0.5;
      const anchorYNorm = typeof raw['anchorY'] === 'number' ? raw['anchorY'] : 0.5;
      const anchorXPx = String(Math.round(anchorXNorm * resolvedW * 10) / 10);
      const anchorYPx = String(Math.round(anchorYNorm * resolvedH * 10) / 10);

      sections.push(propSection('Transform',
        propRow(
          { label: 'X', value: xVal, prop: 'x', type: 'number', extra: 'step="1"' },
          { label: 'Y', value: yVal, prop: 'y', type: 'number', extra: 'step="1"' }
        ) +
        propRow(
          { label: 'Width', value: wVal, prop: 'width', type: 'number', extra: 'min="1" step="1"' },
          { label: 'Height', value: hVal, prop: 'height', type: 'number', extra: 'min="1" step="1"' }
        ) +
        propRow({ label: 'Rotation (°)', value: rotVal, prop: 'rotation', type: 'number', extra: 'step="1"' }) +
        `<div class="prop-field">
          <span class="prop-label">Opacity</span>
          <div class="prop-slider-row">
            <input class="prop-slider" data-prop="opacityPct" type="range" min="0" max="100" step="1" value="${opPct}" />
            <input class="prop-input editable prop-opacity-num" data-prop="opacityPct" type="number" min="0" max="100" step="1" value="${opPct}" style="width:48px;flex-shrink:0;" />
          </div>
        </div>` +
        propRow(
          { label: 'Anchor X', value: anchorXPx, prop: 'anchorXPx', type: 'number', extra: 'step="1"' },
          { label: 'Anchor Y', value: anchorYPx, prop: 'anchorYPx', type: 'number', extra: 'step="1"' }
        ) +
        `<div class="anchor-presets">
          <button class="anchor-preset-btn" data-ax="0"   data-ay="0"   title="Top-left"><svg viewBox="0 0 10 10"><circle cx="2" cy="2" r="1.5" fill="currentColor"/><rect x="1" y="4" width="8" height="1" opacity=".3" rx="0.5"/><rect x="1" y="6" width="5" height="1" opacity=".3" rx="0.5"/></svg></button>
          <button class="anchor-preset-btn" data-ax="0.5" data-ay="0"   title="Top-center"><svg viewBox="0 0 10 10"><circle cx="5" cy="2" r="1.5" fill="currentColor"/><rect x="1" y="4" width="8" height="1" opacity=".3" rx="0.5"/><rect x="2" y="6" width="6" height="1" opacity=".3" rx="0.5"/></svg></button>
          <button class="anchor-preset-btn" data-ax="1"   data-ay="0"   title="Top-right"><svg viewBox="0 0 10 10"><circle cx="8" cy="2" r="1.5" fill="currentColor"/><rect x="1" y="4" width="8" height="1" opacity=".3" rx="0.5"/><rect x="4" y="6" width="5" height="1" opacity=".3" rx="0.5"/></svg></button>
          <button class="anchor-preset-btn" data-ax="0"   data-ay="0.5" title="Center-left"><svg viewBox="0 0 10 10"><circle cx="2" cy="5" r="1.5" fill="currentColor"/><rect x="1" y="1" width="8" height="1" opacity=".3" rx="0.5"/><rect x="1" y="8" width="5" height="1" opacity=".3" rx="0.5"/></svg></button>
          <button class="anchor-preset-btn anchor-preset-btn--center" data-ax="0.5" data-ay="0.5" title="Center"><svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="1.5" fill="currentColor"/><rect x="1" y="1" width="8" height="1" opacity=".3" rx="0.5"/><rect x="2" y="8" width="6" height="1" opacity=".3" rx="0.5"/></svg></button>
          <button class="anchor-preset-btn" data-ax="1"   data-ay="0.5" title="Center-right"><svg viewBox="0 0 10 10"><circle cx="8" cy="5" r="1.5" fill="currentColor"/><rect x="1" y="1" width="8" height="1" opacity=".3" rx="0.5"/><rect x="4" y="8" width="5" height="1" opacity=".3" rx="0.5"/></svg></button>
          <button class="anchor-preset-btn" data-ax="0"   data-ay="1"   title="Bottom-left"><svg viewBox="0 0 10 10"><circle cx="2" cy="8" r="1.5" fill="currentColor"/><rect x="1" y="1" width="8" height="1" opacity=".3" rx="0.5"/><rect x="1" y="3" width="5" height="1" opacity=".3" rx="0.5"/></svg></button>
          <button class="anchor-preset-btn" data-ax="0.5" data-ay="1"   title="Bottom-center"><svg viewBox="0 0 10 10"><circle cx="5" cy="8" r="1.5" fill="currentColor"/><rect x="1" y="1" width="8" height="1" opacity=".3" rx="0.5"/><rect x="2" y="3" width="6" height="1" opacity=".3" rx="0.5"/></svg></button>
          <button class="anchor-preset-btn" data-ax="1"   data-ay="1"   title="Bottom-right"><svg viewBox="0 0 10 10"><circle cx="8" cy="8" r="1.5" fill="currentColor"/><rect x="1" y="1" width="8" height="1" opacity=".3" rx="0.5"/><rect x="4" y="3" width="5" height="1" opacity=".3" rx="0.5"/></svg></button>
        </div>`
      ));
    }

    if (typeStr === 'TEXT' || typeStr === 'CAPTION') {
      const textVal = typeof raw['text'] === 'string' ? raw['text'] : '';
      const fontSizeVal = resolveEditValue(raw['fontSize']);
      const colorVal = typeof raw['color'] === 'string' ? raw['color'] : '#ffffff';

      sections.push(propSection('Text',
        propRow({ label: 'Content', value: textVal, prop: 'text' }) +
        propRow(
          { label: 'Font Size', value: fontSizeVal, prop: 'fontSize', type: 'number', extra: 'min="1" step="1"' },
          { label: 'Color', value: colorVal, prop: 'color', type: 'color' }
        )
      ));
    }

    if (AUDIO_TYPES.has(typeStr)) {
      const vol = typeof raw['volume'] === 'number' ? raw['volume'] : 1;
      const volPct = Math.round(vol * 100);
      sections.push(propSection('Audio',
        `<div class="prop-field">
          <span class="prop-label">Volume</span>
          <div class="prop-slider-row">
            <input class="prop-slider" data-prop="volumePct" type="range" min="0" max="200" step="1" value="${volPct}" />
            <input class="prop-input editable" data-prop="volumePct" type="number" min="0" max="200" step="1" value="${volPct}" style="width:48px;flex-shrink:0;" />
          </div>
        </div>`
      ));
    }

    propsContent.innerHTML = `
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

    syncOpacityControls();
    syncVolumeControls();
    bindPropInputs(clip);
    bindAnchorPresets(clip);
  }

  function bindAnchorPresets(clip: core.Clip) {
    propsContent.querySelectorAll<HTMLButtonElement>('.anchor-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const raw = clip as unknown as Record<string, unknown>;
        const ax = parseFloat(btn.dataset.ax ?? '0.5');
        const ay = parseFloat(btn.dataset.ay ?? '0.5');
        raw['anchorX'] = ax;
        raw['anchorY'] = ay;
        state.composition.seek(state.composition.currentTime);
        state.emit('props:change');
      });
    });
  }

  function syncOpacityControls() {
    const slider = propsContent.querySelector<HTMLInputElement>('.prop-slider[data-prop="opacityPct"]');
    const numInput = propsContent.querySelector<HTMLInputElement>('.prop-opacity-num');
    if (!slider || !numInput) return;
    slider.addEventListener('input', () => { numInput.value = slider.value; });
    numInput.addEventListener('input', () => { slider.value = numInput.value; });
  }

  function syncVolumeControls() {
    const slider = propsContent.querySelector<HTMLInputElement>('.prop-slider[data-prop="volumePct"]');
    const numInput = propsContent.querySelector<HTMLInputElement>('input[type="number"][data-prop="volumePct"]');
    if (!slider || !numInput) return;
    slider.addEventListener('input', () => { numInput.value = slider.value; });
    numInput.addEventListener('input', () => { slider.value = numInput.value; });
  }

  function renderFx() {
    fxContent.innerHTML = `
      <div class="props-empty-state">
        <div class="props-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z"/>
          </svg>
        </div>
        <p class="props-empty-title">No effects</p>
        <p class="props-empty-sub">Effects and filters will appear here</p>
      </div>
    `;
  }

  state.on('selection:change', renderClipProps);
  state.on('props:change', renderClipProps);
  state.on('layers:change', renderClipProps);

  renderEmpty();
  renderFx();
}
