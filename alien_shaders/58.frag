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
// 58.frag — Glitch Torus Knot (B&W)
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = P winding — torus knot p parameter
//   b = Q winding — torus knot q parameter
//   c = Tube radius — thickness
//   d = Rotation speed — camera orbit
//   e = Pulse speed — traveling light pulse
//   f = Glitch — vertex distortion
//   g = Torus radius — major radius
//   h = Glow — bloom around knot
// ============================================================

#define PI 3.14159265359
#define TAU 6.28318530718

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash_f(float n) { return fract(sin(n) * 43758.5453); }

mat3 rotY(float a2) { float c2 = cos(a2), s = sin(a2); return mat3(c2,0,s, 0,1,0, -s,0,c2); }
mat3 rotX(float a2) { float c2 = cos(a2), s = sin(a2); return mat3(1,0,0, 0,c2,-s, 0,s,c2); }

vec3 glitchOffset(float seed, float amt, float gt) {
    float trigger = step(0.6, hash_f(seed * 3.7 + gt));
    vec3 off = vec3(
        hash_f(seed + gt * 1.1) - 0.5,
        hash_f(seed + gt * 2.3 + 10.0) - 0.5,
        hash_f(seed + gt * 3.7 + 20.0) - 0.5
    );
    return off * amt * trigger * 0.3;
}

float sdTorusKnot(vec3 p, float pWind, float qWind, float torusR, float tubeR, float glitchAmt, float gt) {
    float bestDist = 1e5;

    for (int i = 0; i < 32; i++) {
        float s = float(i) / 32.0 * TAU;
        float r = torusR + 0.4 * cos(qWind * s);
        vec3 knotPt = vec3(
            r * cos(pWind * s),
            0.4 * sin(qWind * s),
            r * sin(pWind * s)
        );
        knotPt += glitchOffset(s * 10.0, glitchAmt, gt);
        float dd = length(p - knotPt) - tubeR;
        bestDist = min(bestDist, dd);
    }

    return bestDist;
}

vec3 calcNormal(vec3 p, float pW, float qW, float tR, float tubeR, float gA, float gt) {
    float ep = 0.005;
    vec3 a0 = vec3( 1, -1, -1);
    vec3 a1 = vec3(-1, -1,  1);
    vec3 a2 = vec3(-1,  1, -1);
    vec3 a3 = vec3( 1,  1,  1);
    return normalize(
        a0 * sdTorusKnot(p + a0 * ep, pW, qW, tR, tubeR, gA, gt) +
        a1 * sdTorusKnot(p + a1 * ep, pW, qW, tR, tubeR, gA, gt) +
        a2 * sdTorusKnot(p + a2 * ep, pW, qW, tR, tubeR, gA, gt) +
        a3 * sdTorusKnot(p + a3 * ep, pW, qW, tR, tubeR, gA, gt)
    );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float pWind    = 2.0 + floor(a * 3.0);
    float qWind    = 3.0 + floor(b * 4.0);
    float tubeR    = param(c, 0.03, 0.12);
    float rotSpeed = param(d, 0.1, 0.8);
    float pulseSpd = param(e, 1.0, 6.0);
    float glitchAmt= param(f, 0.0, 1.5);
    float torusR   = param(g, 0.6, 1.2);
    float glowAmt  = param(h, 0.0, 1.5);

    float t = iTime;
    float gt = floor(t * 6.0);

    mat3 rot = rotY(t * rotSpeed) * rotX(sin(t * rotSpeed * 0.5) * 0.3);
    vec3 ro = rot * vec3(0.0, 0.0, 3.5);
    vec3 rd = rot * normalize(vec3(uv, -1.2));

    float totalDist = 0.0;
    float bw = 0.0;
    float minDist = 100.0;

    for (int i = 0; i < 50; i++) {
        vec3 p = ro + rd * totalDist;
        float dd = sdTorusKnot(p, pWind, qWind, torusR, tubeR, glitchAmt, gt);
        minDist = min(minDist, dd);

        if (dd < 0.005) {
            vec3 nor = calcNormal(p, pWind, qWind, torusR, tubeR, glitchAmt, gt);
            vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
            float diff = max(dot(nor, lightDir), 0.0);
            float spec = pow(max(dot(reflect(-lightDir, nor), -rd), 0.0), 24.0);
            float fres = pow(1.0 - max(dot(nor, -rd), 0.0), 3.0);

            float angle = atan(p.z, p.x);
            float pulse = sin(angle * 4.0 - t * pulseSpd) * 0.5 + 0.5;
            float flicker = 1.0 - glitchAmt * 0.25 * step(0.8, hash_f(gt + angle * 2.0));

            bw = (0.25 + 0.75 * diff);
            bw += spec * 0.5;
            bw += fres * 0.35;
            bw *= flicker;
            bw *= 0.65 + pulse * 0.35;
            bw += glowAmt * fres * 0.5;
            break;
        }
        if (totalDist > 10.0) break;
        totalDist += dd * 0.8;
    }

    // Near-miss glow
    bw += exp(-minDist * 3.0) * glowAmt * 0.15;

    // Scan lines
    float scanLine = sin(fragCoord.y * 2.0) * 0.5 + 0.5;
    bw *= 0.88 + scanLine * 0.12;

    // Grain
    float grain = hash_f(dot(fragCoord.xy, vec2(12.9898, 78.233)) + t * 50.0);
    bw += (grain - 0.5) * 0.05 * (0.3 + glitchAmt * 0.7);

    // Flicker
    float flicker2 = 0.93 + 0.07 * sin(t * 25.0 + hash_f(gt) * 40.0);
    bw *= flicker2;

    bw = bw / (1.0 + bw * 0.5);
    fragColor = vec4(vec3(clamp(bw, 0.0, 1.0)), 1.0);
}
