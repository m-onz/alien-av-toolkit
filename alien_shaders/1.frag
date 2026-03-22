/////////////////////////start Pd Header
uniform vec3 iResolution;
uniform float iTime;
uniform float iGlobalTime;
uniform vec4 iMouse;
uniform float a, b, c, d, e, f, g, h;

void mainImage(out vec4 fragColor, in vec2 fragCoord);

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
/////////////////////////end Pd Header

// ============================================================
// 1.frag — Fluid Flow / Smoke
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Layer mix — blend between single and dual fbm layers  [0 .. 3.86]
//   b = Turbulence — spatial frequency / scale of the flow    [3 .. 28.2]
//   c = Complexity — blend factor for detail richness          [0 .. 1]
//   d = Warp amount — strength of domain warping              [0.3 .. 6.5]
//   e = Hue — base color hue (0–1 maps directly)
//   f = Speed — animation rate                                [0.2 .. 2.2]
//   g = Density — brightness / thickness of the smoke         [0.3 .. 1.6]
//   h = Highlight — intensity of bright peak highlights       [0.1 .. 1.22]
// ============================================================

// --- Utility ---
float saturate(float x) { return clamp(x, 0.0, 1.0); }
float param(float p, float lo, float hi) { return mix(lo, hi, p); }

#define PI 3.14159265359
#define TAU 6.28318530718

// --- UV ---
vec2 uvCenter(vec2 fragCoord, vec2 resolution) {
    return (fragCoord - 0.5 * resolution) / resolution.y;
}

// --- Hash ---
float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.13);
    p3 += dot(p3, p3.yzx + 3.333);
    return fract((p3.x + p3.y) * p3.z);
}

// --- Noise ---
float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// --- FBM (5 octaves) ---
float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 5; ++i) { v += a * noise(p); p = rot * p * 2.0 + 100.0; a *= 0.5; }
    return v;
}

// --- Domain Warp ---
vec2 warp(vec2 p, float amount, float t) {
    vec2 q = vec2(fbm(p + vec2(0.0, 0.0) + t * 0.1), fbm(p + vec2(5.2, 1.3) + t * 0.1));
    return p + amount * q;
}

// --- HSV ---
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
vec3 hsv(float h, float s, float v) { return hsv2rgb(vec3(h, s, v)); }

// --- Main ---
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = uvCenter(fragCoord, iResolution.xy);

    float speed      = param(f, 0.2, 2.2);
    float turbulence = param(b, 3.0, 28.2);
    float hue        = e;
    float density    = param(g, 0.3, 1.6);
    float warpAmt    = param(d, 0.3, 6.5);
    float layerMix   = param(a, 0.0, 3.86);
    float complexity  = param(c, 0.0, 1.0);
    float highlightAmt = param(h, 0.1, 1.22);

    float t = iTime * speed;

    // Double domain warp for deep organic folds
    vec2 p = uv * turbulence;
    vec2 q = vec2(fbm(p + t * 0.12), fbm(p + vec2(5.2, 1.3) + t * 0.1));
    vec2 r = vec2(fbm(p + warpAmt * q + vec2(1.7, 9.2) + t * 0.08),
                  fbm(p + warpAmt * q + vec2(8.3, 2.8) + t * 0.09));
    p += warpAmt * r;

    // Two noise layers at different scales and speeds
    float f1 = fbm(p + t * 0.2);
    float f2 = fbm(p * 1.8 - t * 0.15 + 50.0);
    float f3 = fbm(p * 0.5 + t * 0.05);

    f1 = mix(f1 * 0.7, f1, complexity);
    f2 = mix(f2 * 0.5, f2, complexity);

    // Layer blend: a=0 uses f1 with slow swirl, a=1 multiplies layers for more contrast
    float flow = mix(f1, f1 * f2 * 2.0, layerMix) * density;

    // Three-color gradient: deep shadow → mid → bright
    vec3 col1 = hsv(hue, 0.75, 0.95);
    vec3 col2 = hsv(hue + 0.08, 0.6, 0.5);
    vec3 col3 = hsv(hue + 0.2, 0.4, 0.08);
    vec3 col = mix(col3, col2, smoothstep(0.0, 0.4, flow));
    col = mix(col, col1, smoothstep(0.4, 1.0, flow));

    // Bright veins from warp field
    float warpIntensity = length(r - q) * 1.5;
    col += hsv(hue + 0.1, 0.5, 1.0) * pow(warpIntensity, 2.0) * 0.15;

    // Highlights on peaks
    float highlight = pow(saturate(f1), 4.0);
    col += vec3(1.0, 0.95, 0.8) * highlight * highlightAmt;

    // Subtle large-scale color shift from f3
    col = mix(col, col * hsv(hue + 0.5, 0.3, 1.2), f3 * 0.2);


    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
