import * as core from '@diffusionstudio/core';
import type { EditorClip, EditorLayer, MediaItem } from './types';
import type { ColorGrading } from './color-grading';
import { getSettings } from './settings';

const VISUAL_CLIP_TYPES = new Set(['VIDEO', 'IMAGE', 'TEXT', 'RECT', 'ELLIPSE', 'POLYGON', 'CAPTION']);

function getClipColor(type: string): string {
  const c = getSettings().clipColors;
  const map: Record<string, string> = {
    VIDEO: c.video, AUDIO: c.audio, IMAGE: c.image,
    TEXT: c.text, CAPTION: c.caption,
    RECT: c.shape, ELLIPSE: c.shape, POLYGON: c.shape,
    BASE: c.base,
  };
  return map[type] ?? c.base;
}

const LAYER_COLORS = [
  '#3b7dd8', '#22c55e', '#e59d2a', '#06b6d4',
  '#f97316', '#e05c8e', '#a78bfa', '#34d399',
];

type Handler = (data?: unknown) => void;

export class EditorState {
  composition: core.Composition;
  editorLayers: EditorLayer[] = [];
  mediaItems: MediaItem[] = [];
  selectedClipId: string | null = null;
  selectedLayerId: string | null = null;
  zoom = 80;
  fps = 30;
  colorGradingMap = new Map<string, ColorGrading>();

  private handlers = new Map<string, Handler[]>();

  constructor(composition: core.Composition) {
    this.composition = composition;
  }

  on(event: string, fn: Handler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(fn);
    return () => {
      const arr = this.handlers.get(event);
      if (arr) {
        const i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
      }
    };
  }

  emit(event: string, data?: unknown) {
    this.handlers.get(event)?.forEach(fn => fn(data));
  }

  async addLayer(name?: string): Promise<EditorLayer> {
    const layer = new core.Layer();
    await this.composition.add(layer);
    const editorLayer: EditorLayer = {
      id: layer.id,
      name: name ?? `Layer ${this.editorLayers.length + 1}`,
      layer,
      clips: [],
      visible: true,
      locked: false,
      color: LAYER_COLORS[this.editorLayers.length % LAYER_COLORS.length],
    };
    this.editorLayers.push(editorLayer);
    this.emit('layers:change');
    return editorLayer;
  }

  async addClipToLayer(layerId: string, clip: core.Clip, name?: string): Promise<void> {
    const editorLayer = this.editorLayers.find(l => l.id === layerId);
    if (!editorLayer || editorLayer.locked) return;
    await editorLayer.layer.add(clip);
    if (VISUAL_CLIP_TYPES.has(clip.type)) {
      const raw = clip as unknown as Record<string, unknown>;
      if (typeof raw['anchorX'] !== 'number' || raw['anchorX'] === 0) raw['anchorX'] = 0.5;
      if (typeof raw['anchorY'] !== 'number' || raw['anchorY'] === 0) raw['anchorY'] = 0.5;
    }
    const editorClip: EditorClip = {
      id: clip.id,
      name: name ?? clip.type,
      clip,
      color: getClipColor(String(clip.type)),
    };
    editorLayer.clips.push(editorClip);
    this.emit('layers:change');
    this.emit('timeline:change');
  }

  async deleteSelectedClip(): Promise<void> {
    if (!this.selectedClipId) return;
    for (const editorLayer of this.editorLayers) {
      const idx = editorLayer.clips.findIndex(c => c.id === this.selectedClipId);
      if (idx < 0) continue;
      const editorClip = editorLayer.clips[idx];
      try { await (editorLayer.layer as any).remove(editorClip.clip); } catch { /* ignore */ }
      editorLayer.clips.splice(idx, 1);
      this.selectedClipId = null;
      this.emit('selection:change', null);
      this.emit('layers:change');
      this.emit('timeline:change');
      return;
    }
  }

  removeLayer(layerId: string) {
    const idx = this.editorLayers.findIndex(l => l.id === layerId);
    if (idx < 0) return;
    this.editorLayers.splice(idx, 1);
    if (this.selectedLayerId === layerId) this.selectedLayerId = null;
    this.emit('layers:change');
    this.emit('timeline:change');
  }

  toggleLayerVisibility(layerId: string) {
    const editorLayer = this.editorLayers.find(l => l.id === layerId);
    if (!editorLayer) return;
    editorLayer.visible = !editorLayer.visible;
    editorLayer.layer.disabled = !editorLayer.visible;
    this.emit('layers:change');
    this.emit('timeline:change');
  }

  selectClip(id: string | null) {
    this.selectedClipId = id;
    this.emit('selection:change', id);
  }

  selectLayer(id: string | null) {
    this.selectedLayerId = id;
    this.emit('selection:change', id);
  }

  addMediaItem(item: MediaItem) {
    this.mediaItems.push(item);
    this.emit('media:change');
  }

  getSelectedClip(): { editorClip: EditorClip; editorLayer: EditorLayer } | null {
    if (!this.selectedClipId) return null;
    for (const editorLayer of this.editorLayers) {
      const editorClip = editorLayer.clips.find(c => c.id === this.selectedClipId);
      if (editorClip) return { editorClip, editorLayer };
    }
    return null;
  }

  setZoom(zoom: number) {
    this.zoom = Math.max(20, Math.min(600, zoom));
    this.emit('zoom:change');
  }
}
