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
// 18.frag — Glitch Scaffold (B&W)
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Lattice density — grid repeat frequency
//   b = Beam thickness — structural beam radius
//   c = Travel speed — camera fly-through
//   d = Rotation — camera spin
//   e = Glitch — vertex displacement
//   f = Pulse — traveling light band
//   g = Cross beams — diagonal strut amount
//   h = Brightness
// ============================================================

#define PI 3.14159265359

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash_f(float n) { return fract(sin(n) * 43758.5453); }

mat3 rotY(float a2) { float c2 = cos(a2), s = sin(a2); return mat3(c2,0,s, 0,1,0, -s,0,c2); }
mat3 rotX(float a2) { float c2 = cos(a2), s = sin(a2); return mat3(1,0,0, 0,c2,-s, 0,s,c2); }

float sdBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

float lattice(vec3 p, float beamR, float crossAmt) {
    // Repeat domain
    vec3 rep = mod(p + 0.5, 1.0) - 0.5;

    // Main axis beams (X, Y, Z)
    float bx = length(rep.yz) - beamR;
    float by = length(rep.xz) - beamR;
    float bz = length(rep.xy) - beamR;
    float dd = min(bx, min(by, bz));

    // Diagonal cross beams
    float cx = length(vec2(rep.y - rep.z, rep.y + rep.z) * 0.707) - beamR * 0.7;
    float cy = length(vec2(rep.x - rep.z, rep.x + rep.z) * 0.707) - beamR * 0.7;
    dd = min(dd, mix(dd, min(cx, cy), crossAmt));

    return dd;
}

vec3 calcNormal(vec3 p, float beamR, float crossAmt) {
    float ep = 0.004;
    vec3 a0 = vec3( 1, -1, -1);
    vec3 a1 = vec3(-1, -1,  1);
    vec3 a2 = vec3(-1,  1, -1);
    vec3 a3 = vec3( 1,  1,  1);
    return normalize(
        a0 * lattice(p + a0 * ep, beamR, crossAmt) +
        a1 * lattice(p + a1 * ep, beamR, crossAmt) +
        a2 * lattice(p + a2 * ep, beamR, crossAmt) +
        a3 * lattice(p + a3 * ep, beamR, crossAmt)
    );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float latDens   = param(a, 0.5, 2.0);
    float beamR     = param(b, 0.02, 0.08);
    float travelSpd = param(c, 0.3, 3.0);
    float rotSpd    = param(d, 0.0, 1.0);
    float glitchAmt = param(e, 0.0, 1.5);
    float pulseSpd  = param(f, 1.0, 6.0);
    float crossAmt  = g;
    float bright    = param(h, 0.5, 2.0);

    float t = iTime;
    float gt = floor(t * 6.0);

    // Glitch UV
    float lineGlitch = hash_f(floor(uv.y * 20.0) + gt);
    uv.x += (lineGlitch - 0.5) * 0.06 * glitchAmt * step(0.83, lineGlitch);

    // Camera flying through lattice
    mat3 rot = rotY(t * rotSpd * 0.3) * rotX(sin(t * rotSpd * 0.2) * 0.15);
    vec3 ro = vec3(sin(t * 0.2) * 0.3, cos(t * 0.15) * 0.2, t * travelSpd);
    vec3 rd = rot * normalize(vec3(uv, -0.8));

    // Scale to lattice
    ro *= latDens;

    float totalDist = 0.0;
    float bw = 0.0;

    for (int i = 0; i < 50; i++) {
        vec3 p = ro + rd * totalDist;

        // Glitch: displace some lattice cells
        vec3 cellID = floor(p + 0.5);
        float glitchTrigger = step(0.7, hash_f(dot(cellID, vec3(7.1, 13.3, 17.7)) + gt));
        p += vec3(
            hash_f(cellID.x + gt * 1.1) - 0.5,
            hash_f(cellID.y + gt * 2.3) - 0.5,
            hash_f(cellID.z + gt * 3.7) - 0.5
        ) * glitchAmt * glitchTrigger * 0.15;

        float dd = lattice(p, beamR, crossAmt);

        if (dd < 0.003) {
            vec3 nor = calcNormal(p, beamR, crossAmt);
            vec3 lightDir = normalize(vec3(0.5, 1.0, -0.3));
            float diff = max(dot(nor, lightDir), 0.0) * 0.7 + 0.3;
            float spec = pow(max(dot(reflect(-lightDir, nor), -rd), 0.0), 20.0);
            float fres = pow(1.0 - max(dot(nor, -rd), 0.0), 3.0);

            float pulse = sin(p.z * 4.0 - t * pulseSpd) * 0.3 + 0.7;
            float flicker = 1.0 - glitchAmt * 0.25 * step(0.8, hash_f(gt + cellID.z));

            bw = diff + spec * 0.4 + fres * 0.3;
            bw *= pulse * flicker;

            float fog = exp(-totalDist * 0.08);
            bw *= fog;
            break;
        }
        if (totalDist > 15.0) break;
        totalDist += dd * 0.9;
    }

    // Scan lines
    float scanLine = sin(fragCoord.y * 2.0) * 0.5 + 0.5;
    bw *= 0.88 + scanLine * 0.12;

    // Block glitch
    vec2 blockUV = floor(uv * 8.0);
    float blockTrigger = step(0.92 - glitchAmt * 0.1, hash_f(dot(blockUV, vec2(127.1, 311.7)) + gt));
    bw *= 1.0 + blockTrigger * 0.5;

    // Grain
    float grain = hash_f(dot(fragCoord.xy, vec2(12.9898, 78.233)) + t * 50.0);
    bw += (grain - 0.5) * 0.04 * (0.3 + glitchAmt * 0.7);

    bw *= bright;
    bw = bw / (1.0 + bw * 0.5);
    fragColor = vec4(vec3(clamp(bw, 0.0, 1.0)), 1.0);
}
