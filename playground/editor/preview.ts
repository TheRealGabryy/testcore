import type { EditorState } from './state';

function svgIcon(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

export function setupPreview(playbackEl: HTMLElement, state: EditorState) {
  const playerContainer = document.querySelector('#player-container') as HTMLDivElement;
  const player = document.querySelector('#player') as HTMLDivElement;

  state.composition.mount(player);

  playbackEl.innerHTML = `
    <span id="time-display">00:00 / 00:00</span>
    <div class="playback-spacer"></div>
    <div class="playback-btns">
      <button class="playback-btn" id="pb-back" title="Go to start">
        ${svgIcon('<polygon points="19 20 9 12 19 4"/><line x1="5" y1="4" x2="5" y2="20"/>')}
      </button>
      <button class="playback-btn play-pause" id="pb-play" title="Play">
        ${svgIcon('<polygon points="5 3 19 12 5 21"/>')}
      </button>
      <button class="playback-btn" id="pb-forward" title="Go to end">
        ${svgIcon('<polygon points="5 4 15 12 5 20"/><line x1="19" y1="4" x2="19" y2="20"/>')}
      </button>
    </div>
    <div class="playback-spacer"></div>
    <div class="playback-right">
      <button class="playback-btn fps-badge" id="fps-btn" title="Change FPS">30 fps</button>
      <button class="playback-btn" id="pb-fullscreen" title="Fullscreen">
        ${svgIcon('<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>')}
      </button>
    </div>
  `;

  const pbPlay = playbackEl.querySelector('#pb-play') as HTMLButtonElement;
  const pbBack = playbackEl.querySelector('#pb-back') as HTMLButtonElement;
  const pbForward = playbackEl.querySelector('#pb-forward') as HTMLButtonElement;
  const timeDisplay = playbackEl.querySelector('#time-display') as HTMLSpanElement;
  const fpsBadge = playbackEl.querySelector('#fps-btn') as HTMLButtonElement;

  const playIcon = svgIcon('<polygon points="5 3 19 12 5 21"/>');
  const pauseIcon = svgIcon('<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>');

  function setPlaying(playing: boolean) {
    pbPlay.innerHTML = playing ? pauseIcon : playIcon;
    pbPlay.title = playing ? 'Pause' : 'Play';
  }

  pbPlay.addEventListener('click', () => {
    if (state.composition.playing) {
      state.composition.pause();
    } else {
      state.composition.play();
    }
  });

  pbBack.addEventListener('click', () => state.composition.seek(0));
  pbForward.addEventListener('click', () => state.composition.seek(state.composition.duration));

  fpsBadge.addEventListener('click', () => {
    const val = parseFloat(
      prompt('Enter desired frame rate (fps):', String(state.fps)) ?? String(state.fps)
    );
    if (!Number.isNaN(val) && val > 0) {
      state.fps = val;
      fpsBadge.textContent = `${val} fps`;
    }
  });

  state.composition.on('playback:start', () => setPlaying(true));
  state.composition.on('playback:end', () => setPlaying(false));
  state.composition.on('playback:time', () => {
    timeDisplay.textContent = state.composition.time();
  });

  const handleResize = () => {
    const scale = Math.min(
      playerContainer.clientWidth / state.composition.width,
      playerContainer.clientHeight / state.composition.height
    );
    player.style.width = `${state.composition.width}px`;
    player.style.height = `${state.composition.height}px`;
    player.style.transform = `scale(${scale})`;
  };

  const ro = new ResizeObserver(handleResize);
  ro.observe(playerContainer);
  state.composition.on('resize', handleResize);

  timeDisplay.textContent = state.composition.time();
  state.composition.seek(0);
  setTimeout(handleResize, 50);
}
