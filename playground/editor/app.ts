import * as core from '@diffusionstudio/core';
import { EditorState } from './state';
import { setupIconSidebar } from './icon-sidebar';
import { setupLeftPanel } from './left-panel';
import { setupPreview } from './preview';
import { setupTimeline } from './timeline';
import { setupRightPanel } from './right-panel';
import { setupColorPanel } from './color-panel';
import { createColorGradingOverlay } from './color-grading';
import { setupAnimationPanel } from './animation-panel';
import { setupStudioColorsPanel } from './studio-colors-panel';
import { initSettings, getSettings as _getSettings } from './settings';
import { openSettingsPanel } from './settings-panel';
import { openExportPanel, runExport } from './export-panel';
import { setupMicroScrub } from './micro-scrub';

export interface EditorConfig {
  onBack: () => void;
  onSave: (composition: core.Composition, state: EditorState) => void;
}

export interface EditorHandle {
  composition: core.Composition;
  state: EditorState;
  applyProjectMeta: (width: number, height: number, background: string) => void;
  resetEditor: () => void;
}

export async function createEditor(config: EditorConfig): Promise<EditorHandle> {
  initSettings();

  const composition = new core.Composition({ background: '#141416' });
  const state = new EditorState(composition);

  const iconSidebar = document.querySelector('#icon-sidebar') as HTMLElement;
  const leftPanel = document.querySelector('#left-panel') as HTMLElement;
  const playbackBar = document.querySelector('#playback-bar') as HTMLElement;
  const timelineControlsBar = document.querySelector('#timeline-controls-bar') as HTMLElement;
  const timelineArea = document.querySelector('#timeline-area') as HTMLElement;
  const rightPanel = document.querySelector('#right-panel') as HTMLElement;
  const colorPanel = document.querySelector('#color-panel') as HTMLElement;
  const playerEl = document.querySelector('#player') as HTMLElement;
  const kfPropsPanel = document.querySelector('#keyframe-props-panel') as HTMLElement;
  const kfTimelineSection = document.querySelector('#keyframe-timeline-section') as HTMLElement;
  const studioColorsPanel = document.querySelector('#studio-colors-panel') as HTMLElement;
  const microScrubSection = document.querySelector('#micro-scrub-section') as HTMLElement;

  function handleExport() {
    openExportPanel(state, (exportConfig) => {
      runExport(composition, exportConfig, state);
    });
  }

  async function handleLoadDemo() {
    if (!confirm('Load demo composition? This will clear the current project.')) return;

    const _sett = _getSettings();
    const _c = _sett.clipColors;
    const LAYER_COLORS = [
      '#3b7dd8', '#22c55e', '#e59d2a', '#06b6d4',
      '#f97316', '#e05c8e', '#a78bfa', '#34d399',
    ];
    const CLIP_COLORS: Record<string, string> = {
      VIDEO: _c.video, AUDIO: _c.audio, IMAGE: _c.image,
      TEXT: _c.text, CAPTION: _c.caption, RECT: _c.shape,
      ELLIPSE: _c.shape, POLYGON: _c.shape, BASE: _c.base,
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
  const layoutFlash = document.querySelector('#layout-flash') as HTMLElement;

  function handleLayoutChange(id: string) {
    layoutFlash.style.opacity = '1';
    setTimeout(() => {
      editorRoot.dataset.layout = id;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          layoutFlash.style.opacity = '0';
        });
      });
    }, 50);
  }

  const gradingOverlay = createColorGradingOverlay(playerEl, () => {
    const sel = state.getSelectedClip();
    if (!sel) return null;
    return state.colorGradingMap.get(sel.editorClip.id) ?? null;
  });

  function handleSave() {
    config.onSave(composition, state);
    showSavedToast();
  }

  function handleBack() {
    editorRoot.dataset.layout = 'edit';
    config.onBack();
  }

  setupIconSidebar(iconSidebar, handleExport, handleLoadDemo, handleLayoutChange, openSettingsPanel, handleBack, handleSave);
  setupLeftPanel(leftPanel, state, handleLoadDemo);
  setupPreview(playbackBar, state);
  setupTimeline(timelineControlsBar, timelineArea, state);
  setupRightPanel(rightPanel, state);
  setupColorPanel(colorPanel, state, () => {
    gradingOverlay.update();
    state.emit('grading:change');
  });
  setupAnimationPanel(kfPropsPanel, kfTimelineSection, state);
  setupMicroScrub(microScrubSection, state);
  setupStudioColorsPanel(studioColorsPanel, state, () => {
    gradingOverlay.update();
    state.emit('grading:change');
  });

  return {
    composition,
    state,
    applyProjectMeta(width: number, height: number, background: string) {
      try {
        composition.resize(width, height);
      } catch {
        /* ignore */
      }
      try {
        (composition as unknown as Record<string, unknown>)['background'] = background;
      } catch {
        /* ignore */
      }
    },
    resetEditor() {
      composition.clear();
      state.editorLayers.length = 0;
      state.selectedClipId = null;
      state.selectedLayerId = null;
      state.emit('layers:change');
      state.emit('selection:change');
      state.emit('timeline:change');
      composition.seek(0).catch(() => { /* ignore */ });
    },
  };
}

function showSavedToast() {
  let toast = document.getElementById('save-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'save-toast';
    toast.className = 'save-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = 'Project saved';
  toast.classList.add('save-toast--visible');
  setTimeout(() => toast!.classList.remove('save-toast--visible'), 2000);
}
