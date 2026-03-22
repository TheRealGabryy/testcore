export type CurvePoint = [number, number];

export interface ColorGrading {
  // Basic tab — lift/gamma/gain/offset wheels
  liftX: number; liftY: number;
  gammaX: number; gammaY: number;
  gainX: number; gainY: number;
  offsetX: number; offsetY: number;
  temperature: number;
  tint: number;
  contrast: number;
  pivot: number;
  midtoneDetail: number;
  colorBoost: number;
  shadows: number;
  highlights: number;
  saturation: number;
  hue: number;
  luminanceMix: number;

  // Curves tab — RGB curves (identity = [(0,0),(1,1)])
  curveMaster: CurvePoint[];
  curveRed: CurvePoint[];
  curveGreen: CurvePoint[];
  curveBlue: CurvePoint[];
  // Hue curves (identity = flat line at y=0.5)
  curveHvsH: CurvePoint[];
  curveHvsS: CurvePoint[];
  curveHvsL: CurvePoint[];
  curveLvsS: CurvePoint[];
  curveSvsS: CurvePoint[];

  // Wheels tab — separate 3-way + offset (shadows/midtones/highlights/offset)
  shadWX: number; shadWY: number; shadWLuma: number;
  midWX: number; midWY: number; midWLuma: number;
  hiWX: number; hiWY: number; hiWLuma: number;
  offWX: number; offWY: number; offWLuma: number;

  // HSL Secondary tab
  hslEnabled: boolean;
  hslHueCenter: number;
  hslHueRange: number;
  hslSatMin: number;
  hslSatMax: number;
  hslLumaMin: number;
  hslLumaMax: number;
  hslCorHue: number;
  hslCorSat: number;
  hslCorLuma: number;
  hslCorTemp: number;
  hslCorTint: number;
}

const ID_CURVE: CurvePoint[] = [[0, 0], [1, 1]];
const FLAT_CURVE: CurvePoint[] = [[0, 0.5], [1, 0.5]];

export function defaultColorGrading(): ColorGrading {
  return {
    liftX: 0, liftY: 0,
    gammaX: 0, gammaY: 0,
    gainX: 0, gainY: 0,
    offsetX: 0, offsetY: 0,
    temperature: 0,
    tint: 0,
    contrast: 1.0,
    pivot: 0.435,
    midtoneDetail: 0,
    colorBoost: 0,
    shadows: 0,
    highlights: 0,
    saturation: 1.0,
    hue: 0,
    luminanceMix: 1.0,

    curveMaster: [...ID_CURVE],
    curveRed: [...ID_CURVE],
    curveGreen: [...ID_CURVE],
    curveBlue: [...ID_CURVE],
    curveHvsH: [...FLAT_CURVE],
    curveHvsS: [...FLAT_CURVE],
    curveHvsL: [...FLAT_CURVE],
    curveLvsS: [...FLAT_CURVE],
    curveSvsS: [...FLAT_CURVE],

    shadWX: 0, shadWY: 0, shadWLuma: 0,
    midWX: 0, midWY: 0, midWLuma: 0,
    hiWX: 0, hiWY: 0, hiWLuma: 0,
    offWX: 0, offWY: 0, offWLuma: 0,

    hslEnabled: false,
    hslHueCenter: 180,
    hslHueRange: 30,
    hslSatMin: 0,
    hslSatMax: 1,
    hslLumaMin: 0,
    hslLumaMax: 1,
    hslCorHue: 0,
    hslCorSat: 1,
    hslCorLuma: 0,
    hslCorTemp: 0,
    hslCorTint: 0,
  };
}

export function evaluateCurve(points: CurvePoint[], numSamples: number, clampY = true): Float32Array {
  const lut = new Float32Array(numSamples);
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  const n = sorted.length;

  if (n < 2) {
    for (let i = 0; i < numSamples; i++) lut[i] = n === 0 ? i / (numSamples - 1) : sorted[0][1];
    return lut;
  }

  const d = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    const dx = sorted[i + 1][0] - sorted[i][0];
    d[i] = dx < 1e-10 ? 0 : (sorted[i + 1][1] - sorted[i][1]) / dx;
  }

  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (Math.sign(d[i - 1]) !== Math.sign(d[i])) { m[i] = 0; }
    else { m[i] = (d[i - 1] + d[i]) / 2; }
  }
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(d[i]) < 1e-10) { m[i] = m[i + 1] = 0; continue; }
    const alpha = m[i] / d[i], beta = m[i + 1] / d[i];
    if (alpha < 0 || beta < 0) { m[i] = 0; continue; }
    const ab2 = alpha * alpha + beta * beta;
    if (ab2 > 9) {
      const tau = 3 / Math.sqrt(ab2);
      m[i] = tau * alpha * d[i];
      m[i + 1] = tau * beta * d[i];
    }
  }

  for (let s = 0; s < numSamples; s++) {
    const t = s / (numSamples - 1);
    if (t <= sorted[0][0]) { lut[s] = sorted[0][1]; continue; }
    if (t >= sorted[n - 1][0]) { lut[s] = sorted[n - 1][1]; continue; }
    let j = 0;
    for (let k = 0; k < n - 2; k++) { if (t >= sorted[k][0] && t < sorted[k + 1][0]) { j = k; break; } }
    const h = sorted[j + 1][0] - sorted[j][0];
    const u = h < 1e-10 ? 0 : (t - sorted[j][0]) / h;
    const u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    let v = h00 * sorted[j][1] + h10 * h * m[j] + h01 * sorted[j + 1][1] + h11 * h * m[j + 1];
    if (clampY) v = Math.max(0, Math.min(1, v));
    lut[s] = v;
  }
  return lut;
}

const VERT_SRC = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

const FRAG_SRC = `
  precision mediump float;
  uniform sampler2D uSrc;
  uniform sampler2D uLutRgb;
  uniform sampler2D uLutHue;
  uniform sampler2D uLutLS;
  varying vec2 vUv;

  uniform vec3 uLift;
  uniform vec3 uGamma;
  uniform vec3 uGain;
  uniform vec3 uOffset;
  uniform float uContrast;
  uniform float uPivot;
  uniform float uSaturation;
  uniform float uTemperature;
  uniform float uTint;
  uniform float uHue;
  uniform float uShadows;
  uniform float uHighlights;
  uniform float uColorBoost;
  uniform float uMidtoneDetail;

  uniform float uCurvesActive;
  uniform float uHueCurvesActive;

  uniform vec3 uShadW;
  uniform vec3 uMidW;
  uniform vec3 uHiW;
  uniform vec3 uOffW;
  uniform float uShadWL;
  uniform float uMidWL;
  uniform float uHiWL;
  uniform float uOffWL;

  uniform float uHslEnable;
  uniform float uHslHueCenter;
  uniform float uHslHueRange;
  uniform float uHslSatMin;
  uniform float uHslSatMax;
  uniform float uHslLumaMin;
  uniform float uHslLumaMax;
  uniform float uHslCorHue;
  uniform float uHslCorSat;
  uniform float uHslCorLuma;
  uniform float uHslCorTemp;
  uniform float uHslCorTint;

  vec3 hsvToRgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  vec3 rgbToHsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  float sampleLut1(sampler2D lut, float v, float offset) {
    return texture2D(lut, vec2(clamp(v, 0.001, 0.999), offset)).r;
  }

  void main() {
    vec4 src = texture2D(uSrc, vec2(vUv.x, 1.0 - vUv.y));
    vec3 col = src.rgb;

    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float shadowW = 1.0 - smoothstep(0.0, 0.6, luma);
    float highlightW = smoothstep(0.4, 1.0, luma);
    float midW = 1.0 - abs(luma - 0.5) * 2.5;
    midW = clamp(midW, 0.0, 1.0);

    col = col + uLift * shadowW;
    vec3 gExp = 1.0 / max(vec3(0.01), 1.0 - uGamma * midW);
    col = pow(max(vec3(0.0), col), gExp);
    col = col + uGain * highlightW;
    col = col + uOffset;

    col = (col - uPivot) * uContrast + uPivot;

    col.r += uTemperature * 0.005;
    col.b -= uTemperature * 0.005;
    col.r += uTint * 0.003;
    col.g -= uTint * 0.003;

    col += uShadows * 0.008 * shadowW;
    col += uHighlights * 0.008 * highlightW;

    float grey = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float boostedSat = uSaturation + uColorBoost * midW * 0.5;
    col = mix(vec3(grey), col, boostedSat);

    if (abs(uHue) > 0.5) {
      vec3 hsv = rgbToHsv(max(vec3(0.0), col));
      hsv.x = fract(hsv.x + uHue / 360.0);
      col = hsvToRgb(hsv);
    }

    if (uMidtoneDetail != 0.0) {
      float edge = col.r - 0.25 * (col.r + col.g + col.b);
      col += edge * uMidtoneDetail * midW * 0.3;
    }

    // ── RGB Curves ──────────────────────────────────────────────────────────
    if (uCurvesActive > 0.5) {
      float u = 0.5;
      col.r = texture2D(uLutRgb, vec2(clamp(col.r, 0.001, 0.999), u)).r;
      col.g = texture2D(uLutRgb, vec2(clamp(col.g, 0.001, 0.999), u)).r;
      col.b = texture2D(uLutRgb, vec2(clamp(col.b, 0.001, 0.999), u)).r;
      col.r = texture2D(uLutRgb, vec2(clamp(col.r, 0.001, 0.999), u)).g;
      col.g = texture2D(uLutRgb, vec2(clamp(col.g, 0.001, 0.999), u)).b;
      col.b = texture2D(uLutRgb, vec2(clamp(col.b, 0.001, 0.999), u)).a;
    }

    // ── Hue Curves ──────────────────────────────────────────────────────────
    if (uHueCurvesActive > 0.5) {
      vec3 hsv2 = rgbToHsv(max(vec3(0.0), col));
      float u = 0.5;
      vec4 hcLut = texture2D(uLutHue, vec2(clamp(hsv2.x, 0.001, 0.999), u));
      hsv2.x = fract(hsv2.x + (hcLut.r - 0.5) * 2.0);
      hsv2.y = clamp(hsv2.y * max(0.0, hcLut.g * 2.0), 0.0, 1.0);
      hsv2.z = clamp(hsv2.z + (hcLut.b - 0.5), 0.0, 1.0);
      float sSample = texture2D(uLutHue, vec2(clamp(hsv2.y, 0.001, 0.999), u)).a;
      hsv2.y = clamp(hsv2.y * max(0.0, sSample * 2.0), 0.0, 1.0);
      float luma3 = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float lvsSample = texture2D(uLutLS, vec2(clamp(luma3, 0.001, 0.999), u)).r;
      hsv2.y = clamp(hsv2.y * max(0.0, lvsSample * 2.0), 0.0, 1.0);
      col = hsvToRgb(hsv2);
    }

    // ── Wheels Tab (3-way + offset) ─────────────────────────────────────────
    luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    shadowW = 1.0 - smoothstep(0.0, 0.6, luma);
    highlightW = smoothstep(0.4, 1.0, luma);
    midW = clamp(1.0 - abs(luma - 0.5) * 2.5, 0.0, 1.0);

    col += uShadW * shadowW + uMidW * midW + uHiW * highlightW + uOffW;
    float wLuma = uShadWL * shadowW + uMidWL * midW + uHiWL * highlightW + uOffWL;
    col = max(vec3(0.0), col + vec3(wLuma));

    // ── HSL Secondary ───────────────────────────────────────────────────────
    if (uHslEnable > 0.5) {
      vec3 hsvSel = rgbToHsv(max(vec3(0.0), col));
      float hc = uHslHueCenter / 360.0;
      float hr = uHslHueRange / 360.0;
      float hDiff = abs(fract(hsvSel.x - hc + 0.5) - 0.5) * 2.0;
      float hMask = 1.0 - smoothstep(0.0, max(0.01, hr), hDiff);
      float sMask = smoothstep(uHslSatMin - 0.05, uHslSatMin + 0.05, hsvSel.y)
                  * (1.0 - smoothstep(uHslSatMax - 0.05, uHslSatMax + 0.05, hsvSel.y));
      float lm = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float lMask = smoothstep(uHslLumaMin - 0.05, uHslLumaMin + 0.05, lm)
                  * (1.0 - smoothstep(uHslLumaMax - 0.05, uHslLumaMax + 0.05, lm));
      float mask = clamp(hMask * sMask * lMask, 0.0, 1.0);

      vec3 hsvCorr = hsvSel;
      hsvCorr.x = fract(hsvCorr.x + uHslCorHue / 360.0);
      hsvCorr.y = clamp(hsvCorr.y * uHslCorSat, 0.0, 1.0);
      hsvCorr.z = clamp(hsvCorr.z + uHslCorLuma, 0.0, 1.0);
      vec3 colCorr = hsvToRgb(hsvCorr);
      colCorr.r += uHslCorTemp * 0.005;
      colCorr.b -= uHslCorTemp * 0.005;
      colCorr.r += uHslCorTint * 0.003;
      colCorr.g -= uHslCorTint * 0.003;
      col = mix(col, clamp(colCorr, 0.0, 1.0), mask);
    }

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), src.a);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  return shader;
}

interface GlState {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  tex: WebGLTexture;
  lutRgbTex: WebGLTexture;
  lutHueTex: WebGLTexture;
  lutLSTex: WebGLTexture;
  overlayCanvas: HTMLCanvasElement;
  sourceCanvas: HTMLCanvasElement;
  rafId: number;
  active: boolean;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

function isIdentityCurve(pts: CurvePoint[]): boolean {
  if (pts.length === 2 && pts[0][0] === 0 && pts[0][1] === 0 && pts[1][0] === 1 && pts[1][1] === 1) return true;
  return false;
}

function isFlatCurve(pts: CurvePoint[]): boolean {
  return pts.every(p => Math.abs(p[1] - 0.5) < 0.002);
}

function buildRgbLutData(cg: ColorGrading): Uint8Array {
  const N = 256;
  const master = evaluateCurve(cg.curveMaster, N);
  const red = evaluateCurve(cg.curveRed, N);
  const green = evaluateCurve(cg.curveGreen, N);
  const blue = evaluateCurve(cg.curveBlue, N);
  const data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    data[i * 4 + 0] = Math.round(master[i] * 255);
    data[i * 4 + 1] = Math.round(red[i] * 255);
    data[i * 4 + 2] = Math.round(green[i] * 255);
    data[i * 4 + 3] = Math.round(blue[i] * 255);
  }
  return data;
}

function buildHueLutData(cg: ColorGrading): Uint8Array {
  const N = 256;
  const hvsH = evaluateCurve(cg.curveHvsH, N, false);
  const hvsS = evaluateCurve(cg.curveHvsS, N, false);
  const hvsL = evaluateCurve(cg.curveHvsL, N, false);
  const svsS = evaluateCurve(cg.curveSvsS, N, false);
  const data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    data[i * 4 + 0] = Math.round(Math.max(0, Math.min(1, hvsH[i])) * 255);
    data[i * 4 + 1] = Math.round(Math.max(0, Math.min(1, hvsS[i])) * 255);
    data[i * 4 + 2] = Math.round(Math.max(0, Math.min(1, hvsL[i])) * 255);
    data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, svsS[i])) * 255);
  }
  return data;
}

function buildLSLutData(cg: ColorGrading): Uint8Array {
  const N = 256;
  const lvsS = evaluateCurve(cg.curveLvsS, N, false);
  const data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    data[i * 4 + 0] = Math.round(Math.max(0, Math.min(1, lvsS[i])) * 255);
    data[i * 4 + 1] = 128; data[i * 4 + 2] = 128; data[i * 4 + 3] = 255;
  }
  return data;
}

function uploadLut(gl: WebGLRenderingContext, tex: WebGLTexture, data: Uint8Array) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
}

export function createColorGradingOverlay(
  playerEl: HTMLElement,
  getGrading: () => ColorGrading | null
): { update: () => void; destroy: () => void } {
  let state: GlState | null = null;
  let rafId = 0;
  let lastSrc: HTMLCanvasElement | null = null;

  function tryInit() {
    const src = playerEl.querySelector('canvas') as HTMLCanvasElement | null;
    if (!src || src === lastSrc) return !!state;
    lastSrc = src;

    const overlay = document.createElement('canvas');
    overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4;display:none;';
    playerEl.appendChild(overlay);

    const gl = overlay.getContext('webgl', { alpha: true, premultipliedAlpha: false }) as WebGLRenderingContext;
    if (!gl) return false;

    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    function makeTex(unit: number): WebGLTexture {
      const t = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }

    const tex = makeTex(0);
    const lutRgbTex = makeTex(1);
    const lutHueTex = makeTex(2);
    const lutLSTex = makeTex(3);

    const placeholder = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      placeholder[i * 4] = i; placeholder[i * 4 + 1] = i;
      placeholder[i * 4 + 2] = i; placeholder[i * 4 + 3] = 128;
    }
    uploadLut(gl, lutRgbTex, placeholder);
    uploadLut(gl, lutHueTex, placeholder);
    uploadLut(gl, lutLSTex, placeholder);

    const uniformNames = [
      'uSrc','uLutRgb','uLutHue','uLutLS',
      'uLift','uGamma','uGain','uOffset','uContrast','uPivot',
      'uSaturation','uTemperature','uTint','uHue','uShadows','uHighlights',
      'uColorBoost','uMidtoneDetail','uCurvesActive','uHueCurvesActive',
      'uShadW','uMidW','uHiW','uOffW','uShadWL','uMidWL','uHiWL','uOffWL',
      'uHslEnable','uHslHueCenter','uHslHueRange',
      'uHslSatMin','uHslSatMax','uHslLumaMin','uHslLumaMax',
      'uHslCorHue','uHslCorSat','uHslCorLuma','uHslCorTemp','uHslCorTint',
    ];

    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniformNames) uniforms[name] = gl.getUniformLocation(program, name);

    gl.uniform1i(uniforms['uSrc'], 0);
    gl.uniform1i(uniforms['uLutRgb'], 1);
    gl.uniform1i(uniforms['uLutHue'], 2);
    gl.uniform1i(uniforms['uLutLS'], 3);

    state = { gl, program, tex, lutRgbTex, lutHueTex, lutLSTex, overlayCanvas: overlay, sourceCanvas: src, rafId: 0, active: true, uniforms };
    return true;
  }

  function wheelToRgb(x: number, y: number): [number, number, number] {
    return [x * 0.3, -y * 0.3, -x * 0.3 + y * 0.15];
  }

  function renderFrame() {
    if (!state) return;
    const cg = getGrading();
    const { gl, tex, lutRgbTex, lutHueTex, lutLSTex, overlayCanvas: ov, sourceCanvas: src, uniforms } = state;

    if (ov.width !== src.width || ov.height !== src.height) {
      ov.width = src.width;
      ov.height = src.height;
      gl.viewport(0, 0, src.width, src.height);
    }

    if (!cg) { ov.style.display = 'none'; return; }
    ov.style.display = '';

    try {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    } catch { ov.style.display = 'none'; return; }

    const [lr, lg, lb] = wheelToRgb(cg.liftX, cg.liftY);
    const [gr, gg, gb] = wheelToRgb(cg.gammaX, cg.gammaY);
    const [nr, ng, nb] = wheelToRgb(cg.gainX, cg.gainY);
    const [or, og, ob] = wheelToRgb(cg.offsetX, cg.offsetY);

    gl.uniform3f(uniforms['uLift'], lr, lg, lb);
    gl.uniform3f(uniforms['uGamma'], gr, gg, gb);
    gl.uniform3f(uniforms['uGain'], nr, ng, nb);
    gl.uniform3f(uniforms['uOffset'], or, og, ob);
    gl.uniform1f(uniforms['uContrast'], cg.contrast);
    gl.uniform1f(uniforms['uPivot'], cg.pivot);
    gl.uniform1f(uniforms['uSaturation'], cg.saturation);
    gl.uniform1f(uniforms['uTemperature'], cg.temperature);
    gl.uniform1f(uniforms['uTint'], cg.tint);
    gl.uniform1f(uniforms['uHue'], cg.hue);
    gl.uniform1f(uniforms['uShadows'], cg.shadows);
    gl.uniform1f(uniforms['uHighlights'], cg.highlights);
    gl.uniform1f(uniforms['uColorBoost'], cg.colorBoost);
    gl.uniform1f(uniforms['uMidtoneDetail'], cg.midtoneDetail);

    const curvesActive = !isIdentityCurve(cg.curveMaster) || !isIdentityCurve(cg.curveRed) ||
      !isIdentityCurve(cg.curveGreen) || !isIdentityCurve(cg.curveBlue) ? 1.0 : 0.0;
    const hueCurvesActive = !isFlatCurve(cg.curveHvsH) || !isFlatCurve(cg.curveHvsS) ||
      !isFlatCurve(cg.curveHvsL) || !isFlatCurve(cg.curveLvsS) || !isFlatCurve(cg.curveSvsS) ? 1.0 : 0.0;

    gl.uniform1f(uniforms['uCurvesActive'], curvesActive);
    gl.uniform1f(uniforms['uHueCurvesActive'], hueCurvesActive);

    if (curvesActive > 0) {
      gl.activeTexture(gl.TEXTURE1);
      uploadLut(gl, lutRgbTex, buildRgbLutData(cg));
    }
    if (hueCurvesActive > 0) {
      gl.activeTexture(gl.TEXTURE2);
      uploadLut(gl, lutHueTex, buildHueLutData(cg));
      gl.activeTexture(gl.TEXTURE3);
      uploadLut(gl, lutLSTex, buildLSLutData(cg));
    }

    const [sr, sg, sb] = wheelToRgb(cg.shadWX, cg.shadWY);
    const [mr, mg, mb] = wheelToRgb(cg.midWX, cg.midWY);
    const [hr2, hg2, hb2] = wheelToRgb(cg.hiWX, cg.hiWY);
    const [owr, owg, owb] = wheelToRgb(cg.offWX, cg.offWY);

    gl.uniform3f(uniforms['uShadW'], sr, sg, sb);
    gl.uniform3f(uniforms['uMidW'], mr, mg, mb);
    gl.uniform3f(uniforms['uHiW'], hr2, hg2, hb2);
    gl.uniform3f(uniforms['uOffW'], owr, owg, owb);
    gl.uniform1f(uniforms['uShadWL'], cg.shadWLuma * 0.02);
    gl.uniform1f(uniforms['uMidWL'], cg.midWLuma * 0.02);
    gl.uniform1f(uniforms['uHiWL'], cg.hiWLuma * 0.02);
    gl.uniform1f(uniforms['uOffWL'], cg.offWLuma * 0.02);

    gl.uniform1f(uniforms['uHslEnable'], cg.hslEnabled ? 1.0 : 0.0);
    gl.uniform1f(uniforms['uHslHueCenter'], cg.hslHueCenter);
    gl.uniform1f(uniforms['uHslHueRange'], cg.hslHueRange);
    gl.uniform1f(uniforms['uHslSatMin'], cg.hslSatMin);
    gl.uniform1f(uniforms['uHslSatMax'], cg.hslSatMax);
    gl.uniform1f(uniforms['uHslLumaMin'], cg.hslLumaMin);
    gl.uniform1f(uniforms['uHslLumaMax'], cg.hslLumaMax);
    gl.uniform1f(uniforms['uHslCorHue'], cg.hslCorHue);
    gl.uniform1f(uniforms['uHslCorSat'], cg.hslCorSat);
    gl.uniform1f(uniforms['uHslCorLuma'], cg.hslCorLuma);
    gl.uniform1f(uniforms['uHslCorTemp'], cg.hslCorTemp);
    gl.uniform1f(uniforms['uHslCorTint'], cg.hslCorTint);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function loop() {
    if (!tryInit()) { rafId = requestAnimationFrame(loop); return; }
    renderFrame();
    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);

  return {
    update: renderFrame,
    destroy: () => {
      cancelAnimationFrame(rafId);
      if (state) { state.overlayCanvas.remove(); state = null; }
    },
  };
}
