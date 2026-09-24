// ============================================================
// 75.frag — Hex Flow (travelling harmonic wave across a hex lattice)
// ============================================================
// A hexagonal honeycomb tiling. Each cell is lit by sampling a
// travelling harmonic wave at its centre, perturbed by fbm noise,
// so bright bands of hexes sweep across the plane like a honeycomb
// equalizer. Cells render as glowing outlines blended with fills.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = hex size (scale of the tiling)
//   b = wave spatial frequency (how many bands across)
//   c = wave travel speed
//   d = noise amount (fbm perturbing which cells light)
//   e = time speed (overall)
//   f = edge thickness / outline vs fill blend
//   g = hue (hue shifts across the wave)
//   h = EVENT: transient scatter — random hexes FLARE bright on the beat
// ============================================================

/////////////////////////start Pd Header
uniform vec3 iResolution;
uniform float iTime;
uniform float iGlobalTime;
uniform vec4 iMouse;
uniform float a, b, c, d, e, f, g, h;
void mainImage(out vec4 fragColor, in vec2 fragCoord);
void main() { mainImage(gl_FragColor, gl_FragCoord.xy); }
/////////////////////////end Pd Header

// ---- house helpers ----
float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float saturate(float x){ return clamp(x,0.0,1.0); }
float hash(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.13); p3+=dot(p3,p3.yzx+3.333); return fract((p3.x+p3.y)*p3.z); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y); }
#define PI 3.14159265359
#define TAU 6.28318530718

// fractional brownian motion for organic wave perturbation
float fbm(vec2 p){
  float v=0.0, amp=0.5;
  for(int i=0;i<4;i++){ v+=amp*noise(p); p*=2.02; amp*=0.5; }
  return v;
}

// ---- hexagonal axial grid ----
// .xy = position within hex cell (centered), .zw = unique cell id
vec4 hexGrid(vec2 p){
  vec2 s = vec2(1.0, 1.7320508);           // hex metrics
  vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 hv = vec4(p - hC.xy*s, p - (hC.zw + 0.5)*s);
  return dot(hv.xy,hv.xy) < dot(hv.zw,hv.zw) ? vec4(hv.xy, hC.xy) : vec4(hv.zw, hC.zw + 0.5);
}
// distance to hex edge (1.0 at flat edges of a unit hex)
float hexDist(vec2 p){ p=abs(p); return max(dot(p, normalize(vec2(1.0,1.7320508))), p.x); }

void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

  float t = iTime * param(e, 0.05, 1.2);   // overall time speed

  // --- tiling ---
  float scale = param(a, 4.0, 22.0);       // hex size (more cells = smaller hexes)
  vec4 hx = hexGrid(uv * scale);
  vec2 local = hx.xy;                       // local coords within cell
  vec2 id    = hx.zw;                       // unique cell id (used for wave + hash)

  // --- travelling harmonic wave sampled at the cell centre ---
  float freq  = param(b, 0.6, 6.0);         // spatial frequency of bands
  float speed = param(c, 0.0, 3.0);         // wave travel speed
  // project cell id along a slowly rotating direction so bands drift
  float ang = t * 0.15;
  vec2 dir = vec2(cos(ang), sin(ang));
  float coord = dot(id, dir);
  // fbm perturbs which cells light, keyed to the cell id
  float n = fbm(id * 0.25 + t * 0.2);
  float wave = sin(coord * freq - t * speed * TAU + n * param(d, 0.0, 8.0));
  wave = wave * 0.5 + 0.5;                   // 0..1 fill level per cell

  // sharpen the bright bands a touch so they read as an equalizer sweep
  float fill = smoothstep(0.35, 0.95, wave);

  // --- h EVENT: transient scatter, random hexes FLARE on the beat ---
  // pick cells via the id hash; only those above a moving threshold flash,
  // and only while h is spiked. h decays -> the burst fades out.
  float pick = hash(id + floor(t * 4.0));    // reshuffle which cells qualify
  float flare = step(1.0 - 0.6 * h, pick) * h;   // <-- h drives the beat burst
  fill = max(fill, flare);

  // --- draw the hexagon: outline blended with fill ---
  float hd = hexDist(local);                 // 0 at center, ~1 at edge
  float edgeW = param(f, 0.02, 0.22);        // edge thickness / outline weight
  // outline ring near the hex boundary
  float outline = smoothstep(1.0, 1.0 - edgeW, hd) - smoothstep(1.0 - edgeW, 1.0 - edgeW*2.0, hd);
  outline = saturate(outline);
  // solid interior body
  float body = smoothstep(1.0, 1.0 - edgeW*1.5, hd);

  // blend outline vs fill by f: low f = mostly outlines, high f = filled cells
  float cellLight = mix(outline, body * fill + outline * 0.5, saturate(f));
  cellLight *= (0.25 + 0.75 * fill);         // dim un-lit cells

  // --- colour: hue drifts across the wave ---
  float hue = fract(param(g, 0.0, 1.0) + wave * 0.35 + coord * 0.02 + t * 0.03);
  float bright = cellLight * (0.6 + 0.9 * fill);
  bright += flare * 1.5;                       // extra punch on flared cells
  vec3 col = hsv2rgb(vec3(hue, 0.85 - 0.4 * flare, saturate(bright)));

  // soft inner glow so the honeycomb feels emissive
  col += hsv2rgb(vec3(hue, 0.6, 1.0)) * fill * (1.0 - hd) * 0.35;

  // dark background vignette
  float vig = 1.0 - 0.4 * dot(uv, uv);
  col *= vig;

  fragColor = vec4(clamp(col,0.0,1.0),1.0);
}
