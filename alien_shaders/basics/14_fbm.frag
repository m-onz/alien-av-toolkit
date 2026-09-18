// ============================================================
// basics/14 — FBM (Fractal Brownian Motion)
// ============================================================
// Stack several octaves of value noise — each one smaller and fainter
// than the last — and you get natural, detailed texture: clouds,
// smoke, marble, terrain. This IS the engine inside 1.frag; here it's
// laid bare so you can see the loop.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Scale
//   b = Octaves (detail levels, 1–7)
//   c = Gain — how fast octaves fade (roughness)
//   d = Scroll speed
//   e = Hue
//   f = Contrast
//   (g,h unused)
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

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

// FBM: sum octaves — double the frequency, scale down the amplitude.
float fbm(vec2 p, int oct, float gain) {
    float v = 0.0, amp = 0.5, norm = 0.0;
    for (int i = 0; i < 7; i++) {
        if (i >= oct) break;
        v    += amp * noise(p);
        norm += amp;
        p    *= 2.0;        // finer detail each octave
        amp  *= gain;       // quieter each octave
    }
    return v / norm;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    int oct    = int(floor(param(b, 1.0, 7.0) + 0.5));
    float gain = param(c, 0.35, 0.75);
    vec2 p = uv * param(a, 1.0, 12.0) + iTime * param(d, 0.0, 0.8);

    float n = fbm(p, oct, gain);
    n = (n - 0.5) * param(f, 1.0, 2.5) + 0.5;

    float hue = param(e, 0.0, 1.0);
    vec3 col = mix(vec3(0.02, 0.0, 0.1), vec3(hue, 0.8, 1.0), clamp(n, 0.0, 1.0));
    fragColor = vec4(col, 1.0);
}
