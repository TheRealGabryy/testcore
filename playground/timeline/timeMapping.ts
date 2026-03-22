export function timeToX(time: number, zoom: number): number {
  return time * zoom;
}

export function xToTime(x: number, zoom: number): number {
  return x / zoom;
}

export function durationToWidth(duration: number, zoom: number): number {
  return duration * zoom;
}

export function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 100);
  if (h > 0) {
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}:${String(f).padStart(2,'0')}`;
  }
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}:${String(f).padStart(2,'0')}`;
}

export function getRulerStep(zoom: number): { major: number; minor: number } {
  // Minimum ~60px between major marks
  const minPixels = 60;
  const secondsPerMinPixel = minPixels / zoom;
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const major = steps.find(s => s >= secondsPerMinPixel) ?? 600;
  const minor = major / 5;
  return { major, minor };
}
