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
// 67.frag — Glitch Gyroscope (B&W)
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Ring count — number of nested rings
//   b = Ring thickness — tube radius
//   c = Gyro radius — overall size
//   d = Spin speed — rotation rate
//   e = Wobble — axis tilt oscillation
//   f = Glitch — vertex jitter / distortion
//   g = Pulse — traveling light ring
//   h = Brightness
// ============================================================

#define PI 3.14159265359
#define TAU 6.28318530718

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash_f(float n) { return fract(sin(n) * 43758.5453); }

mat3 rotY(float a2) { float c2 = cos(a2), s = sin(a2); return mat3(c2,0,s, 0,1,0, -s,0,c2); }
mat3 rotX(float a2) { float c2 = cos(a2), s = sin(a2); return mat3(1,0,0, 0,c2,-s, 0,s,c2); }
mat3 rotZ(float a2) { float c2 = cos(a2), s = sin(a2); return mat3(c2,-s,0, s,c2,0, 0,0,1); }

float sdTorus(vec3 p, float majorR, float minorR) {
    vec2 q = vec2(length(p.xz) - majorR, p.y);
    return length(q) - minorR;
}

vec3 glitchOffset(float seed, float amt, float gt) {
    float trigger = step(0.6, hash_f(seed * 3.7 + gt));
    vec3 off = vec3(
        hash_f(seed + gt * 1.1) - 0.5,
        hash_f(seed + gt * 2.3 + 10.0) - 0.5,
        hash_f(seed + gt * 3.7 + 20.0) - 0.5
    );
    return off * amt * trigger * 0.4;
}

float sceneSDF(vec3 p, int numRings, float majorR, float minorR, float spinSpd,
               float wobble, float glitchAmt, float t, float gt) {
    float dd = 1e5;

    for (int i = 0; i < 6; i++) {
        if (i >= numRings) break;
        float fi = float(i);

        // Each ring has a different rotation axis and speed
        float spinA = t * spinSpd * (0.5 + fi * 0.3) + fi * 1.047;
        float spinB = t * spinSpd * (0.3 + fi * 0.2) + fi * 2.094;
        float tilt = wobble * sin(t * 0.5 + fi * 1.5) * 0.8;

        mat3 ringRot = rotY(spinA) * rotX(spinB + tilt) * rotZ(fi * PI / float(numRings));

        vec3 rp = ringRot * p;
        rp += glitchOffset(fi * 13.0, glitchAmt, gt);

        float ringR = majorR * (0.7 + fi * 0.15);
        float td = sdTorus(rp, ringR, minorR);
        dd = min(dd, td);
    }

    // Central sphere
    float sphere = length(p) - minorR * 2.0;
    dd = min(dd, sphere);

    return dd;
}

vec3 calcNormal(vec3 p, int numRings, float majorR, float minorR, float spinSpd,
                float wobble, float glitchAmt, float t, float gt) {
    float ep = 0.004;
    vec3 a0 = vec3( 1, -1, -1);
    vec3 a1 = vec3(-1, -1,  1);
    vec3 a2 = vec3(-1,  1, -1);
    vec3 a3 = vec3( 1,  1,  1);
    return normalize(
        a0 * sceneSDF(p + a0 * ep, numRings, majorR, minorR, spinSpd, wobble, glitchAmt, t, gt) +
        a1 * sceneSDF(p + a1 * ep, numRings, majorR, minorR, spinSpd, wobble, glitchAmt, t, gt) +
        a2 * sceneSDF(p + a2 * ep, numRings, majorR, minorR, spinSpd, wobble, glitchAmt, t, gt) +
        a3 * sceneSDF(p + a3 * ep, numRings, majorR, minorR, spinSpd, wobble, glitchAmt, t, gt)
    );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    int numRings   = 2 + int(a * 4.0);
    float minorR   = param(b, 0.02, 0.08);
    float majorR   = param(c, 0.5, 1.2);
    float spinSpd  = param(d, 0.2, 2.0);
    float wobble   = param(e, 0.0, 1.5);
    float glitchAmt= param(f, 0.0, 1.5);
    float pulseSpd = param(g, 1.0, 6.0);
    float bright   = param(h, 0.5, 2.0);

    float t = iTime;
    float gt = floor(t * 6.0);

    // Glitch UV distortion
    float glitchTime = floor(t * 5.0);
    vec2 glitchUV = uv;
    float lineGlitch = hash_f(floor(uv.y * 20.0) + glitchTime);
    glitchUV.x += (lineGlitch - 0.5) * 0.08 * glitchAmt * step(0.82, lineGlitch);

    // Camera - slow orbit
    float camAngle = t * 0.2;
    vec3 ro = vec3(sin(camAngle) * 3.5, sin(t * 0.15) * 0.5, cos(camAngle) * 3.5);
    vec3 camFwd = normalize(-ro);
    vec3 camRight = normalize(cross(camFwd, vec3(0.0, 1.0, 0.0)));
    vec3 camUp = cross(camRight, camFwd);
    vec3 rd = normalize(glitchUV.x * camRight + glitchUV.y * camUp + 1.5 * camFwd);

    // Raymarch
    float totalDist = 0.0;
    float minDist = 100.0;
    float bw = 0.0;

    for (int i = 0; i < 50; i++) {
        vec3 p = ro + rd * totalDist;
        float dd = sceneSDF(p, numRings, majorR, minorR, spinSpd, wobble, glitchAmt, t, gt);
        minDist = min(minDist, dd);

        if (dd < 0.003) {
            vec3 nor = calcNormal(p, numRings, majorR, minorR, spinSpd, wobble, glitchAmt, t, gt);

            vec3 lightDir = normalize(vec3(0.6, 0.8, -0.5));
            float diff = max(dot(nor, lightDir), 0.0) * 0.7 + 0.3;

            vec3 viewDir = normalize(ro - p);
            vec3 halfDir = normalize(lightDir + viewDir);
            float spec = pow(max(dot(nor, halfDir), 0.0), 32.0);
            float fresnel = pow(1.0 - max(dot(nor, viewDir), 0.0), 3.0);

            // Pulse along ring circumference
            float angle = atan(p.z, p.x);
            float pulse = sin(angle * 4.0 + length(p) * 3.0 - t * pulseSpd) * 0.3 + 0.7;

            // Flicker
            float flicker = 1.0 - glitchAmt * 0.3 * step(0.75, hash_f(gt + angle * 2.0));

            bw = diff;
            bw += spec * 0.4;
            bw += fresnel * 0.3;
            bw *= pulse * flicker;

            float fog = exp(-totalDist * 0.12);
            bw *= fog;
            break;
        }
        if (totalDist > 10.0) break;
        totalDist += dd * 0.9;
    }

    // Near-miss glow
    bw += exp(-minDist * 4.0) * 0.08;

    // Scan lines
    float scanLine = sin(fragCoord.y * 2.0) * 0.5 + 0.5;
    bw *= 0.88 + scanLine * 0.12;

    // Block glitch
    vec2 blockUV = floor(uv * 8.0);
    float blockTrigger = step(0.92 - glitchAmt * 0.1, hash_f(dot(blockUV, vec2(127.1, 311.7)) + glitchTime));
    bw *= 1.0 + blockTrigger * 0.5;

    // Grain
    float grain = hash_f(dot(fragCoord.xy, vec2(12.9898, 78.233)) + t * 50.0);
    bw += (grain - 0.5) * 0.05 * (0.3 + glitchAmt * 0.7);

    // Flicker
    float flicker2 = 0.93 + 0.07 * sin(t * 25.0 + hash_f(glitchTime) * 40.0);
    bw *= flicker2;

    bw *= bright;
    bw = bw / (1.0 + bw * 0.5);
    fragColor = vec4(vec3(clamp(bw, 0.0, 1.0)), 1.0);
}
