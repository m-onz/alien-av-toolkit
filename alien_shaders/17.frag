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
// 17.frag — Ripple Interference Sphere
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Ripple height — amplitude of wave displacement
//   b = Ripple freq — number of concentric wave rings
//   c = Emitter count — how many ripple sources on the surface
//   d = Rotation speed — rate of sphere rotation
//   e = Wave speed — propagation rate of ripples
//   f = Decay — how fast ripples fade with distance
//   g = Pulse — rhythmic expansion/contraction
//   h = Contour — topographic contour line intensity
// ============================================================

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3 saturate3(vec3 x) { return clamp(x, 0.0, 1.0); }
float param(float p, float lo, float hi) { return mix(lo, hi, p); }

#define PI 3.14159265359
#define TAU 6.28318530718

// --- Hash ---
float hash31(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// --- Fixed emitter positions on unit sphere ---
vec3 emitterPos(int idx) {
    float fi = float(idx);
    // Spread points using golden ratio spiral
    float y = 1.0 - (fi / 7.0) * 2.0;
    float r = sqrt(1.0 - y * y);
    float phi = fi * 2.399963; // golden angle
    return normalize(vec3(cos(phi) * r, y, sin(phi) * r));
}

// --- Ripple displacement from multiple emitters ---
float rippleDisp(vec3 n, int count, float freq, float waveSpeed, float decay, float t) {
    float disp = 0.0;
    for (int i = 0; i < 8; i++) {
        if (i >= count) break;
        vec3 ep = emitterPos(i);
        // Geodesic distance on sphere
        float gd = acos(clamp(dot(n, ep), -1.0, 1.0));
        // Phase offset per emitter
        float phase = float(i) * 1.7;
        // Expanding concentric rings
        float wave = sin(gd * freq - t * waveSpeed + phase);
        // Decay with distance from emitter
        float atten = exp(-gd * decay);
        disp += wave * atten;
    }
    return disp / max(float(count), 1.0);
}

// --- Rotation ---
mat3 rotY(float ang) { float c = cos(ang), s = sin(ang); return mat3(c,0,s, 0,1,0, -s,0,c); }
mat3 rotX(float ang) { float c = cos(ang), s = sin(ang); return mat3(1,0,0, 0,c,-s, 0,s,c); }

// --- Sphere SDF with ripple displacement ---
float sphereSDF(vec3 p, float radius, float rippleH, int emCount, float freq, float waveSpeed, float decay, float t) {
    float base = length(p) - radius;
    vec3 n = normalize(p);
    float rip = rippleDisp(n, emCount, freq, waveSpeed, decay, t) * rippleH;
    return base - rip;
}

// --- Raymarching ---
float raymarch(vec3 ro, vec3 rd, float radius, float rippleH, int emCount, float freq, float waveSpeed, float decay, float t) {
    float dist = 0.0;
    for (int i = 0; i < 90; i++) {
        vec3 p = ro + rd * dist;
        float sd = sphereSDF(p, radius, rippleH, emCount, freq, waveSpeed, decay, t);
        if (abs(sd) < 0.0008) break;
        if (dist > 5.0) break;
        dist += sd * 0.5;
    }
    return dist;
}

// --- Normal estimation ---
vec3 calcNormal(vec3 p, float radius, float rippleH, int emCount, float freq, float waveSpeed, float decay, float t) {
    vec2 ep = vec2(0.001, 0.0);
    return normalize(vec3(
        sphereSDF(p + ep.xyy, radius, rippleH, emCount, freq, waveSpeed, decay, t) -
        sphereSDF(p - ep.xyy, radius, rippleH, emCount, freq, waveSpeed, decay, t),
        sphereSDF(p + ep.yxy, radius, rippleH, emCount, freq, waveSpeed, decay, t) -
        sphereSDF(p - ep.yxy, radius, rippleH, emCount, freq, waveSpeed, decay, t),
        sphereSDF(p + ep.yyx, radius, rippleH, emCount, freq, waveSpeed, decay, t) -
        sphereSDF(p - ep.yyx, radius, rippleH, emCount, freq, waveSpeed, decay, t)
    ));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float rippleH    = param(a, 0.0, 0.4);
    float freq       = param(b, 5.0, 30.0);
    int emCount      = int(param(c, 1.0, 8.0));
    float rotSpeed   = param(d, 0.1, 1.5);
    float waveSpeed  = param(e, 1.0, 8.0);
    float decay      = param(f, 0.5, 5.0);
    float pulseAmt   = param(g, 0.0, 0.3);
    float contour    = param(h, 0.0, 1.0);

    float t = iTime;
    float radius = 0.8 + sin(t * 2.0) * pulseAmt;

    // Camera
    vec3 ro = vec3(0.0, 0.0, 2.5);
    vec3 rd = normalize(vec3(uv, -1.0));

    // Rotate
    mat3 rot = rotY(t * rotSpeed) * rotX(t * rotSpeed * 0.3);
    vec3 ro2 = rot * ro;
    vec3 rd2 = rot * rd;

    float dist = raymarch(ro2, rd2, radius, rippleH, emCount, freq, waveSpeed, decay, t);

    vec3 col = vec3(0.0);

    if (dist < 5.0) {
        vec3 p = ro2 + rd2 * dist;
        vec3 nor = calcNormal(p, radius, rippleH, emCount, freq, waveSpeed, decay, t);
        vec3 sn = normalize(p);

        // Ripple value for texturing
        float rip = rippleDisp(sn, emCount, freq, waveSpeed, decay, t);

        // Contour lines from displacement height
        float contourLines = abs(fract(rip * 5.0) - 0.5) * 2.0;
        contourLines = smoothstep(0.0, 0.08, contourLines);
        float contourPattern = mix(1.0, contourLines, contour);

        // Height-based shading (peaks bright, troughs dark)
        float heightShade = rip * 0.5 + 0.5;

        // Lighting
        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
        float diff = max(dot(nor, lightDir), 0.0);
        float spec = pow(max(dot(reflect(-lightDir, nor), -normalize(rd2)), 0.0), 24.0);
        float fres = pow(1.0 - max(dot(nor, -normalize(rd2)), 0.0), 3.0);

        float surface = heightShade * contourPattern * (0.3 + 0.7 * diff);
        surface += spec * 0.4;
        surface += fres * 0.15;

        col = vec3(surface);
    }

    // Background glow
    float bgGlow = exp(-length(uv) * 2.0) * 0.03;
    col += bgGlow;

    col = saturate3(col);
    fragColor = vec4(col, 1.0);
}
