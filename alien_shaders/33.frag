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
// 33.frag — Glitch Worm (B&W)
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Thickness — tube radius
//   b = Coil tightness — how tightly the worm spirals
//   c = Coil radius — how wide the spiral path is
//   d = Pulse speed — traveling pulse rate along the worm
//   e = Rotation — camera orbit speed
//   f = Length — how long the worm is
//   g = Glitch — vertex distortion / broken jitter
//   h = Noise warp — continuous noise displacement on vertices
// ============================================================

float param(float p, float lo, float hi) { return mix(lo, hi, p); }

#define PI 3.14159265359
#define TAU 6.28318530718

float hash_f(float n) { return fract(sin(n) * 43758.5453); }

mat3 rotY(float ang) { float c = cos(ang), s = sin(ang); return mat3(c,0,s, 0,1,0, -s,0,c); }
mat3 rotX(float ang) { float c = cos(ang), s = sin(ang); return mat3(1,0,0, 0,c,-s, 0,s,c); }

float sdCapsule(vec3 p, vec3 aa, vec3 bb, float r) {
    vec3 pa = p - aa;
    vec3 ba = bb - aa;
    float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * hh) - r;
}

// --- Glitch offset (quantized stuttery jumps) ---
vec3 glitchJump(float seed, float amt, float gt) {
    float trigger = step(0.55, hash_f(seed * 3.7 + gt));
    vec3 off = vec3(
        hash_f(seed + gt * 1.1) - 0.5,
        hash_f(seed + gt * 2.3 + 10.0) - 0.5,
        hash_f(seed + gt * 3.7 + 20.0) - 0.5
    );
    return off * amt * trigger;
}

// --- Continuous noise warp (smooth organic distortion) ---
vec3 noiseWarp(float seed, float amt, float t) {
    return vec3(
        sin(seed * 5.7 + t * 1.3) * cos(seed * 3.1 + t * 0.9),
        cos(seed * 4.3 + t * 1.1) * sin(seed * 6.7 + t * 0.7),
        sin(seed * 7.1 + t * 0.8) * cos(seed * 2.9 + t * 1.5)
    ) * amt;
}

// --- Worm path: 3D Lissajous knot ---
vec3 wormPoint(float s, float coilTight, float coilRad, float glitchAmt, float noiseAmt, float t, float gt) {
    float phase = s * coilTight + t * 0.5;
    vec3 pos = vec3(
        sin(phase) * coilRad,
        sin(phase * 0.7 + 1.0) * coilRad * 0.8,
        cos(phase * 0.6 + 2.0) * coilRad * 0.9
    );
    // Secondary wobble
    pos.x += sin(phase * 2.3 + t * 0.3) * coilRad * 0.3;
    pos.y += cos(phase * 1.9 - t * 0.4) * coilRad * 0.25;

    pos += glitchJump(s * 50.0, glitchAmt, gt);
    pos += noiseWarp(s * 30.0, noiseAmt, t);

    return pos;
}

// --- Distance to worm (8 capsule segments) ---
float wormDist(vec3 p, float radius, float coilTight, float coilRad, float wormLen,
               float glitchAmt, float noiseAmt, float t, float gt, out float along) {
    float dd = 1e5;
    along = 0.0;
    vec3 prev = wormPoint(0.0, coilTight, coilRad, glitchAmt, noiseAmt, t, gt);
    for (int j = 1; j <= 8; j++) {
        float s = float(j) / 8.0 * wormLen;
        vec3 cur = wormPoint(s, coilTight, coilRad, glitchAmt, noiseAmt, t, gt);
        float cd = sdCapsule(p, prev, cur, radius);
        if (cd < dd) {
            dd = cd;
            along = s;
        }
        prev = cur;
    }
    return dd;
}

// --- Scene SDF (just the worm) ---
float sceneSDF(vec3 p, float radius, float coilTight, float coilRad, float wormLen,
               float glitchAmt, float noiseAmt, float t, float gt) {
    float along;
    return wormDist(p, radius, coilTight, coilRad, wormLen, glitchAmt, noiseAmt, t, gt, along);
}

// --- Raymarching ---
vec2 raymarch(vec3 ro, vec3 rd, float radius, float coilTight, float coilRad, float wormLen,
              float glitchAmt, float noiseAmt, float t, float gt) {
    float dist = 0.0;
    float along = 0.0;
    for (int i = 0; i < 50; i++) {
        vec3 p = ro + rd * dist;
        float dd = wormDist(p, radius, coilTight, coilRad, wormLen, glitchAmt, noiseAmt, t, gt, along);
        if (dd < 0.004) break;
        if (dist > 6.0) break;
        dist += dd * 0.9;
    }
    return vec2(dist, along);
}

// --- Normal (tetrahedral) ---
vec3 calcNormal(vec3 p, float radius, float coilTight, float coilRad, float wormLen,
                float glitchAmt, float noiseAmt, float t, float gt) {
    float ep = 0.005;
    vec3 a0 = vec3( 1, -1, -1);
    vec3 a1 = vec3(-1, -1,  1);
    vec3 a2 = vec3(-1,  1, -1);
    vec3 a3 = vec3( 1,  1,  1);
    return normalize(
        a0 * sceneSDF(p + a0 * ep, radius, coilTight, coilRad, wormLen, glitchAmt, noiseAmt, t, gt) +
        a1 * sceneSDF(p + a1 * ep, radius, coilTight, coilRad, wormLen, glitchAmt, noiseAmt, t, gt) +
        a2 * sceneSDF(p + a2 * ep, radius, coilTight, coilRad, wormLen, glitchAmt, noiseAmt, t, gt) +
        a3 * sceneSDF(p + a3 * ep, radius, coilTight, coilRad, wormLen, glitchAmt, noiseAmt, t, gt)
    );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float radius     = param(a, 0.03, 0.15);
    float coilTight  = param(b, 2.0, 12.0);
    float coilRad    = param(c, 0.3, 1.0);
    float pulseSpeed = param(d, 1.0, 8.0);
    float rotSpeed   = param(e, 0.1, 1.0);
    float wormLen    = param(f, 2.0, 8.0);
    float glitchAmt  = param(g, 0.0, 1.5);
    float noiseAmt   = param(h, 0.0, 0.5);

    float t = iTime;
    float gt = floor(t * 6.0);

    mat3 rot = rotY(t * rotSpeed * 0.5) * rotX(sin(t * rotSpeed * 0.3) * 0.3);
    vec3 ro = rot * vec3(0.0, 0.0, 2.8);
    vec3 rd = rot * normalize(vec3(uv, -1.0));

    vec2 hit = raymarch(ro, rd, radius, coilTight, coilRad, wormLen, glitchAmt, noiseAmt, t, gt);
    float dist = hit.x;
    float along = hit.y;

    float bw = 0.0;

    if (dist < 6.0) {
        vec3 p = ro + rd * dist;
        vec3 nor = calcNormal(p, radius, coilTight, coilRad, wormLen, glitchAmt, noiseAmt, t, gt);

        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
        float diff = max(dot(nor, lightDir), 0.0);
        float spec = pow(max(dot(reflect(-lightDir, nor), -rd), 0.0), 20.0);
        float fres = pow(1.0 - max(dot(nor, -rd), 0.0), 3.0);

        float pulse = sin(along * 8.0 - t * pulseSpeed) * 0.5 + 0.5;
        float flicker = 1.0 - glitchAmt * 0.25 * step(0.8, hash_f(gt + along * 5.0));

        bw = (0.25 + 0.75 * diff);
        bw += spec * 0.5;
        bw += fres * 0.35;
        bw *= flicker;
        bw *= 0.65 + pulse * 0.35;
    }

    bw += exp(-length(uv) * 2.0) * 0.03;
    bw = bw / (1.0 + bw * 0.5);

    fragColor = vec4(vec3(clamp(bw, 0.0, 1.0)), 1.0);
}
