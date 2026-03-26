import * as core from '@diffusionstudio/core';
import type { EditorState } from '../editor/state';
import type { ProjectData, ProjectMeta, SerializedClip, SerializedLayer } from './types';

const STORAGE_KEY = 'ds-projects-v1';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function listProjects(): ProjectMeta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as ProjectData[];
    return all
      .map(p => ({
        id: p.id,
        name: p.name,
        width: p.width,
        height: p.height,
        background: p.background,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        thumbnail: p.thumbnail,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function loadProject(id: string): ProjectData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as ProjectData[];
    return all.find(p => p.id === id) ?? null;
  } catch {
    return null;
  }
}

export function createProject(name: string, width: number, height: number): ProjectData {
  const now = Date.now();
  const project: ProjectData = {
    id: generateId(),
    name,
    width,
    height,
    background: '#141416',
    createdAt: now,
    updatedAt: now,
    thumbnail: '',
    layers: [],
    clips: {},
    zoom: 80,
    colorGrading: {},
  };
  persistProject(project);
  return project;
}

export function saveProject(projectId: string, state: EditorState, composition: core.Composition): void {
  const existing = loadProject(projectId);
  if (!existing) return;

  const { layers, clips, colorGrading } = serializeEditorState(state);
  const thumbnail = captureThumb(composition);

  const updated: ProjectData = {
    ...existing,
    background: (composition as unknown as Record<string, unknown>).background as string ?? '#141416',
    width: composition.width,
    height: composition.height,
    updatedAt: Date.now(),
    thumbnail,
    layers,
    clips,
    zoom: state.zoom,
    colorGrading,
  };

  persistProject(updated);
}

export function deleteProject(id: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const all = (JSON.parse(raw) as ProjectData[]).filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function updateProjectMeta(id: string, partial: Partial<Pick<ProjectMeta, 'name'>>): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const all = JSON.parse(raw) as ProjectData[];
    const idx = all.findIndex(p => p.id === id);
    if (idx < 0) return;
    all[idx] = { ...all[idx], ...partial, updatedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function persistProject(project: ProjectData): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: ProjectData[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      all[idx] = project;
    } else {
      all.push(project);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    console.warn('Failed to persist project to localStorage');
  }
}

function captureThumb(composition: core.Composition): string {
  try {
    return composition.screenshot('jpeg', 0.6);
  } catch {
    return '';
  }
}

const COMMON_PROPS = [
  'x', 'y', 'rotation', 'opacity', 'scaleX', 'scaleY',
  'translateX', 'translateY', 'blendMode', 'anchorX', 'anchorY',
];

function serializeEditorState(state: EditorState): {
  layers: SerializedLayer[];
  clips: Record<string, SerializedClip[]>;
  colorGrading: Record<string, unknown>;
} {
  const layers: SerializedLayer[] = [];
  const clips: Record<string, SerializedClip[]> = {};

  for (const el of state.editorLayers) {
    layers.push({
      coreId: el.id,
      name: el.name,
      color: el.color,
      visible: el.visible,
      locked: el.locked,
    });

    clips[el.id] = el.clips.map(ec => {
      const clip = ec.clip as unknown as Record<string, unknown>;
      const type = String(ec.clip.type);
      const serialized: SerializedClip = {
        coreId: ec.id,
        name: ec.name,
        color: ec.color,
        type,
        delay: (clip['delay'] as number) ?? 0,
        duration: (clip['duration'] as number) ?? 5,
        props: {},
      };

      const source = clip['source'] as Record<string, unknown> | undefined;
      if (source?.input && typeof source.input === 'string') {
        serialized.sourceInput = source.input;
      }

      const props: Record<string, unknown> = {};

      for (const key of COMMON_PROPS) {
        if (clip[key] !== undefined) props[key] = clip[key];
      }

      if (type === 'TEXT') {
        for (const key of ['text', 'fontSize', 'align', 'baseline', 'color', 'casing',
          'fontWeight', 'fontFamily', 'letterSpacing', 'lineHeight',
          'strokeColor', 'strokeWidth', 'shadowColor', 'shadowBlur',
          'shadowOffsetX', 'shadowOffsetY', 'backgroundFill', 'backgroundPadding',
          'backgroundRadius', 'width', 'height', 'wrap']) {
          if (clip[key] !== undefined) props[key] = clip[key];
        }
      }

      if (type === 'RECT' || type === 'RECTANGLE') {
        for (const key of ['width', 'height', 'fill', 'radius',
          'strokeColor', 'strokeWidth']) {
          if (clip[key] !== undefined) props[key] = clip[key];
        }
      }

      if (type === 'ELLIPSE') {
        for (const key of ['fill', 'radius', 'rx', 'ry',
          'strokeColor', 'strokeWidth', 'width', 'height']) {
          if (clip[key] !== undefined) props[key] = clip[key];
        }
      }

      if (type === 'POLYGON') {
        for (const key of ['fill', 'sides', 'radius', 'strokeColor', 'strokeWidth',
          'width', 'height']) {
          if (clip[key] !== undefined) props[key] = clip[key];
        }
      }

      if (type === 'AUDIO' || type === 'VIDEO') {
        for (const key of ['volume', 'range', 'muted', 'position']) {
          if (clip[key] !== undefined) props[key] = clip[key];
        }
      }

      if (type === 'IMAGE') {
        for (const key of ['width', 'height', 'fit']) {
          if (clip[key] !== undefined) props[key] = clip[key];
        }
      }

      if (Array.isArray(clip['effects']) && (clip['effects'] as unknown[]).length > 0) {
        props['effects'] = clip['effects'];
      }

      if (Array.isArray(clip['animations']) && (clip['animations'] as unknown[]).length > 0) {
        props['animations'] = clip['animations'];
      }

      serialized.props = props;
      return serialized;
    });
  }

  const colorGrading: Record<string, unknown> = {};
  for (const [clipId, grading] of state.colorGradingMap) {
    colorGrading[clipId] = grading;
  }

  return { layers, clips, colorGrading };
}

const LAYER_COLORS = [
  '#3b7dd8', '#22c55e', '#e59d2a', '#06b6d4',
  '#f97316', '#e05c8e', '#a78bfa', '#34d399',
];

export async function restoreProjectState(
  project: ProjectData,
  composition: core.Composition,
  state: EditorState
): Promise<void> {
  composition.clear();
  state.editorLayers.length = 0;
  state.colorGradingMap.clear();
  state.selectedClipId = null;
  state.selectedLayerId = null;
  state.zoom = project.zoom ?? 80;

  const oldToNewClipId = new Map<string, string>();

  for (let li = 0; li < project.layers.length; li++) {
    const layerData = project.layers[li];
    const layer = new core.Layer();
    await composition.add(layer);

    if (!layerData.visible) {
      (layer as unknown as Record<string, unknown>)['disabled'] = true;
    }

    const editorLayer = {
      id: layer.id,
      name: layerData.name,
      color: layerData.color || LAYER_COLORS[li % LAYER_COLORS.length],
      layer,
      clips: [] as import('../editor/types').EditorClip[],
      visible: layerData.visible,
      locked: layerData.locked,
    };

    const clipDataList = project.clips[layerData.coreId] ?? [];
    for (const clipData of clipDataList) {
      const clip = await recreateClip(clipData);
      if (!clip) continue;
      try {
        await layer.add(clip);
        oldToNewClipId.set(clipData.coreId, clip.id);
        editorLayer.clips.push({
          id: clip.id,
          name: clipData.name,
          clip,
          color: clipData.color,
        });
      } catch {
        /* skip unrestorable clips */
      }
    }

    state.editorLayers.push(editorLayer);
  }

  if (project.colorGrading) {
    for (const [oldClipId, grading] of Object.entries(project.colorGrading)) {
      const newClipId = oldToNewClipId.get(oldClipId);
      if (newClipId && grading) {
        state.colorGradingMap.set(newClipId, grading as import('../editor/color-grading').ColorGrading);
      }
    }
  }

  state.emit('layers:change');
  state.emit('timeline:change');
  await composition.seek(0);
}

function applyPropsToClip(clip: core.Clip, props: Record<string, unknown>): void {
  const c = clip as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(props)) {
    try {
      c[key] = value;
    } catch {
      /* skip read-only or unsupported properties */
    }
  }
}

async function recreateClip(data: SerializedClip): Promise<core.Clip | null> {
  const p = data.props;
  const timing: Record<string, unknown> = {};
  if (data.delay > 0) timing['delay'] = data.delay;
  if (data.duration > 0) timing['duration'] = data.duration;

  try {
    let clip: core.Clip | null = null;

    switch (data.type) {
      case 'TEXT':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clip = new core.TextClip({
          ...timing,
          text: String(p['text'] ?? ''),
          x: (p['x'] as string | number) ?? '50%',
          y: (p['y'] as string | number) ?? '50%',
          fontSize: Number(p['fontSize'] ?? 12),
          align: (p['align'] as 'left' | 'center' | 'right') ?? 'center',
          baseline: (p['baseline'] as 'top' | 'middle' | 'bottom') ?? 'middle',
        } as any);
        break;

      case 'RECT':
      case 'RECTANGLE':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clip = new core.RectangleClip({
          ...timing,
          x: (p['x'] as string | number) ?? '50%',
          y: (p['y'] as string | number) ?? '50%',
          width: (p['width'] as number) ?? 200,
          height: (p['height'] as number) ?? 100,
          fill: String(p['fill'] ?? '#ff0000'),
          radius: Number(p['radius'] ?? 0),
        } as any);
        break;

      case 'ELLIPSE':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clip = new core.EllipseClip({
          ...timing,
          x: (p['x'] as string | number) ?? '50%',
          y: (p['y'] as string | number) ?? '50%',
          fill: String(p['fill'] ?? '#ff0000'),
          radius: Number(p['radius'] ?? 100),
        } as any);
        break;

      case 'VIDEO': {
        if (!data.sourceInput) return null;
        const src = await core.Source.from<core.VideoSource>(data.sourceInput);
        clip = new core.VideoClip(src, timing as any);
        break;
      }

      case 'IMAGE': {
        if (!data.sourceInput) return null;
        const src = await core.Source.from<core.ImageSource>(data.sourceInput);
        clip = new core.ImageClip(src, timing as any);
        break;
      }

      case 'AUDIO': {
        if (!data.sourceInput) return null;
        const src = await core.Source.from<core.AudioSource>(data.sourceInput);
        clip = new core.AudioClip(src, timing as any);
        break;
      }

      default:
        return null;
    }

    if (clip) {
      applyPropsToClip(clip, p);
    }

    return clip;
  } catch {
    return null;
  }
}
