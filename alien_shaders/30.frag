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
// 30.frag — Glitch Tube Network (B&W)
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Tube count — number of 3D tubes
//   b = Tube radius — thickness of tubes
//   c = Bend amount — how curvy the tubes are
//   d = Pulse speed — electric pulse travel rate
//   e = Rotation — camera orbit speed
//   f = Glow — bloom around tubes
//   g = Branch count — sub-branches per tube
//   h = Glitch — vertex distortion / broken jitter
// ============================================================

float param(float p, float lo, float hi) { return mix(lo, hi, p); }

#define PI 3.14159265359
#define TAU 6.28318530718

float hash_f(float n) { return fract(sin(n) * 43758.5453); }

// --- Rotation ---
mat3 rotY(float ang) { float c = cos(ang), s = sin(ang); return mat3(c,0,s, 0,1,0, -s,0,c); }
mat3 rotX(float ang) { float c = cos(ang), s = sin(ang); return mat3(1,0,0, 0,c,-s, 0,s,c); }

// --- Capsule SDF ---
float sdCapsule(vec3 p, vec3 aa, vec3 bb, float r) {
    vec3 pa = p - aa;
    vec3 ba = bb - aa;
    float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * hh) - r;
}

// --- Glitch offset ---
vec3 glitchOffset(float seed, float glitchAmt, float gt) {
    float trigger = step(0.6, hash_f(seed * 3.7 + gt));
    vec3 offset = vec3(
        hash_f(seed + gt * 1.1) - 0.5,
        hash_f(seed + gt * 2.3 + 10.0) - 0.5,
        hash_f(seed + gt * 3.7 + 20.0) - 0.5
    );
    return offset * glitchAmt * trigger;
}

// --- 3D curve point (4 segments instead of 6) ---
vec3 tubePoint(float idx, float s, float bend, float glitchAmt, float t, float gt) {
    float seed = idx * 7.13;
    float ax = hash_f(seed) * TAU;
    float ay = hash_f(seed + 1.0) * PI - PI * 0.5;
    vec3 dir = vec3(cos(ay) * cos(ax), sin(ay), cos(ay) * sin(ax));

    vec3 pos = dir * (-0.6 + s * 1.2);

    float bp1 = hash_f(seed + 2.0) * TAU;
    float bp2 = hash_f(seed + 3.0) * TAU;
    float bf = 2.0 + hash_f(seed + 4.0) * 2.0;

    vec3 perp1 = normalize(cross(dir, vec3(0.0, 1.0, 0.1)));
    vec3 perp2 = normalize(cross(dir, perp1));

    pos += perp1 * sin(s * bf + t * 0.5 + bp1) * bend * 0.3;
    pos += perp2 * sin(s * bf * 1.3 + t * 0.7 + bp2) * bend * 0.25;
    pos += glitchOffset(seed + s * 100.0, glitchAmt, gt);

    return pos;
}

// --- Distance to tube (4 segments) ---
float tubeDist(vec3 p, float idx, float bend, float radius, float glitchAmt, float t, float gt) {
    float dd = 1e5;
    vec3 prev = tubePoint(idx, 0.0, bend, glitchAmt, t, gt);
    for (int j = 1; j <= 4; j++) {
        float s = float(j) * 0.25;
        vec3 cur = tubePoint(idx, s, bend, glitchAmt, t, gt);
        dd = min(dd, sdCapsule(p, prev, cur, radius));
        prev = cur;
    }
    return dd;
}

// --- Branch (single capsule) ---
float branchDist(vec3 p, float idx, float branchIdx, float bend, float radius, float glitchAmt, float t, float gt) {
    float midS = 0.3 + branchIdx * 0.25;
    vec3 mid = tubePoint(idx, midS, bend, glitchAmt, t, gt);

    float seed = idx * 31.0 + branchIdx * 11.0;
    float bax = hash_f(seed) * TAU;
    float bay = hash_f(seed + 1.0) * PI - PI * 0.5;
    vec3 bdir = vec3(cos(bay) * cos(bax), sin(bay), cos(bay) * sin(bax));

    vec3 tip = mid + bdir * 0.22;
    tip += glitchOffset(seed + 80.0, glitchAmt, gt);

    return sdCapsule(p, mid, tip, radius * 0.6);
}

// --- Scene SDF ---
vec2 sceneSDF(vec3 p, int numTubes, float radius, float bend, int numBranches, float glitchAmt, float t, float gt) {
    float dd = 1e5;
    float closest = 0.0;

    for (int i = 0; i < 7; i++) {
        if (i >= numTubes) break;
        float idx = float(i);

        float td = tubeDist(p, idx, bend, radius, glitchAmt, t, gt);
        if (td < dd) { dd = td; closest = idx; }

        for (int j = 0; j < 2; j++) {
            if (j >= numBranches) break;
            float bd = branchDist(p, idx, float(j), bend, radius, glitchAmt, t, gt);
            if (bd < dd) { dd = bd; closest = idx + 0.5; }
        }
    }

    return vec2(dd, closest);
}

// --- Raymarching (50 steps, bigger stride) ---
vec2 raymarch(vec3 ro, vec3 rd, int numTubes, float radius, float bend, int numBranches, float glitchAmt, float t, float gt) {
    float dist = 0.0;
    float idx = 0.0;
    for (int i = 0; i < 50; i++) {
        vec3 p = ro + rd * dist;
        vec2 sc = sceneSDF(p, numTubes, radius, bend, numBranches, glitchAmt, t, gt);
        if (sc.x < 0.004) { idx = sc.y; break; }
        if (dist > 6.0) break;
        dist += sc.x * 0.9;
        idx = sc.y;
    }
    return vec2(dist, idx);
}

// --- Normal (tetrahedral — 4 samples instead of 6) ---
vec3 calcNormal(vec3 p, int numTubes, float radius, float bend, int numBranches, float glitchAmt, float t, float gt) {
    float ep = 0.005;
    vec3 a0 = vec3( 1, -1, -1);
    vec3 a1 = vec3(-1, -1,  1);
    vec3 a2 = vec3(-1,  1, -1);
    vec3 a3 = vec3( 1,  1,  1);
    return normalize(
        a0 * sceneSDF(p + a0 * ep, numTubes, radius, bend, numBranches, glitchAmt, t, gt).x +
        a1 * sceneSDF(p + a1 * ep, numTubes, radius, bend, numBranches, glitchAmt, t, gt).x +
        a2 * sceneSDF(p + a2 * ep, numTubes, radius, bend, numBranches, glitchAmt, t, gt).x +
        a3 * sceneSDF(p + a3 * ep, numTubes, radius, bend, numBranches, glitchAmt, t, gt).x
    );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    int numTubes     = 2 + int(a * 5.0);
    float radius     = param(b, 0.015, 0.06);
    float bend       = param(c, 0.0, 2.0);
    float pulseSpeed = param(d, 1.0, 8.0);
    float rotSpeed   = param(e, 0.1, 1.0);
    float glowAmt    = param(f, 0.0, 1.5);
    int numBranches  = int(g * 2.0);
    float glitchAmt  = param(h, 0.0, 1.5);

    float t = iTime;
    float gt = floor(t * 6.0);

    // Camera
    mat3 rot = rotY(t * rotSpeed * 0.5) * rotX(sin(t * rotSpeed * 0.3) * 0.3);
    vec3 ro = rot * vec3(0.0, 0.0, 2.2);
    vec3 rd = rot * normalize(vec3(uv, -1.0));

    vec2 hit = raymarch(ro, rd, numTubes, radius, bend, numBranches, glitchAmt, t, gt);
    float dist = hit.x;
    float tubeIdx = hit.y;

    float bw = 0.0;

    if (dist < 6.0) {
        vec3 p = ro + rd * dist;
        vec3 nor = calcNormal(p, numTubes, radius, bend, numBranches, glitchAmt, t, gt);

        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
        float diff = max(dot(nor, lightDir), 0.0);
        float spec = pow(max(dot(reflect(-lightDir, nor), -rd), 0.0), 16.0);
        float fres = pow(1.0 - max(dot(nor, -rd), 0.0), 3.0);

        float pulse = sin(p.z * 10.0 - t * pulseSpeed + tubeIdx * 2.0) * 0.5 + 0.5;
        float flicker = 1.0 - glitchAmt * 0.2 * step(0.8, hash_f(gt + tubeIdx * 3.0));

        bw = (0.3 + 0.7 * diff);
        bw += spec * 0.5;
        bw += fres * 0.4;
        bw *= flicker;
        bw *= 0.7 + pulse * 0.3;
        bw += glowAmt * fres * 0.5;
    }

    bw += exp(-length(uv) * 2.0) * 0.03;
    bw = bw / (1.0 + bw * 0.5);

    fragColor = vec4(vec3(clamp(bw, 0.0, 1.0)), 1.0);
}
