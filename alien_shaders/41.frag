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
// 41.frag — Glitch Double Helix (B&W)
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Helix radius — how wide the helix spirals
//   b = Twist rate — how tightly the strands coil
//   c = Tube thickness — radius of each strand
//   d = Rotation speed — camera orbit
//   e = Pulse speed — traveling pulse along helix
//   f = Glitch — vertex jitter / broken distortion
//   g = Rung density — cross-links between strands
//   h = Glow — bloom intensity
// ============================================================

#define PI 3.14159265359
#define TAU 6.28318530718

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash_f(float n) { return fract(sin(n) * 43758.5453); }

mat3 rotY(float a2) { float c2 = cos(a2), s = sin(a2); return mat3(c2,0,s, 0,1,0, -s,0,c2); }
mat3 rotX(float a2) { float c2 = cos(a2), s = sin(a2); return mat3(1,0,0, 0,c2,-s, 0,s,c2); }

float sdCapsule(vec3 p, vec3 aa, vec3 bb, float r) {
    vec3 pa = p - aa;
    vec3 ba = bb - aa;
    float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * hh) - r;
}

vec3 glitchOffset(float seed, float amt, float gt) {
    float trigger = step(0.6, hash_f(seed * 3.7 + gt));
    vec3 off = vec3(
        hash_f(seed + gt * 1.1) - 0.5,
        hash_f(seed + gt * 2.3 + 10.0) - 0.5,
        hash_f(seed + gt * 3.7 + 20.0) - 0.5
    );
    return off * amt * trigger;
}

vec3 helixPoint(float s, float helixR, float twist, float strand, float glitchAmt, float t, float gt) {
    float angle = s * twist + strand * PI;
    vec3 pos = vec3(
        cos(angle) * helixR,
        s * 2.0 - 3.0,
        sin(angle) * helixR
    );
    pos += glitchOffset(s * 50.0 + strand * 100.0, glitchAmt, gt);
    return pos;
}

float helixDist(vec3 p, float helixR, float twist, float radius, float glitchAmt, float rungDens, float t, float gt) {
    float dd = 1e5;

    // Two strands
    for (int strand = 0; strand < 2; strand++) {
        float fs = float(strand);
        vec3 prev = helixPoint(0.0, helixR, twist, fs, glitchAmt, t, gt);
        for (int j = 1; j <= 8; j++) {
            float s = float(j) / 8.0 * 3.0;
            vec3 cur = helixPoint(s, helixR, twist, fs, glitchAmt, t, gt);
            dd = min(dd, sdCapsule(p, prev, cur, radius));
            prev = cur;
        }
    }

    // Cross rungs
    int numRungs = 2 + int(rungDens * 6.0);
    for (int i = 0; i < 8; i++) {
        if (i >= numRungs) break;
        float s = float(i) / float(numRungs) * 3.0 + 0.15;
        vec3 p1 = helixPoint(s, helixR, twist, 0.0, glitchAmt, t, gt);
        vec3 p2 = helixPoint(s, helixR, twist, 1.0, glitchAmt, t, gt);
        dd = min(dd, sdCapsule(p, p1, p2, radius * 0.5));
    }

    return dd;
}

float sceneSDF(vec3 p, float helixR, float twist, float radius, float glitchAmt, float rungDens, float t, float gt) {
    return helixDist(p, helixR, twist, radius, glitchAmt, rungDens, t, gt);
}

vec3 calcNormal(vec3 p, float helixR, float twist, float radius, float glitchAmt, float rungDens, float t, float gt) {
    float ep = 0.005;
    vec3 a0 = vec3( 1, -1, -1);
    vec3 a1 = vec3(-1, -1,  1);
    vec3 a2 = vec3(-1,  1, -1);
    vec3 a3 = vec3( 1,  1,  1);
    return normalize(
        a0 * sceneSDF(p + a0 * ep, helixR, twist, radius, glitchAmt, rungDens, t, gt) +
        a1 * sceneSDF(p + a1 * ep, helixR, twist, radius, glitchAmt, rungDens, t, gt) +
        a2 * sceneSDF(p + a2 * ep, helixR, twist, radius, glitchAmt, rungDens, t, gt) +
        a3 * sceneSDF(p + a3 * ep, helixR, twist, radius, glitchAmt, rungDens, t, gt)
    );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float helixR    = param(a, 0.3, 0.8);
    float twist     = param(b, 2.0, 8.0);
    float radius    = param(c, 0.03, 0.1);
    float rotSpeed  = param(d, 0.1, 1.0);
    float pulseSpd  = param(e, 1.0, 6.0);
    float glitchAmt = param(f, 0.0, 1.5);
    float rungDens  = g;
    float glowAmt   = param(h, 0.0, 1.5);

    float t = iTime;
    float gt = floor(t * 6.0);

    mat3 rot = rotY(t * rotSpeed * 0.5) * rotX(sin(t * rotSpeed * 0.3) * 0.4);
    vec3 ro = rot * vec3(0.0, 0.0, 4.0);
    vec3 rd = rot * normalize(vec3(uv, -1.0));

    float totalDist = 0.0;
    float bw = 0.0;

    for (int i = 0; i < 50; i++) {
        vec3 p = ro + rd * totalDist;
        float dd = sceneSDF(p, helixR, twist, radius, glitchAmt, rungDens, t, gt);
        if (dd < 0.004) {
            vec3 nor = calcNormal(p, helixR, twist, radius, glitchAmt, rungDens, t, gt);
            vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
            float diff = max(dot(nor, lightDir), 0.0);
            float spec = pow(max(dot(reflect(-lightDir, nor), -rd), 0.0), 24.0);
            float fres = pow(1.0 - max(dot(nor, -rd), 0.0), 3.0);

            float pulse = sin(p.y * 6.0 - t * pulseSpd) * 0.5 + 0.5;
            float flicker = 1.0 - glitchAmt * 0.25 * step(0.8, hash_f(gt + p.y * 3.0));

            bw = (0.25 + 0.75 * diff);
            bw += spec * 0.5;
            bw += fres * 0.35;
            bw *= flicker;
            bw *= 0.65 + pulse * 0.35;
            bw += glowAmt * fres * 0.5;
            break;
        }
        if (totalDist > 8.0) break;
        totalDist += dd * 0.9;
    }

    // Scan lines
    float scanLine = sin(fragCoord.y * 2.0) * 0.5 + 0.5;
    bw *= 0.9 + scanLine * 0.1;

    // Noise grain
    float grain = hash_f(dot(fragCoord.xy, vec2(12.9898, 78.233)) + t * 50.0);
    bw += (grain - 0.5) * 0.04 * (0.3 + glitchAmt * 0.7);

    bw += exp(-length(uv) * 2.0) * 0.03;
    bw = bw / (1.0 + bw * 0.5);

    fragColor = vec4(vec3(clamp(bw, 0.0, 1.0)), 1.0);
}
