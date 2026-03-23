export function showDonateModal(): void {
  const overlay = document.createElement('div');
  overlay.className = 'donate-overlay';

  overlay.innerHTML = `
    <div class="donate-modal">
      <button class="donate-close" id="donate-close" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <div class="donate-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </div>
      <h2 class="donate-title">Support this work</h2>
      <p class="donate-message">
        This tool is completely free &amp; client‑side, but making it was not free&nbsp;:(
        <br/>If it's been useful to you, consider supporting my work.
      </p>
      <a class="donate-btn" href="https://buymeacoffee.com/therealg" target="_blank" rel="noopener noreferrer" id="donate-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
        </svg>
        Buy me a coffee
      </a>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#donate-close')!.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('#donate-link')!.addEventListener('click', close);

  requestAnimationFrame(() => overlay.classList.add('donate-overlay--visible'));
}
