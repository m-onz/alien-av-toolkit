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
// 51.frag — Glitch Mycelium (B&W)
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Density — branch density / network thickness
//   b = Warp — domain warp for organic branching
//   c = Flow speed — animation of nutrient flow
//   d = Scale — zoom level
//   e = Branch threshold — how much of the noise becomes visible
//   f = Glitch — digital corruption
//   g = Pulse — traveling light pulse rate
//   h = Brightness
// ============================================================

#define PI 3.14159265359

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash_f(float n) { return fract(sin(n) * 43758.5453); }
float hash2_f(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 ff = fract(p);
    ff = ff * ff * (3.0 - 2.0 * ff);
    return mix(mix(hash2_f(i), hash2_f(i + vec2(1.0, 0.0)), ff.x),
               mix(hash2_f(i + vec2(0.0, 1.0)), hash2_f(i + vec2(1.0, 1.0)), ff.x), ff.y);
}

float ridgedNoise(vec2 p) {
    return 1.0 - abs(vnoise(p) * 2.0 - 1.0);
}

float fbmRidged(vec2 p, int octaves) {
    float v = 0.0;
    float amp = 0.5;
    float prev = 1.0;
    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        float n = ridgedNoise(p);
        n = n * n;
        v += n * amp * prev;
        prev = n;
        p *= 2.0;
        amp *= 0.5;
    }
    return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float density   = param(a, 0.3, 1.0);
    float warpAmt   = param(b, 0.0, 2.5);
    float flowSpd   = param(c, 0.2, 1.5);
    float scale     = param(d, 3.0, 10.0);
    float threshold = param(e, 0.2, 0.7);
    float glitchAmt = param(f, 0.0, 1.5);
    float pulseSpd  = param(g, 1.0, 6.0);
    float bright    = param(h, 0.5, 2.0);

    float t = iTime * flowSpd;
    float gt = floor(t * 6.0);

    // Glitch UV
    float lineGlitch = hash_f(floor(uv.y * 20.0) + gt);
    uv.x += (lineGlitch - 0.5) * 0.08 * glitchAmt * step(0.83, lineGlitch);

    vec2 p = uv * scale;

    // Multi-layer domain warp for organic branching
    float w1 = vnoise(p * 0.3 + vec2(t * 0.4, 0.0)) * 2.0 - 1.0;
    float w2 = vnoise(p * 0.3 + vec2(0.0, t * 0.3) + 50.0) * 2.0 - 1.0;
    p += vec2(w1, w2) * warpAmt;

    float w3 = vnoise(p * 0.5 + vec2(t * 0.2, t * 0.1)) * 2.0 - 1.0;
    float w4 = vnoise(p * 0.5 + vec2(t * 0.15, t * 0.25) + 100.0) * 2.0 - 1.0;
    p += vec2(w3, w4) * warpAmt * 0.5;

    // Ridged noise creates branch-like structures
    float branches = 0.0;
    for (int layer = 0; layer < 3; layer++) {
        float fl = float(layer);
        float ls = 1.0 + fl * 0.7;
        float lw = 1.0 - fl * 0.25;
        float ridged = fbmRidged(p * ls + vec2(fl * 5.0, fl * 7.0), 4 + layer);
        float branch = smoothstep(threshold + fl * 0.05, threshold - 0.05, ridged) * lw;
        branches += branch;
    }

    // Flow pulse along branches
    float flowPhase = vnoise(p * 0.5 + t * 0.5) * 2.0 - 1.0;
    float pulse = sin(flowPhase * 10.0 - t * pulseSpd) * 0.3 + 0.7;

    float bw = branches * density * pulse;

    // Node glow at intersections (where multiple branch layers overlap)
    float nodeGlow = smoothstep(1.5, 2.5, branches) * 0.5;
    bw += nodeGlow;

    // Block glitch
    vec2 blockUV = floor(uv * 10.0);
    float blockTrigger = step(0.92 - glitchAmt * 0.1, hash2_f(blockUV + vec2(gt)));
    bw *= 1.0 + blockTrigger * 0.4;

    // Scan lines
    float scanLine = sin(fragCoord.y * 2.0) * 0.5 + 0.5;
    bw *= 0.88 + scanLine * 0.12;

    // Grain
    float grain = hash2_f(fragCoord.xy + vec2(t * 100.0)) * 0.08;
    bw += grain * glitchAmt * 0.4;

    // Flicker
    float flicker = 0.93 + 0.07 * sin(t * 25.0 + hash_f(gt) * 50.0);
    bw *= flicker;

    bw *= bright;
    bw = bw / (1.0 + bw * 0.5);
    fragColor = vec4(vec3(clamp(bw, 0.0, 1.0)), 1.0);
}
