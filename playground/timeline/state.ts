import type * as core from '@diffusionstudio/core';
import type { EditorLayer } from '../editor/types';

export interface TLClip {
  id: string;
  name: string;
  start: number;
  duration: number;
  color: string;
  type: string;
  clipRef: core.Clip;
}

export interface TLTrack {
  id: string;
  label: string;
  type: 'video' | 'audio';
  clips: TLClip[];
  muted: boolean;
  locked: boolean;
  solo: boolean;
}

type TLHandler = (data?: unknown) => void;

export class TimelineState {
  currentTime = 0;
  duration = 0;
  tracks: TLTrack[] = [];
  playing = false;

  private handlers = new Map<string, TLHandler[]>();

  on(event: string, fn: TLHandler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(fn);
    return () => {
      const arr = this.handlers.get(event);
      if (arr) { const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1); }
    };
  }

  emit(event: string, data?: unknown): void {
    this.handlers.get(event)?.forEach(fn => fn(data));
  }

  setCurrentTime(t: number): void {
    this.currentTime = Math.max(0, Math.min(t, this.duration || t));
    this.emit('time:change', this.currentTime);
  }

  setDuration(d: number): void {
    this.duration = d;
    this.emit('duration:change', d);
  }

  setPlaying(p: boolean): void {
    this.playing = p;
    this.emit('playing:change', p);
  }

  syncFromEditor(editorLayers: EditorLayer[], compositionDuration: number): void {
    const CLIP_COLORS: Record<string, string> = {
      VIDEO: '#3d69a8', AUDIO: '#2d7d4a', IMAGE: '#8b6914',
      TEXT: '#1d6b7a', CAPTION: '#7a4d1d', RECT: '#7a1d5e',
      ELLIPSE: '#7a1d5e', POLYGON: '#7a1d5e', BASE: '#4a4a4a',
    };

    this.tracks = editorLayers.map((el, i) => {
      const firstClip = el.clips[0];
      const trackType: 'video' | 'audio' =
        (firstClip?.clip.type === 'AUDIO') ? 'audio' : 'video';
      const idx = i + 1;
      const label = trackType === 'video' ? `V${idx}` : `A${idx}`;

      // preserve muted/locked from existing track if present
      const existing = this.tracks.find(t => t.id === el.id);

      return {
        id: el.id,
        label,
        type: trackType,
        muted: existing?.muted ?? false,
        locked: existing?.locked ?? false,
        solo: existing?.solo ?? false,
        clips: el.clips.map(ec => ({
          id: ec.id,
          name: ec.name,
          start: ec.clip.delay,
          duration: ec.clip.duration,
          color: CLIP_COLORS[ec.clip.type] ?? '#4a4a4a',
          type: ec.clip.type,
          clipRef: ec.clip,
        })),
      };
    });

    this.setDuration(compositionDuration || 30);
    this.emit('tracks:change');
  }

  updateClipStart(clipId: string, newStart: number): void {
    for (const track of this.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) {
        clip.start = Math.max(0, newStart);
        clip.clipRef.delay = clip.start;
        this.emit('tracks:change');
        return;
      }
    }
  }
}
