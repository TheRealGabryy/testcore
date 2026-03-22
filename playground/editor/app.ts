import * as core from '@diffusionstudio/core';
import { EditorState } from './state';
import { setupIconSidebar } from './icon-sidebar';
import { setupLeftPanel } from './left-panel';
import { setupPreview } from './preview';
import { setupTimeline } from './timeline';
import { setupRightPanel } from './right-panel';

export async function createEditor() {
  const composition = new core.Composition({ background: '#141416' });
  const state = new EditorState(composition);

  const iconSidebar = document.querySelector('#icon-sidebar') as HTMLElement;
  const leftPanel = document.querySelector('#left-panel') as HTMLElement;
  const playbackBar = document.querySelector('#playback-bar') as HTMLElement;
  const timelineControlsBar = document.querySelector('#timeline-controls-bar') as HTMLElement;
  const timelineArea = document.querySelector('#timeline-area') as HTMLElement;
  const rightPanel = document.querySelector('#right-panel') as HTMLElement;

  async function handleExport() {
    const progressEl = document.querySelector('#export-progress') as HTMLElement;
    const fillCircle = document.querySelector('#progress-fill-circle') as SVGCircleElement;
    const pctSpan = document.querySelector('#progress-pct') as HTMLSpanElement;
    const cancelBtn = document.querySelector('#cancel-export-btn') as HTMLButtonElement;

    const encoder = new core.Encoder(composition, { video: { fps: state.fps } });

    let cancelled = false;
    cancelBtn.onclick = () => {
      cancelled = true;
      encoder.cancel();
    };

    encoder.onProgress = (event) => {
      const { progress, total } = event;
      const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
      progressEl.style.display = 'block';
      pctSpan.textContent = `${pct}%`;
      const circumference = 201;
      fillCircle.style.strokeDashoffset = String(circumference - (circumference * pct) / 100);
    };

    try {
      if (!('showSaveFilePicker' in window)) {
        Object.assign(window, {
          showSaveFilePicker: async () => 'untitled_video.mp4',
        });
      }

      const fileHandle = await window.showSaveFilePicker({
        suggestedName: 'untitled_video.mp4',
        types: [{ description: 'Video File', accept: { 'video/mp4': ['.mp4'] } }],
      });

      await encoder.render(fileHandle);
    } catch (e) {
      if (e instanceof DOMException) {
        // user cancelled
      } else if (e instanceof core.EncoderError) {
        alert(e.message);
      } else if (!cancelled) {
        alert(String(e));
      }
    } finally {
      progressEl.style.display = 'none';
      fillCircle.style.strokeDashoffset = '201';
      pctSpan.textContent = '0%';
    }
  }

  async function handleLoadDemo() {
    if (!confirm('Load demo composition? This will clear the current project.')) return;

    const LAYER_COLORS = [
      '#3b7dd8', '#22c55e', '#e59d2a', '#06b6d4',
      '#f97316', '#e05c8e', '#a78bfa', '#34d399',
    ];
    const CLIP_COLORS: Record<string, string> = {
      VIDEO: '#3b7dd8', AUDIO: '#22c55e', IMAGE: '#e59d2a',
      TEXT: '#06b6d4', CAPTION: '#f97316', RECT: '#e05c8e',
      ELLIPSE: '#e05c8e', POLYGON: '#e05c8e', BASE: '#64748b',
    };

    composition.clear();
    state.editorLayers.length = 0;
    state.selectedClipId = null;
    state.selectedLayerId = null;
    state.emit('layers:change');
    state.emit('selection:change');

    try {
      const { main: demoMain } = await import('../composition');
      await demoMain(composition);
    } catch (err) {
      console.error('Demo failed to load:', err);
      alert('Demo failed to load. Check console for details.');
      state.emit('layers:change');
      state.emit('timeline:change');
      return;
    }

    const reversedLayers = [...composition.layers].reverse();
    for (const layer of reversedLayers) {
      const idx = state.editorLayers.length;
      const editorLayer = {
        id: layer.id,
        name: `Layer ${idx + 1}`,
        layer,
        clips: layer.clips.map(clip => ({
          id: clip.id,
          name: String(clip.type),
          clip,
          color: CLIP_COLORS[String(clip.type)] ?? '#64748b',
        })),
        visible: true,
        locked: false,
        color: LAYER_COLORS[idx % LAYER_COLORS.length],
      };
      state.editorLayers.push(editorLayer);
    }

    state.emit('layers:change');
    state.emit('timeline:change');
    await composition.seek(0);
  }

  const editorRoot = document.querySelector('#editor') as HTMLElement;
  function handleLayoutChange(id: string) {
    editorRoot.dataset.layout = id;
  }

  setupIconSidebar(iconSidebar, handleExport, handleLoadDemo, handleLayoutChange);
  setupLeftPanel(leftPanel, state, handleLoadDemo);
  setupPreview(playbackBar, state);
  setupTimeline(timelineControlsBar, timelineArea, state);
  setupRightPanel(rightPanel, state);
}
