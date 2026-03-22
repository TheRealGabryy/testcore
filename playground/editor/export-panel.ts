import * as core from '@diffusionstudio/core';
import type { EditorState } from './state';

export interface ExportConfig {
  filename: string;
  format: 'mp4' | 'webm';
  quality: 'draft' | 'standard' | 'high' | 'maximum';
  fps: number;
  resolution: number;
  videoCodec: string;
  audioEnabled: boolean;
  audioBitrate: number;
}

const QUALITY_PRESETS: Record<string, { label: string; bitrate: number; hint: string }> = {
  draft:    { label: 'Draft',    bitrate: 2_000_000,  hint: '2 Mbps' },
  standard: { label: 'Standard', bitrate: 8_000_000,  hint: '8 Mbps' },
  high:     { label: 'High',     bitrate: 20_000_000, hint: '20 Mbps' },
  maximum:  { label: 'Maximum',  bitrate: 50_000_000, hint: '50 Mbps' },
};

const DEFAULT_CONFIG: ExportConfig = {
  filename: 'untitled_video',
  format: 'mp4',
  quality: 'high',
  fps: 30,
  resolution: 1,
  videoCodec: 'auto',
  audioEnabled: true,
  audioBitrate: 128_000,
};

function svgIcon(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return m > 0 ? `${m}m ${s}s` : `${s}.${ms}s`;
}

function estimateSize(bitrate: number, durationSecs: number, audioEnabled: boolean): string {
  const videoBits = bitrate * durationSecs;
  const audioBits = audioEnabled ? 128_000 * durationSecs : 0;
  const bytes = (videoBits + audioBits) / 8;
  if (bytes < 1024 * 1024) return `~${(bytes / 1024).toFixed(0)} KB`;
  return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

let _modal: HTMLElement | null = null;
let _config: ExportConfig = { ...DEFAULT_CONFIG };

export function openExportPanel(
  state: EditorState,
  onExport: (config: ExportConfig) => void
) {
  if (_modal) { _modal.remove(); _modal = null; }

  const overlay = document.createElement('div');
  overlay.id = 'ep-overlay';
  document.body.appendChild(overlay);
  _modal = overlay;

  const duration = (state.composition as any).duration ?? 0;
  const compositionWidth = (state.composition as any).width ?? 1920;
  const compositionHeight = (state.composition as any).height ?? 1080;

  function getQualityBitrate(): number {
    return QUALITY_PRESETS[_config.quality].bitrate;
  }

  function renderModal() {
    const resWidth = Math.round(compositionWidth * _config.resolution);
    const resHeight = Math.round(compositionHeight * _config.resolution);
    const estSize = estimateSize(getQualityBitrate(), duration, _config.audioEnabled);
    const durStr = formatDuration(duration);

    overlay.innerHTML = `
      <div id="ep-modal" role="dialog" aria-modal="true" aria-label="Export">
        <div id="ep-header">
          <div id="ep-header-left">
            <div id="ep-title">
              ${svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>')}
              Export
            </div>
            <div id="ep-subtitle">Render and download your composition</div>
          </div>
          <button id="ep-close" aria-label="Close">
            ${svgIcon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')}
          </button>
        </div>

        <div id="ep-body">
          <div class="ep-section">
            <label class="ep-label" for="ep-filename">Filename</label>
            <div class="ep-filename-row">
              <input type="text" id="ep-filename" class="ep-input" value="${_config.filename}" spellcheck="false" />
              <span class="ep-ext">.${_config.format}</span>
            </div>
          </div>

          <div class="ep-section">
            <div class="ep-label">Quality</div>
            <div class="ep-quality-grid">
              ${Object.entries(QUALITY_PRESETS).map(([key, preset]) => `
                <button class="ep-quality-btn${_config.quality === key ? ' active' : ''}" data-quality="${key}">
                  <span class="ep-quality-name">${preset.label}</span>
                  <span class="ep-quality-hint">${preset.hint}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="ep-grid-2">
            <div class="ep-section">
              <div class="ep-label">Format</div>
              <div class="ep-btn-group">
                <button class="ep-opt-btn${_config.format === 'mp4' ? ' active' : ''}" data-format="mp4">MP4</button>
                <button class="ep-opt-btn${_config.format === 'webm' ? ' active' : ''}" data-format="webm">WebM</button>
              </div>
            </div>

            <div class="ep-section">
              <div class="ep-label">Frame Rate</div>
              <div class="ep-btn-group">
                ${[15, 24, 25, 30, 60].map(fps => `
                  <button class="ep-opt-btn${_config.fps === fps ? ' active' : ''}" data-fps="${fps}">${fps}</button>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="ep-grid-2">
            <div class="ep-section">
              <div class="ep-label">Resolution</div>
              <div class="ep-btn-group">
                ${[0.5, 1, 2].map(r => `
                  <button class="ep-opt-btn${_config.resolution === r ? ' active' : ''}" data-res="${r}">${r}x</button>
                `).join('')}
              </div>
              <div class="ep-dim">${resWidth} × ${resHeight}</div>
            </div>

            <div class="ep-section">
              <div class="ep-label">Video Codec</div>
              <select id="ep-codec" class="ep-select">
                <option value="auto"${_config.videoCodec === 'auto' ? ' selected' : ''}>Auto (recommended)</option>
                <option value="avc"${_config.videoCodec === 'avc' ? ' selected' : ''}>H.264 (AVC)</option>
                <option value="hevc"${_config.videoCodec === 'hevc' ? ' selected' : ''}>H.265 (HEVC)</option>
                <option value="vp9"${_config.videoCodec === 'vp9' ? ' selected' : ''}>VP9</option>
                <option value="av1"${_config.videoCodec === 'av1' ? ' selected' : ''}>AV1</option>
              </select>
            </div>
          </div>

          <div class="ep-section">
            <div class="ep-audio-row">
              <div class="ep-label">Audio</div>
              <label class="ep-toggle">
                <input type="checkbox" id="ep-audio-toggle" ${_config.audioEnabled ? 'checked' : ''}/>
                <span class="ep-toggle-track"></span>
              </label>
            </div>
            <div class="ep-audio-details${_config.audioEnabled ? '' : ' ep-disabled'}">
              <span>AAC · 48 kHz · Stereo ·</span>
              <div class="ep-btn-group ep-inline">
                ${[64_000, 128_000, 192_000, 320_000].map(br => `
                  <button class="ep-opt-btn ep-sm${_config.audioBitrate === br ? ' active' : ''}" data-abr="${br}">${br/1000}k</button>
                `).join('')}
              </div>
            </div>
          </div>

          <div id="ep-info-bar">
            <span class="ep-info-item">
              ${svgIcon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>')}
              ${durStr}
            </span>
            <span class="ep-info-sep">·</span>
            <span class="ep-info-item">
              ${svgIcon('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>')}
              ${resWidth}×${resHeight} · ${_config.fps}fps
            </span>
            <span class="ep-info-sep">·</span>
            <span class="ep-info-item">
              ${svgIcon('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>')}
              ${estSize}
            </span>
          </div>
        </div>

        <div id="ep-footer">
          <button id="ep-cancel" class="ep-btn-secondary">Cancel</button>
          <button id="ep-export" class="ep-btn-primary">
            ${svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>')}
            Export Video
          </button>
        </div>
      </div>
    `;

    bindEvents();
  }

  function closePanel() {
    if (_modal) { _modal.remove(); _modal = null; }
  }

  function bindEvents() {
    overlay.querySelector('#ep-close')!.addEventListener('click', closePanel);
    overlay.querySelector('#ep-cancel')!.addEventListener('click', closePanel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePanel();
    });

    const filenameInput = overlay.querySelector('#ep-filename') as HTMLInputElement;
    filenameInput.addEventListener('input', () => {
      _config.filename = filenameInput.value.trim() || 'untitled_video';
    });

    overlay.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach(btn => {
      btn.addEventListener('click', () => {
        _config.quality = btn.dataset.quality as ExportConfig['quality'];
        renderModal();
      });
    });

    overlay.querySelectorAll<HTMLButtonElement>('[data-format]').forEach(btn => {
      btn.addEventListener('click', () => {
        _config.format = btn.dataset.format as 'mp4' | 'webm';
        renderModal();
      });
    });

    overlay.querySelectorAll<HTMLButtonElement>('[data-fps]').forEach(btn => {
      btn.addEventListener('click', () => {
        _config.fps = parseInt(btn.dataset.fps!);
        renderModal();
      });
    });

    overlay.querySelectorAll<HTMLButtonElement>('[data-res]').forEach(btn => {
      btn.addEventListener('click', () => {
        _config.resolution = parseFloat(btn.dataset.res!);
        renderModal();
      });
    });

    overlay.querySelectorAll<HTMLButtonElement>('[data-abr]').forEach(btn => {
      btn.addEventListener('click', () => {
        _config.audioBitrate = parseInt(btn.dataset.abr!);
        renderModal();
      });
    });

    const codecSelect = overlay.querySelector('#ep-codec') as HTMLSelectElement;
    codecSelect.addEventListener('change', () => {
      _config.videoCodec = codecSelect.value;
    });

    const audioToggle = overlay.querySelector('#ep-audio-toggle') as HTMLInputElement;
    audioToggle.addEventListener('change', () => {
      _config.audioEnabled = audioToggle.checked;
      renderModal();
    });

    overlay.querySelector('#ep-export')!.addEventListener('click', () => {
      const filenameInput = overlay.querySelector('#ep-filename') as HTMLInputElement;
      _config.filename = filenameInput.value.trim() || 'untitled_video';
      closePanel();
      onExport({ ..._config });
    });
  }

  renderModal();
}

export async function runExport(
  composition: core.Composition,
  config: ExportConfig,
  _state: EditorState
) {
  const progressEl = document.querySelector('#export-progress') as HTMLElement;
  const fillCircle = document.querySelector('#progress-fill-circle') as SVGCircleElement;
  const pctSpan = document.querySelector('#progress-pct') as HTMLSpanElement;
  const labelEl = document.querySelector('.progress-label') as HTMLElement;
  const cancelBtn = document.querySelector('#cancel-export-btn') as HTMLButtonElement;

  let timeRemaining = document.querySelector('#export-time-remaining') as HTMLElement | null;
  if (!timeRemaining) {
    timeRemaining = document.createElement('p');
    timeRemaining.id = 'export-time-remaining';
    timeRemaining.className = 'progress-label progress-label--secondary';
    labelEl.insertAdjacentElement('afterend', timeRemaining);
  }

  const videoCodecVal = config.videoCodec === 'auto' ? undefined : config.videoCodec;

  const encoder = new core.Encoder(composition, {
    format: config.format as 'mp4' | 'webm',
    video: {
      fps: config.fps,
      bitrate: QUALITY_PRESETS[config.quality].bitrate,
      resolution: config.resolution,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(videoCodecVal ? { codec: videoCodecVal as any } : {}),
    },
    audio: {
      enabled: config.audioEnabled,
      bitrate: config.audioBitrate,
    },
  });

  let cancelled = false;
  cancelBtn.onclick = () => {
    cancelled = true;
    encoder.cancel();
    progressEl.style.display = 'none';
    pctSpan.textContent = '0%';
    fillCircle.style.strokeDashoffset = '201';
    if (timeRemaining) timeRemaining.textContent = '';
    labelEl.textContent = 'Rendering video...';
  };

  encoder.onProgress = (event) => {
    const { progress, total, remaining } = event;
    const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
    progressEl.style.display = 'block';
    pctSpan.textContent = `${pct}%`;
    const circumference = 201;
    fillCircle.style.strokeDashoffset = String(circumference - (circumference * pct) / 100);

    const totalSeconds = Math.ceil(remaining.getTime() / 1000);
    if (totalSeconds > 0 && progress > 0) {
      if (totalSeconds >= 60) {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        if (timeRemaining) timeRemaining.textContent = `~${m}m ${s}s remaining`;
      } else {
        if (timeRemaining) timeRemaining.textContent = `~${totalSeconds}s remaining`;
      }
    }
  };

  labelEl.textContent = `Rendering ${config.filename}.${config.format}...`;

  try {
    const result = await encoder.render();

    if (cancelled) return;

    if (result.type === 'canceled') return;

    if (result.type === 'error') {
      alert(`Export failed: ${result.error.message}`);
      return;
    }

    const blob = result.data;
    if (!blob) {
      alert('Export produced no data. Please try again.');
      return;
    }

    const filename = `${config.filename}.${config.format}`;

    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: config.format === 'mp4' ? 'MP4 Video' : 'WebM Video',
            accept: config.format === 'mp4'
              ? { 'video/mp4': ['.mp4'] }
              : { 'video/webm': ['.webm'] },
          }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e) {
        if (e instanceof DOMException && (e.name === 'AbortError' || e.name === 'NotAllowedError')) {
          downloadBlobFallback(blob, filename);
          return;
        }
      }
    }

    downloadBlobFallback(blob, filename);

  } catch (e) {
    if (!cancelled) {
      if (e instanceof core.EncoderError) {
        alert(`Encoder error: ${e.message}`);
      } else if (e instanceof Error) {
        alert(`Export failed: ${e.message}`);
      } else {
        alert(`Export failed: ${String(e)}`);
      }
    }
  } finally {
    if (!cancelled) {
      progressEl.style.display = 'none';
      pctSpan.textContent = '0%';
      fillCircle.style.strokeDashoffset = '201';
      if (timeRemaining) timeRemaining.textContent = '';
      labelEl.textContent = 'Rendering video...';
    }
  }
}

function downloadBlobFallback(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
