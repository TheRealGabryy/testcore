import { getSettings, applySettings, resetSettings, DEFAULT_SETTINGS } from './settings';
import type { EditorSettings } from './settings';

function svgIcon(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const CATEGORY_ICONS: Record<string, string> = {
  appearance:  svgIcon('<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'),
  accent:      svgIcon('<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>'),
  clipColors:  svgIcon('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  timeline:    svgIcon('<line x1="2" y1="6" x2="22" y2="6"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="18" x2="22" y2="18"/><circle cx="8" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="6" cy="18" r="2" fill="currentColor" stroke="none"/>'),
  keyframes:   svgIcon('<path d="M12 2l3 3-3 3-3-3 3-3z" fill="currentColor" stroke="none"/><path d="M12 16l3 3-3 3-3-3 3-3z" fill="currentColor" stroke="none"/><line x1="12" y1="8" x2="12" y2="16"/>'),
  typography:  svgIcon('<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>'),
  snapping:    svgIcon('<path d="M21 3H3v7h18V3z"/><path d="M21 14H3v7h18v-7z"/><path d="M8 10v4"/><path d="M12 10v4"/><path d="M16 10v4"/>'),
  transitions: svgIcon('<path d="M5 12h14"/><path d="M15 6l6 6-6 6"/>'),
};

const CATEGORY_LABELS: Record<string, string> = {
  appearance:  'Appearance',
  accent:      'Accent & Status',
  clipColors:  'Clip Colors',
  timeline:    'Timeline',
  keyframes:   'Keyframes',
  typography:  'Typography',
  snapping:    'Snapping',
  transitions: 'Transitions',
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  appearance:  'Background, surface, and border colors',
  accent:      'Primary accent, success, error, and info colors',
  clipColors:  'Per-type colors for timeline clips',
  timeline:    'Ruler, track, and playhead appearance',
  keyframes:   'Keyframe diamond, rows, and animation colors',
  typography:  'Font family, size, and line height',
  snapping:    'Snap zones and threshold distances',
  transitions: 'UI animation durations',
};

const CATEGORIES = Object.keys(CATEGORY_LABELS);

function colorInput(id: string, value: string, label: string, hint?: string): string {
  return `
    <div class="sp-field">
      <label class="sp-label" for="${id}">${label}</label>
      ${hint ? `<span class="sp-hint">${hint}</span>` : ''}
      <div class="sp-color-row">
        <div class="sp-color-swatch-wrap">
          <input type="color" id="${id}" class="sp-color-native" value="${rgbToHex(value)}" data-field="${id}" />
          <div class="sp-color-swatch" style="background:${value}"></div>
        </div>
        <input type="text" class="sp-color-text" data-color-for="${id}" value="${value}" spellcheck="false" />
      </div>
    </div>
  `;
}

function numberInput(id: string, value: number, label: string, min: number, max: number, step: number, unit?: string): string {
  return `
    <div class="sp-field">
      <label class="sp-label" for="${id}">${label}</label>
      <div class="sp-number-row">
        <input type="number" id="${id}" class="sp-number" data-field="${id}" value="${value}" min="${min}" max="${max}" step="${step}" />
        ${unit ? `<span class="sp-unit">${unit}</span>` : ''}
      </div>
    </div>
  `;
}

function selectInput(id: string, value: string, label: string, options: string[]): string {
  const opts = options.map(o => `<option value="${o}"${o === value ? ' selected' : ''}>${o}</option>`).join('');
  return `
    <div class="sp-field">
      <label class="sp-label" for="${id}">${label}</label>
      <select id="${id}" class="sp-select" data-field="${id}">${opts}</select>
    </div>
  `;
}

function rgbToHex(color: string): string {
  if (color.startsWith('#')) return color.length === 7 ? color : color;
  if (color.startsWith('rgba') || color.startsWith('rgb')) {
    const m = color.match(/[\d.]+/g);
    if (!m) return '#000000';
    const r = parseInt(m[0]).toString(16).padStart(2, '0');
    const g = parseInt(m[1]).toString(16).padStart(2, '0');
    const b = parseInt(m[2]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return '#000000';
}

function renderCategoryContent(cat: string, s: EditorSettings): string {
  switch (cat) {
    case 'appearance': return `
      <div class="sp-section-title">Backgrounds</div>
      <div class="sp-grid-2">
        ${colorInput('bg-primary', s.appearance.bgPrimary, 'Primary Background')}
        ${colorInput('bg-surface', s.appearance.bgSurface, 'Surface Background')}
        ${colorInput('bg-panel', s.appearance.bgPanel, 'Panel Background')}
        ${colorInput('bg-hover', s.appearance.bgHover, 'Hover State')}
        ${colorInput('bg-active', s.appearance.bgActive, 'Active State')}
        ${colorInput('bg-selected', s.appearance.bgSelected, 'Selected Background')}
      </div>
      <div class="sp-section-title">Borders</div>
      <div class="sp-grid-2">
        ${colorInput('border-primary', s.appearance.borderPrimary, 'Border Primary')}
        ${colorInput('border-light', s.appearance.borderLight, 'Border Light')}
      </div>
      <div class="sp-section-title">Text</div>
      <div class="sp-grid-2">
        ${colorInput('text-primary', s.appearance.textPrimary, 'Text Primary')}
        ${colorInput('text-secondary', s.appearance.textSecondary, 'Text Secondary')}
        ${colorInput('text-tertiary', s.appearance.textTertiary, 'Text Tertiary')}
      </div>
      <div class="sp-section-title">Canvas</div>
      <div class="sp-grid-2">
        ${colorInput('preview-bg', s.appearance.previewBg, 'Preview Area')}
        ${colorInput('composition-bg', s.appearance.compositionBg, 'Composition Background')}
      </div>
    `;

    case 'accent': return `
      <div class="sp-section-title">Accent Color</div>
      <div class="sp-grid-2">
        ${colorInput('accent-color', s.accent.accentColor, 'Accent')}
        ${colorInput('accent-hover', s.accent.accentHover, 'Accent Hover')}
        ${colorInput('accent-dim', s.accent.accentDim, 'Accent Dim')}
      </div>
      <div class="sp-section-title">Status Colors</div>
      <div class="sp-grid-2">
        ${colorInput('success-color', s.accent.successColor, 'Success')}
        ${colorInput('error-color', s.accent.errorColor, 'Error')}
        ${colorInput('info-color', s.accent.infoColor, 'Info')}
      </div>
    `;

    case 'clipColors': return `
      <div class="sp-section-title">Timeline Clip Colors</div>
      <div class="sp-grid-2">
        ${colorInput('clip-video', s.clipColors.video, 'Video')}
        ${colorInput('clip-audio', s.clipColors.audio, 'Audio')}
        ${colorInput('clip-image', s.clipColors.image, 'Image')}
        ${colorInput('clip-text', s.clipColors.text, 'Text')}
        ${colorInput('clip-caption', s.clipColors.caption, 'Caption')}
        ${colorInput('clip-shape', s.clipColors.shape, 'Shape')}
        ${colorInput('clip-base', s.clipColors.base, 'Base / Unknown')}
      </div>
    `;

    case 'timeline': return `
      <div class="sp-section-title">Ruler</div>
      <div class="sp-grid-2">
        ${colorInput('tl-ruler-major', s.timeline.rulerMajorTick, 'Major Tick')}
        ${colorInput('tl-ruler-minor', s.timeline.rulerMinorTick, 'Minor Tick')}
        ${colorInput('tl-ruler-text', s.timeline.rulerText, 'Ruler Text')}
      </div>
      <div class="sp-section-title">Tracks</div>
      <div class="sp-grid-2">
        ${colorInput('tl-track-bg', s.timeline.trackBg, 'Track Background')}
        ${colorInput('tl-track-alt', s.timeline.trackAltBg, 'Track Alt Background')}
        ${numberInput('tl-track-normal-h', s.timeline.trackNormalHeight, 'Normal Track Height', 20, 80, 1, 'px')}
        ${numberInput('tl-track-audio-h', s.timeline.trackAudioHeight, 'Audio Track Height', 16, 60, 1, 'px')}
        ${numberInput('tl-track-text-h', s.timeline.trackTextHeight, 'Text Track Height', 14, 50, 1, 'px')}
      </div>
      <div class="sp-section-title">Playhead & Snap</div>
      <div class="sp-grid-2">
        ${colorInput('tl-playhead', s.timeline.playheadColor, 'Playhead Color')}
        ${colorInput('tl-snap', s.timeline.snapIndicatorColor, 'Snap Indicator')}
      </div>
    `;

    case 'keyframes': return `
      <div class="sp-section-title">Diamond Marker</div>
      <div class="sp-grid-2">
        ${colorInput('kf-color', s.keyframes.keyframeColor, 'Keyframe Color')}
        ${colorInput('kf-selected', s.keyframes.keyframeSelected, 'Selected Keyframe')}
        ${colorInput('kf-line', s.keyframes.keyframeLine, 'Keyframe Line')}
        ${numberInput('kf-diamond', s.keyframes.diamondSize, 'Diamond Size', 6, 18, 1, 'px')}
      </div>
      <div class="sp-section-title">Layout</div>
      <div class="sp-grid-2">
        ${numberInput('kf-row-h', s.keyframes.rowHeight, 'Row Height', 16, 40, 1, 'px')}
        ${numberInput('kf-label-w', s.keyframes.labelWidth, 'Label Width', 60, 160, 1, 'px')}
        ${numberInput('kf-ruler-h', s.keyframes.rulerHeight, 'Ruler Height', 16, 40, 1, 'px')}
      </div>
    `;

    case 'typography': return `
      <div class="sp-section-title">Font</div>
      <div class="sp-grid-1">
        ${selectInput('font-family', s.typography.fontFamily.split(',')[0].trim().replace(/'/g, ''), 'Font Family', [
          'Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'monospace'
        ])}
      </div>
      <div class="sp-section-title">Sizes</div>
      <div class="sp-grid-2">
        ${numberInput('font-size-base', s.typography.baseFontSize, 'Base Font Size', 10, 16, 1, 'px')}
        ${numberInput('line-height', s.typography.lineHeight, 'Line Height', 1.0, 2.0, 0.1, '')}
        ${numberInput('ruler-font-size', s.typography.rulerFontSize, 'Ruler Font Size', 8, 14, 1, 'px')}
        ${numberInput('ui-font-size', s.typography.uiFontSize, 'UI Font Size', 9, 14, 1, 'px')}
      </div>
    `;

    case 'snapping': return `
      <div class="sp-section-title">Timeline Snapping</div>
      <div class="sp-grid-2">
        ${numberInput('edge-zone', s.snapping.edgeZone, 'Edge Resize Zone', 2, 20, 1, 'px')}
        ${numberInput('snap-frames', s.snapping.snapThresholdFrames, 'Snap Threshold', 1, 10, 1, 'frames')}
        ${numberInput('curve-hit', s.snapping.curvePointHitRadius, 'Curve Hit Radius', 4, 20, 1, 'px')}
      </div>
    `;

    case 'transitions': return `
      <div class="sp-section-title">Animation Durations</div>
      <div class="sp-grid-2">
        ${numberInput('trans-hover', s.transitions.hoverDuration, 'Hover Transition', 0, 500, 10, 'ms')}
        ${numberInput('trans-opacity', s.transitions.opacityDuration, 'Opacity Transition', 0, 500, 10, 'ms')}
        ${numberInput('trans-layout', s.transitions.layoutFlashDuration, 'Layout Flash', 0, 200, 10, 'ms')}
        ${numberInput('trans-section', s.transitions.sectionDuration, 'Section Expand', 0, 500, 10, 'ms')}
      </div>
    `;

    default: return '';
  }
}

function collectSettings(modal: HTMLElement, base: EditorSettings): EditorSettings {
  const s = JSON.parse(JSON.stringify(base)) as EditorSettings;

  function getColor(id: string): string {
    const textEl = modal.querySelector<HTMLInputElement>(`[data-color-for="${id}"]`);
    if (textEl) return textEl.value.trim() || base.appearance.bgPrimary;
    const nativeEl = modal.querySelector<HTMLInputElement>(`[data-field="${id}"]`);
    if (nativeEl) return nativeEl.value;
    return '';
  }

  function getNum(id: string): number {
    const el = modal.querySelector<HTMLInputElement>(`[data-field="${id}"]`);
    return el ? parseFloat(el.value) : 0;
  }

  function getStr(id: string): string {
    const el = modal.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${id}"]`);
    return el ? el.value : '';
  }

  s.appearance.bgPrimary = getColor('bg-primary') || s.appearance.bgPrimary;
  s.appearance.bgSurface = getColor('bg-surface') || s.appearance.bgSurface;
  s.appearance.bgPanel = getColor('bg-panel') || s.appearance.bgPanel;
  s.appearance.bgHover = getColor('bg-hover') || s.appearance.bgHover;
  s.appearance.bgActive = getColor('bg-active') || s.appearance.bgActive;
  s.appearance.bgSelected = getColor('bg-selected') || s.appearance.bgSelected;
  s.appearance.borderPrimary = getColor('border-primary') || s.appearance.borderPrimary;
  s.appearance.borderLight = getColor('border-light') || s.appearance.borderLight;
  s.appearance.textPrimary = getColor('text-primary') || s.appearance.textPrimary;
  s.appearance.textSecondary = getColor('text-secondary') || s.appearance.textSecondary;
  s.appearance.textTertiary = getColor('text-tertiary') || s.appearance.textTertiary;
  s.appearance.previewBg = getColor('preview-bg') || s.appearance.previewBg;
  s.appearance.compositionBg = getColor('composition-bg') || s.appearance.compositionBg;

  s.accent.accentColor = getColor('accent-color') || s.accent.accentColor;
  s.accent.accentHover = getColor('accent-hover') || s.accent.accentHover;
  s.accent.accentDim = getColor('accent-dim') || s.accent.accentDim;
  s.accent.successColor = getColor('success-color') || s.accent.successColor;
  s.accent.errorColor = getColor('error-color') || s.accent.errorColor;
  s.accent.infoColor = getColor('info-color') || s.accent.infoColor;

  s.clipColors.video = getColor('clip-video') || s.clipColors.video;
  s.clipColors.audio = getColor('clip-audio') || s.clipColors.audio;
  s.clipColors.image = getColor('clip-image') || s.clipColors.image;
  s.clipColors.text = getColor('clip-text') || s.clipColors.text;
  s.clipColors.caption = getColor('clip-caption') || s.clipColors.caption;
  s.clipColors.shape = getColor('clip-shape') || s.clipColors.shape;
  s.clipColors.base = getColor('clip-base') || s.clipColors.base;

  s.timeline.rulerMajorTick = getColor('tl-ruler-major') || s.timeline.rulerMajorTick;
  s.timeline.rulerMinorTick = getColor('tl-ruler-minor') || s.timeline.rulerMinorTick;
  s.timeline.rulerText = getColor('tl-ruler-text') || s.timeline.rulerText;
  s.timeline.trackBg = getColor('tl-track-bg') || s.timeline.trackBg;
  s.timeline.trackAltBg = getColor('tl-track-alt') || s.timeline.trackAltBg;
  s.timeline.playheadColor = getColor('tl-playhead') || s.timeline.playheadColor;
  s.timeline.snapIndicatorColor = getColor('tl-snap') || s.timeline.snapIndicatorColor;
  if (getNum('tl-track-normal-h')) s.timeline.trackNormalHeight = getNum('tl-track-normal-h');
  if (getNum('tl-track-audio-h')) s.timeline.trackAudioHeight = getNum('tl-track-audio-h');
  if (getNum('tl-track-text-h')) s.timeline.trackTextHeight = getNum('tl-track-text-h');

  s.keyframes.keyframeColor = getColor('kf-color') || s.keyframes.keyframeColor;
  s.keyframes.keyframeSelected = getColor('kf-selected') || s.keyframes.keyframeSelected;
  s.keyframes.keyframeLine = getColor('kf-line') || s.keyframes.keyframeLine;
  if (getNum('kf-diamond')) s.keyframes.diamondSize = getNum('kf-diamond');
  if (getNum('kf-row-h')) s.keyframes.rowHeight = getNum('kf-row-h');
  if (getNum('kf-label-w')) s.keyframes.labelWidth = getNum('kf-label-w');
  if (getNum('kf-ruler-h')) s.keyframes.rulerHeight = getNum('kf-ruler-h');

  const ff = getStr('font-family');
  if (ff) s.typography.fontFamily = `${ff}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  if (getNum('font-size-base')) s.typography.baseFontSize = getNum('font-size-base');
  if (getNum('line-height')) s.typography.lineHeight = getNum('line-height');
  if (getNum('ruler-font-size')) s.typography.rulerFontSize = getNum('ruler-font-size');
  if (getNum('ui-font-size')) s.typography.uiFontSize = getNum('ui-font-size');

  if (getNum('edge-zone')) s.snapping.edgeZone = getNum('edge-zone');
  if (getNum('snap-frames')) s.snapping.snapThresholdFrames = getNum('snap-frames');
  if (getNum('curve-hit')) s.snapping.curvePointHitRadius = getNum('curve-hit');

  if (getNum('trans-hover') >= 0) s.transitions.hoverDuration = getNum('trans-hover');
  if (getNum('trans-opacity') >= 0) s.transitions.opacityDuration = getNum('trans-opacity');
  if (getNum('trans-layout') >= 0) s.transitions.layoutFlashDuration = getNum('trans-layout');
  if (getNum('trans-section') >= 0) s.transitions.sectionDuration = getNum('trans-section');

  return s;
}

let _modal: HTMLElement | null = null;
let _activeCat = 'appearance';
let _draft: EditorSettings = getSettings();

export function openSettingsPanel() {
  if (_modal) { _modal.remove(); _modal = null; }
  _draft = JSON.parse(JSON.stringify(getSettings()));
  _activeCat = 'appearance';

  const overlay = document.createElement('div');
  overlay.id = 'sp-overlay';
  overlay.innerHTML = buildModal();
  document.body.appendChild(overlay);
  _modal = overlay;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePanel();
  });

  overlay.querySelector('#sp-cancel')!.addEventListener('click', closePanel);
  overlay.querySelector('#sp-apply')!.addEventListener('click', () => {
    const saved = collectSettings(overlay, _draft);
    applySettings(saved);
    _draft = saved;
    closePanel();
  });
  overlay.querySelector('#sp-reset')!.addEventListener('click', () => {
    if (!confirm('Reset all settings to defaults?')) return;
    resetSettings();
    _draft = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    _activeCat = 'appearance';
    const newHTML = buildModal();
    overlay.innerHTML = newHTML;
    rebindEvents(overlay);
    bindCategoryNav(overlay);
    bindColorSync(overlay);
  });

  bindCategoryNav(overlay);
  bindColorSync(overlay);
}

function closePanel() {
  if (_modal) { _modal.remove(); _modal = null; }
}

function buildModal(): string {
  return `
    <div id="sp-modal" role="dialog" aria-modal="true" aria-label="Editor Settings">
      <div id="sp-sidebar">
        <div id="sp-sidebar-header">
          <div id="sp-sidebar-title">Editor Settings</div>
          <div id="sp-sidebar-sub">Configure your workspace</div>
        </div>
        <nav id="sp-nav">
          ${CATEGORIES.map(cat => `
            <button class="sp-nav-item${cat === _activeCat ? ' active' : ''}" data-cat="${cat}">
              <span class="sp-nav-icon">${CATEGORY_ICONS[cat]}</span>
              <span class="sp-nav-label">${CATEGORY_LABELS[cat]}</span>
            </button>
          `).join('')}
        </nav>
        <div id="sp-sidebar-footer">
          <button id="sp-reset" class="sp-btn-ghost">Reset Defaults</button>
        </div>
      </div>
      <div id="sp-content">
        <div id="sp-content-header">
          <div id="sp-content-title">${CATEGORY_LABELS[_activeCat]}</div>
          <div id="sp-content-desc">${CATEGORY_DESCRIPTIONS[_activeCat]}</div>
          <button id="sp-close" aria-label="Close">
            ${svgIcon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')}
          </button>
        </div>
        <div id="sp-body">
          ${renderCategoryContent(_activeCat, _draft)}
        </div>
        <div id="sp-footer">
          <button id="sp-cancel" class="sp-btn-secondary">Cancel</button>
          <button id="sp-apply" class="sp-btn-primary">Apply Changes</button>
        </div>
      </div>
    </div>
  `;
}

function rebindEvents(overlay: HTMLElement) {
  overlay.querySelector('#sp-cancel')!.addEventListener('click', closePanel);
  overlay.querySelector('#sp-apply')!.addEventListener('click', () => {
    const saved = collectSettings(overlay, _draft);
    applySettings(saved);
    _draft = saved;
    closePanel();
  });
  overlay.querySelector('#sp-reset')!.addEventListener('click', () => {
    if (!confirm('Reset all settings to defaults?')) return;
    resetSettings();
    _draft = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    overlay.innerHTML = buildModal();
    rebindEvents(overlay);
    bindCategoryNav(overlay);
    bindColorSync(overlay);
  });
  overlay.querySelector('#sp-close')!.addEventListener('click', closePanel);
}

function switchCategory(overlay: HTMLElement, cat: string) {
  _draft = collectSettings(overlay, _draft);
  _activeCat = cat;

  overlay.querySelectorAll('.sp-nav-item').forEach(b => {
    b.classList.toggle('active', (b as HTMLElement).dataset.cat === cat);
  });

  const body = overlay.querySelector('#sp-body') as HTMLElement;
  body.innerHTML = renderCategoryContent(cat, _draft);

  const title = overlay.querySelector('#sp-content-title') as HTMLElement;
  const desc = overlay.querySelector('#sp-content-desc') as HTMLElement;
  title.textContent = CATEGORY_LABELS[cat];
  desc.textContent = CATEGORY_DESCRIPTIONS[cat];

  bindColorSync(overlay);
}

function bindCategoryNav(overlay: HTMLElement) {
  overlay.querySelectorAll<HTMLButtonElement>('.sp-nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchCategory(overlay, btn.dataset.cat!));
  });
  const closeBtn = overlay.querySelector('#sp-close');
  if (closeBtn) closeBtn.addEventListener('click', closePanel);
}

function bindColorSync(overlay: HTMLElement) {
  overlay.querySelectorAll<HTMLInputElement>('.sp-color-native').forEach(native => {
    const id = native.dataset.field!;
    const textEl = overlay.querySelector<HTMLInputElement>(`[data-color-for="${id}"]`);
    const swatch = native.previousElementSibling as HTMLElement | null;

    native.addEventListener('input', () => {
      if (textEl) textEl.value = native.value;
      if (swatch) swatch.style.background = native.value;
    });

    if (textEl) {
      textEl.addEventListener('input', () => {
        const v = textEl.value.trim();
        if (swatch) swatch.style.background = v;
        const hex = rgbToHex(v);
        if (/^#[0-9a-f]{6}$/i.test(hex)) native.value = hex;
      });
    }
  });
}
