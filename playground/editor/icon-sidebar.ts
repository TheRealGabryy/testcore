function svgIcon(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const TOP_ITEMS = [
  {
    id: 'assets',
    title: 'Assets',
    icon: svgIcon('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
  },
  {
    id: 'scenes',
    title: 'Scenes',
    icon: svgIcon('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  },
  {
    id: 'text',
    title: 'Text',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
  },
  {
    id: 'keyframes',
    title: 'Keyframes',
    icon: svgIcon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
  },
  {
    id: 'effects',
    title: 'Effects',
    icon: svgIcon('<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>'),
  },
  {
    id: 'transitions',
    title: 'Transitions',
    icon: svgIcon('<polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>'),
  },
  {
    id: 'layers',
    title: 'Layers',
    icon: svgIcon('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'),
  },
  {
    id: 'shapes',
    title: 'Shapes',
    icon: svgIcon('<circle cx="12" cy="12" r="9"/>'),
  },
];

const BOTTOM_ITEMS = [
  {
    id: 'adjustments',
    title: 'Adjustments',
    icon: svgIcon('<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'),
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: svgIcon('<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>'),
  },
];

export function setupIconSidebar(el: HTMLElement, onExport: () => void, onLoadDemo: () => void) {
  el.innerHTML = `
    <div class="icon-sidebar-top">
      ${TOP_ITEMS.map(item => `
        <button class="icon-sidebar-btn${item.id === 'assets' ? ' active' : ''}" data-id="${item.id}" title="${item.title}">
          ${item.icon}
        </button>
      `).join('')}
    </div>
    <div class="icon-sidebar-bottom">
      ${BOTTOM_ITEMS.map(item => `
        <button class="icon-sidebar-btn" data-id="${item.id}" title="${item.title}">
          ${item.icon}
        </button>
      `).join('')}
      <button class="icon-sidebar-btn icon-sidebar-export" id="sidebar-export-btn" title="Export video">
        ${svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>')}
      </button>
    </div>
  `;

  el.querySelectorAll('.icon-sidebar-btn[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id;
      if (id === 'settings') {
        onLoadDemo();
      }
    });
  });

  el.querySelector('#sidebar-export-btn')!.addEventListener('click', onExport);
}
