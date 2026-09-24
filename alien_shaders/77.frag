// ============================================================
// 77.frag — Lissajous Weave (moire interference of two wavy line families)
// ============================================================
// Two families of parallel sine-warped stripes are laid over each
// other at a relative angle. Where they cross you get bright weave
// knots; the tiny difference in their frequency/angle breeds sweeping
// moire bands that shimmer with the smallest parameter nudge.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = frequency of family A (line count)
//   b = frequency of family B (line count) — A/B ratio drives the moire
//   c = relative angle between the two families (0 .. ~PI/2)
//   d = phase drift / warp amount (sine warp so lines are wavy)
//   e = time speed
//   f = contrast / sharpness of the weave knots
//   g = hue (families are complementary, mixing at crossings)
//   h = EVENT: transient KICK to the relative angle — the whole moire
//       violently reorganizes / shimmers on the beat
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
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y); }
#define PI 3.14159265359
#define TAU 6.28318530718

// rotate a 2D coord by angle r
vec2 rot(vec2 p, float r){ float s=sin(r), c=cos(r); return mat2(c,-s,s,c)*p; }

// soft periodic stripe field: bright thin lines along one axis of `coord`.
// warp bends the lines into waves; sharp controls knot crispness.
// returns ~0 in the gaps, ~1 on a line.
float stripes(vec2 coord, float freq, float phase, float warp, float sharp){
  // warp the stripe axis with a perpendicular sine so lines undulate
  float x = coord.x + warp * sin(coord.y * 1.7 + phase * 0.6);
  // periodic ridge: 1 at line centres, 0 between
  float s = 0.5 + 0.5 * cos(x * freq + phase);
  // pow() thins the bright lines and darkens the gaps -> crisp weave
  return pow(s, sharp);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

  float t = iTime * param(e, 0.15, 2.2);      // overall time speed

  // --- family frequencies (the A/B mismatch is what breeds the moire) ---
  float freqA = param(a, 6.0, 40.0);
  float freqB = param(b, 6.0, 40.0);

  // --- relative angle between the two stripe families ---
  float angA = 0.35 * t;                       // family A slowly spins so it stays lively
  float relAng = param(c, 0.0, PI * 0.5);
  // h EVENT: kick the relative angle on a transient. h is 0 normally and
  // spikes toward 1 on a beat, so the whole moire violently reorganizes,
  // then relaxes back as h decays.  <-- h acts here
  relAng += h * PI * 0.9;
  float angB = angA + relAng;

  // --- animated phase / warp drift ---
  float warp  = param(d, 0.0, 0.9);            // how wavy the lines are
  float sharp = param(f, 1.5, 9.0);            // knot sharpness / contrast
  float phaseA = t * TAU * 0.11;               // the two families drift at
  float phaseB = -t * TAU * 0.17;              // different rates -> shimmer

  // build the two rotated + warped coordinate frames
  vec2 cA = rot(uv, angA);
  vec2 cB = rot(uv, angB);

  // the two soft stripe fields
  float A = stripes(cA, freqA, phaseA, warp, sharp);
  float B = stripes(cB, freqB, phaseB, warp, sharp);

  // --- combine: additive weave plus a multiplicative knot term ---
  // add -> both families visible as their own lines;
  // A*B -> extra-bright crossings where the two grids intersect (the knots).
  float knots = A * B;
  float weave = saturate(A + B) * 0.7 + knots * 1.6;

  // --- colour: complementary hues per family, mixing at the crossings ---
  float baseHue = param(g, 0.0, 1.0);
  vec3 colA = hsv2rgb(vec3(baseHue,             0.85, 1.0));
  vec3 colB = hsv2rgb(vec3(fract(baseHue+0.5),  0.85, 1.0));   // complement
  // weight each colour by its own line field, blend to white at the knots
  vec3 col = colA * A + colB * B;
  col += vec3(1.0) * knots * 1.4;              // knots flare toward white

  // scale by the overall weave brightness and lift the moire bands a touch
  col *= 0.55 + 0.9 * weave;

  // subtle global moire shimmer band from the raw frequency beat, so even
  // with only iTime moving there is a sweeping brightness pulse
  float beat = 0.5 + 0.5 * sin((A - B) * PI + t * 1.3);
  col *= 0.75 + 0.5 * beat;

  // h EVENT (second touch): flash the crossings hot white as the angle kicks
  col += vec3(1.0) * knots * h * 2.0;

  // dark background vignette
  float vig = 1.0 - 0.45 * dot(uv, uv);
  col *= vig;

  fragColor = vec4(clamp(col,0.0,1.0),1.0);
}
