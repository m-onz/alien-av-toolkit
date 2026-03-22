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
// 59.frag — Glitch Plasma Grid (B&W)
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Grid density — number of grid cells
//   b = Warp amount — domain warp intensity
//   c = Warp speed — animation rate of distortion
//   d = Line thickness — grid line width
//   e = Pulse frequency — throbbing rate
//   f = Glitch — corruption / tear effects
//   g = Contrast — edge harshness
//   h = Brightness
// ============================================================

#define PI 3.14159265359

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash_f(float n) { return fract(sin(n) * 43758.5453); }
float hash2_f(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2_f(i), hash2_f(i + vec2(1.0, 0.0)), f.x),
               mix(hash2_f(i + vec2(0.0, 1.0)), hash2_f(i + vec2(1.0, 1.0)), f.x), f.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float gridDens  = param(a, 3.0, 12.0);
    float warpAmt   = param(b, 0.0, 2.0);
    float warpSpd   = param(c, 0.2, 1.5);
    float lineW     = param(d, 0.02, 0.12);
    float pulseFreq = param(e, 1.0, 6.0);
    float glitchAmt = param(f, 0.0, 1.5);
    float contrast  = param(g, 0.5, 2.0);
    float bright    = param(h, 0.5, 2.0);

    float t = iTime;
    float gt = floor(t * 5.0);

    // Glitch UV
    float lineGlitch = hash_f(floor(uv.y * 15.0) + gt);
    uv.x += (lineGlitch - 0.5) * 0.1 * glitchAmt * step(0.82, lineGlitch);

    // Domain warp
    vec2 p = uv * gridDens;
    float wx = vnoise(p * 0.3 + vec2(t * warpSpd * 0.7, 0.0)) * 2.0 - 1.0;
    float wy = vnoise(p * 0.3 + vec2(0.0, t * warpSpd * 0.5) + 50.0) * 2.0 - 1.0;
    p += vec2(wx, wy) * warpAmt;

    // Second warp layer
    float wx2 = vnoise(p * 0.5 + vec2(t * warpSpd * 0.3, t * 0.1)) * 2.0 - 1.0;
    float wy2 = vnoise(p * 0.5 + vec2(t * 0.15, t * warpSpd * 0.2) + 100.0) * 2.0 - 1.0;
    p += vec2(wx2, wy2) * warpAmt * 0.5;

    // Grid lines
    vec2 gf = fract(p);
    float gridX = smoothstep(lineW, 0.0, gf.x) + smoothstep(1.0 - lineW, 1.0, gf.x);
    float gridY = smoothstep(lineW, 0.0, gf.y) + smoothstep(1.0 - lineW, 1.0, gf.y);
    float grid = max(gridX, gridY);

    // Diagonal cross lines
    vec2 gf2 = fract(p + vec2(p.y, p.x) * 0.5);
    float diag = smoothstep(lineW * 0.7, 0.0, gf2.x) + smoothstep(1.0 - lineW * 0.7, 1.0, gf2.x);
    grid = max(grid, diag * 0.5);

    // Pulse
    float pulse = sin(length(uv) * 8.0 - t * pulseFreq) * 0.3 + 0.7;
    grid *= pulse;

    // Cell brightness variation
    vec2 cellID = floor(p);
    float cellBri = hash2_f(cellID + vec2(gt * 0.01)) * 0.3;
    float bw = grid * contrast + cellBri * (1.0 - grid) * 0.2;

    // Glitch block corruption
    vec2 blockUV = floor(uv * 8.0);
    float blockTrigger = step(0.92 - glitchAmt * 0.1, hash_f(dot(blockUV, vec2(127.1, 311.7)) + gt));
    bw = mix(bw, 1.0 - bw, blockTrigger * glitchAmt * 0.5);

    // Scan lines
    float scanLine = sin(fragCoord.y * 2.0) * 0.5 + 0.5;
    bw *= 0.88 + scanLine * 0.12;

    // Grain
    float grain = hash_f(dot(fragCoord.xy, vec2(12.9898, 78.233)) + t * 50.0);
    bw += (grain - 0.5) * 0.05 * (0.3 + glitchAmt * 0.7);

    // Flicker
    float flicker = 0.93 + 0.07 * sin(t * 25.0 + hash_f(gt) * 40.0);
    bw *= flicker;

    bw *= bright;
    bw = bw / (1.0 + bw * 0.5);
    fragColor = vec4(vec3(clamp(bw, 0.0, 1.0)), 1.0);
}
