export interface ColorGrading {
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
}

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
  };
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
  overlayCanvas: HTMLCanvasElement;
  sourceCanvas: HTMLCanvasElement;
  rafId: number;
  active: boolean;
  uniforms: Record<string, WebGLUniformLocation | null>;
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

    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of ['uSrc','uLift','uGamma','uGain','uOffset','uContrast','uPivot',
        'uSaturation','uTemperature','uTint','uHue','uShadows','uHighlights',
        'uColorBoost','uMidtoneDetail']) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    gl.uniform1i(uniforms['uSrc'], 0);

    state = { gl, program, tex, overlayCanvas: overlay, sourceCanvas: src, rafId: 0, active: true, uniforms };
    return true;
  }

  function wheelToRgb(x: number, y: number): [number, number, number] {
    return [x * 0.3, -y * 0.3, -x * 0.3 + y * 0.15];
  }

  function renderFrame() {
    if (!state) return;
    const cg = getGrading();
    const { gl, tex, overlayCanvas: ov, sourceCanvas: src, uniforms } = state;

    if (ov.width !== src.width || ov.height !== src.height) {
      ov.width = src.width;
      ov.height = src.height;
      gl.viewport(0, 0, src.width, src.height);
    }

    if (!cg) {
      ov.style.display = 'none';
      return;
    }

    ov.style.display = '';

    try {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    } catch {
      ov.style.display = 'none';
      return;
    }

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

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function loop() {
    if (!tryInit()) {
      rafId = requestAnimationFrame(loop);
      return;
    }
    renderFrame();
    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);

  return {
    update: renderFrame,
    destroy: () => {
      cancelAnimationFrame(rafId);
      if (state) {
        state.overlayCanvas.remove();
        state = null;
      }
    },
  };
}
