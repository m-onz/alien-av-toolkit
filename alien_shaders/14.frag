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
// 14.frag — Fluid Particle Mesh Sphere
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Distortion — sphere surface displacement
//   b = Density — amount of fluid particle dots
//   c = Particle sharpness — soft blobs to hard dots
//   d = Rotation speed — rate of sphere rotation
//   e = Flow speed — how fast particles drift across surface
//   f = Swirl — curl/turbulence in the particle flow
//   g = Pulse — rhythmic expansion/contraction
//   h = Mesh mix — blend between solid particles and wireframe
// ============================================================

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3 saturate3(vec3 x) { return clamp(x, 0.0, 1.0); }
float param(float p, float lo, float hi) { return mix(lo, hi, p); }

#define PI 3.14159265359
#define TAU 6.28318530718

// --- 3D Hash / Noise ---
float hash31(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 fr = fract(p);
    fr = fr * fr * (3.0 - 2.0 * fr);
    return mix(mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), fr.x),
                   mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), fr.x), fr.y),
               mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), fr.x),
                   mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), fr.x), fr.y), fr.z);
}

float fbm3(vec3 p) {
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 4; i++) {
        v += amp * vnoise(p);
        p = p * 2.01 + 0.5;
        amp *= 0.5;
    }
    return v;
}

// --- 2D Hash / Noise ---
float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.13);
    p3 += dot(p3, p3.yzx + 3.333);
    return fract((p3.x + p3.y) * p3.z);
}

float vnoise2(vec2 p) {
    vec2 i = floor(p);
    vec2 fr = fract(p);
    fr = fr * fr * (3.0 - 2.0 * fr);
    float aa = hash21(i);
    float bb = hash21(i + vec2(1.0, 0.0));
    float cc = hash21(i + vec2(0.0, 1.0));
    float dd = hash21(i + vec2(1.0, 1.0));
    return mix(mix(aa, bb, fr.x), mix(cc, dd, fr.x), fr.y);
}

float fbm2(vec2 p) {
    float v = 0.0, amp = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 5; i++) {
        v += amp * vnoise2(p);
        p = rot * p * 2.0 + 100.0;
        amp *= 0.5;
    }
    return v;
}

// --- Rotation ---
mat3 rotY(float ang) { float c = cos(ang), s = sin(ang); return mat3(c,0,s, 0,1,0, -s,0,c); }
mat3 rotX(float ang) { float c = cos(ang), s = sin(ang); return mat3(1,0,0, 0,c,-s, 0,s,c); }

// --- Sphere SDF ---
float sphereSDF(vec3 p, float radius, float distAmt, float t) {
    float base = length(p) - radius;
    vec3 n = normalize(p);
    float disp = fbm3(n * 4.0 + t * 0.3) * 2.0 - 1.0;
    return base - disp * distAmt;
}

// --- Mesh wireframe ---
float meshPattern(vec3 p, float density) {
    vec3 n = normalize(p);
    float theta = acos(clamp(n.y, -1.0, 1.0));
    float phi = atan(n.z, n.x);
    float lineW = 0.15;

    float gridTheta = sin(theta * density) * 0.5 + 0.5;
    float gridPhi = sin(phi * density) * 0.5 + 0.5;

    float lineTheta = smoothstep(lineW, 0.0, abs(gridTheta - 0.5) * 2.0);
    float linePhi = smoothstep(lineW, 0.0, abs(gridPhi - 0.5) * 2.0);

    float mesh = max(lineTheta, linePhi);

    float diag = sin((theta + phi) * density * 0.7);
    float lineDiag = smoothstep(lineW, 0.0, abs(diag) * 1.5);
    mesh = max(mesh, lineDiag * 0.7);

    return mesh;
}

// --- Fluid particle texture on sphere ---
float fluidParticles(vec3 p, float density, float sharpness, float flowSpeed, float swirl, float t) {
    vec3 n = normalize(p);
    float theta = acos(clamp(n.y, -1.0, 1.0));
    float phi = atan(n.z, n.x);

    float col = 0.0;

    // 3 layers at different scales for depth
    for (int layer = 0; layer < 3; layer++) {
        float lf = float(layer);
        float scale = density * (1.0 + lf * 0.6);
        float spd = t * flowSpeed * (1.0 + lf * 0.2);
        float alpha = 1.0 - lf * 0.25;

        vec2 tc = vec2(phi / TAU + 0.5, theta / PI) * scale;

        // Domain warp for flow
        float n1 = fbm2(tc * 0.5 + vec2(spd * 0.3, lf * 5.0));
        float n2 = fbm2(tc * 0.5 + vec2(lf * 8.0, spd * 0.2));
        vec2 warp = vec2(n1 - 0.5, n2 - 0.5) * swirl;

        vec2 warped = tc + warp;

        // Particle field: threshold noise into bright dots
        float nval = fbm2(warped + vec2(spd * 0.15, spd * -0.1 + lf * 3.0));
        // Second noise layer offset for variation
        float nval2 = vnoise2(warped * 2.3 + vec2(spd * 0.2 - lf, spd * 0.1));

        float combined = nval * 0.6 + nval2 * 0.4;

        // Threshold to create particles — sharpness controls the cutoff
        float threshold = 0.3 + (1.0 - sharpness) * 0.4;
        float particle = smoothstep(threshold, threshold + 0.05 + (1.0 - sharpness) * 0.15, combined);
        particle = pow(particle, 1.5);

        col += particle * alpha;
    }

    return clamp(col, 0.0, 1.0);
}

// --- Raymarching ---
float raymarch(vec3 ro, vec3 rd, float radius, float distAmt, float t) {
    float dist = 0.0;
    for (int i = 0; i < 80; i++) {
        vec3 p = ro + rd * dist;
        float sd = sphereSDF(p, radius, distAmt, t);
        if (abs(sd) < 0.001) break;
        if (dist > 5.0) break;
        dist += sd * 0.7;
    }
    return dist;
}

// --- Normal estimation ---
vec3 calcNormal(vec3 p, float radius, float distAmt, float t) {
    vec2 ep = vec2(0.002, 0.0);
    return normalize(vec3(
        sphereSDF(p + ep.xyy, radius, distAmt, t) - sphereSDF(p - ep.xyy, radius, distAmt, t),
        sphereSDF(p + ep.yxy, radius, distAmt, t) - sphereSDF(p - ep.yxy, radius, distAmt, t),
        sphereSDF(p + ep.yyx, radius, distAmt, t) - sphereSDF(p - ep.yyx, radius, distAmt, t)
    ));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float distAmt    = param(a, 0.0, 0.6);
    float density    = param(b, 4.0, 20.0);
    float sharpness  = param(c, 0.0, 1.0);
    float rotSpeed   = param(d, 0.1, 1.5);
    float flowSpeed  = param(e, 0.1, 1.5);
    float swirl      = param(f, 0.0, 2.0);
    float pulseAmt   = param(g, 0.0, 0.3);
    float meshMix    = param(h, 0.0, 1.0);

    float t = iTime;
    float radius = 0.8 + sin(t * 2.0) * pulseAmt;

    // Camera
    vec3 ro = vec3(0.0, 0.0, 2.5);
    vec3 rd = normalize(vec3(uv, -1.0));

    // Rotate
    mat3 rot = rotY(t * rotSpeed) * rotX(t * rotSpeed * 0.4);
    vec3 ro2 = rot * ro;
    vec3 rd2 = rot * rd;

    float dist = raymarch(ro2, rd2, radius, distAmt, t);

    vec3 col = vec3(0.0);

    if (dist < 5.0) {
        vec3 p = ro2 + rd2 * dist;
        vec3 nor = calcNormal(p, radius, distAmt, t);

        // Fluid particles on surface
        float particles = fluidParticles(p, density, sharpness, flowSpeed, swirl, t);

        // Wireframe mesh
        float mesh = meshPattern(p, 20.0);

        // Lighting
        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
        float diff = max(dot(nor, lightDir), 0.0);
        float fres = pow(1.0 - max(dot(nor, -normalize(rd2)), 0.0), 3.0);

        // Combine
        float partLit = particles * (0.3 + 0.7 * diff);
        float meshLine = mesh * (0.5 + 0.5 * diff);

        float surface = mix(partLit, partLit * 0.3 + meshLine * partLit * 0.7, meshMix);
        surface += fres * 0.2;

        col = vec3(surface);
    }

    // Background glow
    float bgGlow = exp(-length(uv) * 2.0) * 0.04;
    col += bgGlow;

    col = saturate3(col);
    fragColor = vec4(col, 1.0);
}
