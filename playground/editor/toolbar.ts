import type { EditorState } from './state';

function svgIcon(path: string, vb = '0 0 24 24'): string {
  return `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

export function setupToolbar(el: HTMLElement, state: EditorState, onExport: () => void, onLoadDemo: () => void) {
  el.innerHTML = `
    <div class="topbar-section">
      <div class="app-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="2" width="9" height="9" rx="1.5" fill="#e8b84b"/>
          <rect x="13" y="2" width="9" height="9" rx="1.5" fill="#3b7dd8"/>
          <rect x="2" y="13" width="9" height="9" rx="1.5" fill="#22c55e"/>
          <rect x="13" y="13" width="9" height="9" rx="1.5" fill="#f97316"/>
        </svg>
        <span class="app-name">DiffusionStudio</span>
      </div>
    </div>

    <div class="topbar-section grow">
      <input id="project-title" class="title-input" type="text" value="Untitled Project" spellcheck="false" />
    </div>

    <div class="topbar-section">
      <button class="btn-demo" id="load-demo-btn" title="Load demo composition">
        ${svgIcon('<polygon points="5,3 19,12 5,21"/>')}
        Load Demo
      </button>
      <div class="topbar-divider"></div>
      <button class="btn-accent" id="export-btn">
        ${svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>')}
        Export
      </button>
    </div>
  `;

  el.querySelector('#export-btn')!.addEventListener('click', onExport);
  el.querySelector('#load-demo-btn')!.addEventListener('click', onLoadDemo);

  state.on('layers:change', () => {
    // Nothing to update in toolbar currently
  });
}
