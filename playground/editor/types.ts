import type * as core from '@diffusionstudio/core';

export interface EditorClip {
  id: string;
  name: string;
  clip: core.Clip;
  color: string;
  speed?: number;
  originalDuration?: number;
}

export interface EditorLayer {
  id: string;
  name: string;
  layer: core.Layer;
  clips: EditorClip[];
  visible: boolean;
  locked: boolean;
  color: string;
}

export interface MediaItem {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  source: core.BaseSource;
  objectUrl?: string;
}
