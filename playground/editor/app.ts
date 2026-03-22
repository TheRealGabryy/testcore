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
    composition.clear();
    state.editorLayers.length = 0;
    state.selectedClipId = null;
    state.selectedLayerId = null;
    state.emit('layers:change');
    state.emit('selection:change');

    const { main: demoMain } = await import('../composition');

    await demoMain(composition);

    for (const layer of composition.layers) {
      const editorLayer = {
        id: layer.id,
        name: `Layer ${state.editorLayers.length + 1}`,
        layer,
        clips: layer.clips.map(clip => ({
          id: clip.id,
          name: clip.type,
          clip,
          color: '#3b7dd8',
        })),
        visible: true,
        locked: false,
        color: '#3b7dd8',
      };
      state.editorLayers.push(editorLayer);
    }

    state.emit('layers:change');
    state.emit('timeline:change');
  }

  setupIconSidebar(iconSidebar, handleExport, handleLoadDemo);
  setupLeftPanel(leftPanel, state);
  setupPreview(playbackBar, state);
  setupTimeline(timelineControlsBar, timelineArea, state);
  setupRightPanel(rightPanel, state);
}
