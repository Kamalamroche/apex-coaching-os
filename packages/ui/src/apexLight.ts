/* APEX light: the animated banner behind the website hero.
   A pyramid of soft light (the apex) rising out of a dark field, with a slow shimmer travelling up its two
   slopes and a faint horizon arc. Drawn live with one small WebGL shader, so it is sharp at any size,
   weighs a few kilobytes and needs no video file. Original artwork, inspired by the mood of Kamal's
   reference clips (light gradients, not their shapes or words).

   Falls back to a still CSS gradient (set on the canvas parent) when WebGL is missing,
   and draws one still frame when the visitor prefers reduced motion. */

export type LightPalette = {
  /** deep field at the top */ top: [number, number, number];
  /** field at the bottom */ bottom: [number, number, number];
  /** colour of the beams */ beam: [number, number, number];
  /** colour of the light core inside the A */ core: [number, number, number];
};

/** Calm midnight blue, matching the logo blue. Values are 0..1 RGB. */
export const LIGHT_MIDNIGHT: LightPalette = {
  top: [0.031, 0.043, 0.09],
  bottom: [0.075, 0.12, 0.3],
  beam: [0.62, 0.74, 1.0],
  core: [0.2, 0.36, 0.95],
};

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

const FRAG = `precision highp float;
uniform vec2 r;uniform float t;uniform vec3 cTop,cBot,cBeam,cCore;
float line(vec2 q,vec2 a,vec2 b){vec2 pa=q-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
float hash(vec2 q){return fract(sin(dot(q,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  float asp=r.x/r.y;
  vec2 q=vec2((uv.x-.5)*asp,uv.y);
  /* apex sits near the top; the base runs wide off the bottom of the frame so the headline sits inside the A */
  float breathe=.01*sin(t*.35);
  vec2 apex=vec2(0.,.93+breathe);
  float base=1.9+.08*sin(t*.21);
  vec2 bl=vec2(-base,-.45),br=vec2(base,-.45);
  float dl=line(q,apex,bl),dr=line(q,apex,br);
  /* 0 at the apex, 1 at the base */
  float along=clamp((apex.y-q.y)/(apex.y+.45),0.,1.);
  /* a slow shimmer climbing each slope towards the apex */
  float sl=.5+.5*sin(along*6.-t*.7),sr=.5+.5*sin(along*6.-t*.7+1.9);
  float w=.018+.16*along;
  float fade=1.-.55*along;
  float beamL=exp(-pow(dl/w,2.))*(.6+.4*sl)*fade;
  float beamR=exp(-pow(dr/w,2.))*(.6+.4*sr)*fade;
  float haze=exp(-pow(min(dl,dr)/(.12+.5*along),2.))*fade;
  /* inside the A: a soft column of light falling from the apex */
  float edge=apex.y+abs(q.x)/base*(-.45-apex.y);
  float inside=smoothstep(-.04,.1,edge-q.y);
  float column=exp(-pow(max(apex.y-q.y,0.)*1.7,2.))*inside;
  vec3 col=mix(cBot,cTop,smoothstep(-.1,1.,uv.y));
  col+=cCore*(column*.32+haze*.22);
  col+=cBeam*(beamL+beamR)*.42;
  /* fine grain so the gradients never band */
  col+=(hash(gl_FragCoord.xy+t)-.5)*.018;
  gl_FragColor=vec4(col,1.);
}`;

/** Start the light on a canvas. Returns a stop function. */
export function startApexLight(canvas: HTMLCanvasElement, palette: LightPalette = LIGHT_MIDNIGHT): () => void {
  const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl) return () => {};
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return () => {};
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  gl.uniform3fv(u("cTop"), palette.top);
  gl.uniform3fv(u("cBot"), palette.bottom);
  gl.uniform3fv(u("cBeam"), palette.beam);
  gl.uniform3fv(u("cCore"), palette.core);
  const uR = u("r"), uT = u("t");

  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0, visible = true, running = true;
  const t0 = performance.now();

  const size = () => {
    /* cap the pixel count: the light is soft, so it does not need full retina resolution */
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  const draw = (now: number) => {
    size();
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, still ? 4 : (now - t0) / 1000);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    canvas.dataset.ready = "1";
  };
  const loop = (now: number) => {
    if (!running) return;
    if (visible) draw(now);
    raf = requestAnimationFrame(loop);
  };

  const io = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; })
    : null;
  io?.observe(canvas);
  const onResize = () => still && draw(performance.now());
  window.addEventListener("resize", onResize);

  if (still) draw(t0);
  else raf = requestAnimationFrame(loop);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    io?.disconnect();
    window.removeEventListener("resize", onResize);
  };
}
