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
// 2.frag — Distorted Mesh Sphere
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Distortion — noise displacement amount on sphere surface
//   b = Grid density — number of mesh lines on the sphere
//   c = Line width — thickness of the wireframe lines
//   d = Rotation speed — rate of sphere rotation
//   e = Noise scale — frequency of surface distortion noise
//   f = Glow — bloom intensity around mesh lines
//   g = Pulse — rhythmic contraction/expansion of the sphere
//   h = Fracture — breaks mesh apart with gaps
// ============================================================

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3 saturate3(vec3 x) { return clamp(x, 0.0, 1.0); }
float param(float p, float lo, float hi) { return mix(lo, hi, p); }

#define PI 3.14159265359
#define TAU 6.28318530718

// --- Hash / Noise ---
float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

float fbm3(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * vnoise(p);
        p = p * 2.01 + 0.5;
        a *= 0.5;
    }
    return v;
}

// --- Rotation ---
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c,0,s, 0,1,0, -s,0,c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1,0,0, 0,c,-s, 0,s,c); }

// --- Sphere SDF with distortion ---
float sphereSDF(vec3 p, float radius, float distAmt, float nScale, float t) {
    float base = length(p) - radius;
    vec3 n = normalize(p);
    float disp = fbm3(n * nScale + t * 0.3) * 2.0 - 1.0;
    return base - disp * distAmt;
}

// --- Mesh / wireframe pattern on sphere surface ---
float meshPattern(vec3 p, float density, float lineW, float fractureAmt, float t) {
    vec3 n = normalize(p);

    float theta = acos(clamp(n.y, -1.0, 1.0));
    float phi = atan(n.z, n.x);

    float gridTheta = sin(theta * density) * 0.5 + 0.5;
    float gridPhi = sin(phi * density) * 0.5 + 0.5;

    float lineTheta = smoothstep(lineW, 0.0, abs(gridTheta - 0.5) * 2.0);
    float linePhi = smoothstep(lineW, 0.0, abs(gridPhi - 0.5) * 2.0);

    float mesh = max(lineTheta, linePhi);

    // diagonal cross-hatching for triangulated look
    float diag = sin((theta + phi) * density * 0.7);
    float lineDiag = smoothstep(lineW, 0.0, abs(diag) * 1.5);
    mesh = max(mesh, lineDiag * 0.7);

    // fracture: cut holes in the mesh
    float hole = vnoise(n * 5.0 + t * 0.2);
    float fmask = smoothstep(fractureAmt * 0.5, fractureAmt * 0.5 + 0.1, hole);
    mesh *= mix(1.0, fmask, step(0.01, fractureAmt));

    return mesh;
}

// --- Raymarching ---
float raymarch(vec3 ro, vec3 rd, float radius, float distAmt, float nScale, float t) {
    float d = 0.0;
    for (int i = 0; i < 80; i++) {
        vec3 p = ro + rd * d;
        float h = sphereSDF(p, radius, distAmt, nScale, t);
        if (abs(h) < 0.001) break;
        if (d > 5.0) break;
        d += h * 0.7;
    }
    return d;
}

// --- Normal estimation ---
vec3 calcNormal(vec3 p, float radius, float distAmt, float nScale, float t) {
    vec2 e = vec2(0.002, 0.0);
    return normalize(vec3(
        sphereSDF(p + e.xyy, radius, distAmt, nScale, t) - sphereSDF(p - e.xyy, radius, distAmt, nScale, t),
        sphereSDF(p + e.yxy, radius, distAmt, nScale, t) - sphereSDF(p - e.yxy, radius, distAmt, nScale, t),
        sphereSDF(p + e.yyx, radius, distAmt, nScale, t) - sphereSDF(p - e.yyx, radius, distAmt, nScale, t)
    ));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float distAmt   = param(a, 0.0, 0.6);
    float density    = param(b, 8.0, 40.0);
    float lineW      = param(c, 0.05, 0.5);
    float rotSpeed   = param(d, 0.1, 1.5);
    float nScale     = param(e, 2.0, 8.0);
    float glowAmt    = param(f, 0.0, 1.5);
    float pulseAmt   = param(g, 0.0, 0.3);
    float fractureAmt = param(h, 0.0, 0.8);

    float t = iTime;
    float radius = 0.8 + sin(t * 2.0) * pulseAmt;

    // Camera
    vec3 ro = vec3(0.0, 0.0, 2.5);
    vec3 rd = normalize(vec3(uv, -1.0));

    // Rotate sphere by rotating ray into sphere space
    mat3 rot = rotY(t * rotSpeed) * rotX(t * rotSpeed * 0.4);
    vec3 ro2 = rot * ro;
    vec3 rd2 = rot * rd;

    float d = raymarch(ro2, rd2, radius, distAmt, nScale, t);

    vec3 col = vec3(0.0);

    if (d < 5.0) {
        vec3 p = ro2 + rd2 * d;
        vec3 nor = calcNormal(p, radius, distAmt, nScale, t);

        // Mesh pattern
        float mesh = meshPattern(p, density, lineW, fractureAmt, t);

        // Lighting
        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
        float diff = max(dot(nor, lightDir), 0.0);
        float fres = pow(1.0 - max(dot(nor, -normalize(rd2)), 0.0), 3.0);

        // Mesh color with slight depth shading
        float brightness = mesh * (0.3 + 0.7 * diff);
        brightness += fres * 0.3;

        col = vec3(brightness);

        // Glow along mesh lines
        col += mesh * glowAmt * 0.3 * exp(-abs(d - length(p)) * 5.0);
    }

    // Background glow - faint sphere silhouette
    float bgGlow = exp(-length(uv) * 2.0) * 0.05;
    col += bgGlow;

    col = saturate3(col);
    fragColor = vec4(col, 1.0);
}
