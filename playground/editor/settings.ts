export interface EditorSettings {
  appearance: {
    bgPrimary: string;
    bgSurface: string;
    bgPanel: string;
    bgHover: string;
    bgActive: string;
    bgSelected: string;
    borderPrimary: string;
    borderLight: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    previewBg: string;
    compositionBg: string;
  };
  accent: {
    accentColor: string;
    accentHover: string;
    accentDim: string;
    successColor: string;
    errorColor: string;
    infoColor: string;
  };
  clipColors: {
    video: string;
    audio: string;
    image: string;
    text: string;
    caption: string;
    shape: string;
    base: string;
  };
  timeline: {
    rulerMajorTick: string;
    rulerMinorTick: string;
    rulerText: string;
    rulerBg: string;
    trackNormalHeight: number;
    trackAudioHeight: number;
    trackTextHeight: number;
    playheadColor: string;
    snapIndicatorColor: string;
    trackBg: string;
    trackAltBg: string;
  };
  keyframes: {
    diamondSize: number;
    rowHeight: number;
    labelWidth: number;
    rulerHeight: number;
    keyframeColor: string;
    keyframeSelected: string;
    keyframeLine: string;
  };
  typography: {
    fontFamily: string;
    baseFontSize: number;
    lineHeight: number;
    rulerFontSize: number;
    uiFontSize: number;
  };
  snapping: {
    edgeZone: number;
    snapThresholdFrames: number;
    curvePointHitRadius: number;
  };
  transitions: {
    hoverDuration: number;
    opacityDuration: number;
    layoutFlashDuration: number;
    sectionDuration: number;
  };
}

export const DEFAULT_SETTINGS: EditorSettings = {
  appearance: {
    bgPrimary: '#0c1120',
    bgSurface: '#101928',
    bgPanel: '#142035',
    bgHover: '#1a2a42',
    bgActive: '#1f3050',
    bgSelected: 'rgba(232, 184, 75, 0.12)',
    borderPrimary: '#1a2b45',
    borderLight: '#243655',
    textPrimary: '#dde6f5',
    textSecondary: '#7a93bc',
    textTertiary: '#3d567a',
    previewBg: '#07101e',
    compositionBg: '#141416',
  },
  accent: {
    accentColor: '#e8b84b',
    accentHover: '#f5ca5a',
    accentDim: 'rgba(232, 184, 75, 0.15)',
    successColor: '#22c55e',
    errorColor: '#ef4444',
    infoColor: '#e8b84b',
  },
  clipColors: {
    video: '#3b7dd8',
    audio: '#22c55e',
    image: '#e59d2a',
    text: '#06b6d4',
    caption: '#f97316',
    shape: '#e05c8e',
    base: '#64748b',
  },
  timeline: {
    rulerMajorTick: '#55556a',
    rulerMinorTick: '#33333d',
    rulerText: '#8e8e9e',
    rulerBg: '#0c1120',
    trackNormalHeight: 44,
    trackAudioHeight: 30,
    trackTextHeight: 22,
    playheadColor: '#e8b84b',
    snapIndicatorColor: '#e8b84b',
    trackBg: '#101928',
    trackAltBg: '#0d1628',
  },
  keyframes: {
    diamondSize: 10,
    rowHeight: 24,
    labelWidth: 88,
    rulerHeight: 24,
    keyframeColor: '#e8b84b',
    keyframeSelected: '#f5ca5a',
    keyframeLine: '#3b7dd8',
  },
  typography: {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    baseFontSize: 12,
    lineHeight: 1.5,
    rulerFontSize: 10,
    uiFontSize: 11,
  },
  snapping: {
    edgeZone: 8,
    snapThresholdFrames: 2,
    curvePointHitRadius: 9,
  },
  transitions: {
    hoverDuration: 100,
    opacityDuration: 150,
    layoutFlashDuration: 50,
    sectionDuration: 200,
  },
};

const STORAGE_KEY = 'diffusionstudio-editor-settings';

let _current: EditorSettings = loadSettings();

function loadSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return deepClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    return deepMerge(deepClone(DEFAULT_SETTINGS), parsed);
  } catch {
    return deepClone(DEFAULT_SETTINGS);
  }
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge(base: EditorSettings, override: Partial<EditorSettings>): EditorSettings {
  const result = deepClone(base);
  for (const sectionKey of Object.keys(override) as Array<keyof EditorSettings>) {
    const ov = override[sectionKey];
    const bv = result[sectionKey];
    if (ov !== null && ov !== undefined && typeof ov === 'object' && !Array.isArray(ov) && typeof bv === 'object' && bv !== null) {
      (result as unknown as Record<string, unknown>)[sectionKey] = { ...bv as object, ...ov as object };
    } else if (ov !== undefined) {
      (result as unknown as Record<string, unknown>)[sectionKey] = ov;
    }
  }
  return result;
}

export function getSettings(): EditorSettings {
  return _current;
}

export function applySettings(s: EditorSettings) {
  _current = s;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  applyCSSVariables(s);
}

export function resetSettings() {
  _current = deepClone(DEFAULT_SETTINGS);
  localStorage.removeItem(STORAGE_KEY);
  applyCSSVariables(_current);
}

export function applyCSSVariables(s: EditorSettings) {
  const root = document.documentElement;
  const set = (k: string, v: string) => root.style.setProperty(k, v);

  set('--bg', s.appearance.bgPrimary);
  set('--bg-surface', s.appearance.bgSurface);
  set('--bg-panel', s.appearance.bgPanel);
  set('--bg-hover', s.appearance.bgHover);
  set('--bg-active', s.appearance.bgActive);
  set('--bg-selected', s.appearance.bgSelected);
  set('--border', s.appearance.borderPrimary);
  set('--border-light', s.appearance.borderLight);
  set('--text', s.appearance.textPrimary);
  set('--text-2', s.appearance.textSecondary);
  set('--text-3', s.appearance.textTertiary);
  set('--preview-bg', s.appearance.previewBg);

  set('--accent', s.accent.accentColor);
  set('--accent-hover', s.accent.accentHover);
  set('--accent-dim', s.accent.accentDim);
  set('--success', s.accent.successColor);
  set('--error', s.accent.errorColor);
  set('--info', s.accent.infoColor);

  set('--clip-video', s.clipColors.video);
  set('--clip-audio', s.clipColors.audio);
  set('--clip-image', s.clipColors.image);
  set('--clip-text', s.clipColors.text);
  set('--clip-caption', s.clipColors.caption);
  set('--clip-shape', s.clipColors.shape);

  set('--tl-ruler-major', s.timeline.rulerMajorTick);
  set('--tl-ruler-minor', s.timeline.rulerMinorTick);
  set('--tl-ruler-text', s.timeline.rulerText);
  set('--tl-playhead', s.timeline.playheadColor);
  set('--tl-snap', s.timeline.snapIndicatorColor);
  set('--tl-track-bg', s.timeline.trackBg);
  set('--tl-track-alt', s.timeline.trackAltBg);

  set('--kf-color', s.keyframes.keyframeColor);
  set('--kf-selected', s.keyframes.keyframeSelected);
  set('--kf-line', s.keyframes.keyframeLine);
  set('--kf-diamond', `${s.keyframes.diamondSize}px`);

  set('--font-family', s.typography.fontFamily);
  set('--font-size-base', `${s.typography.baseFontSize}px`);
  set('--line-height', String(s.typography.lineHeight));

  set('--transition-hover', `${s.transitions.hoverDuration}ms`);
  set('--transition-opacity', `${s.transitions.opacityDuration}ms`);
  set('--transition-layout', `${s.transitions.layoutFlashDuration}ms`);
  set('--transition-section', `${s.transitions.sectionDuration}ms`);
}

export function initSettings() {
  applyCSSVariables(_current);
}
