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
// 3.frag — Wireframe Blob
// ============================================================
// Raymarched displaced sphere with wireframe grid overlay
// and springy/jelly physics. Variant of shader 22.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Displacement — intensity of surface deformation    [0.05 .. 0.6]
//   b = Grid density — wireframe subdivision count         [4 .. 24]
//   c = Complexity — octaves of displacement noise         [0.5 .. 1.0]
//   d = Jelly — springy bounce / soft-body wobble          [0 .. 1]
//   e = Hue — base wireframe color
//   f = Speed — animation rate                             [0.2 .. 2.0]
//   g = Wire glow — wireframe brightness / emission        [0.3 .. 2.0]
//   h = Vertex size — glowing dots at grid intersections   [0 .. 1]
// ============================================================

#define PI 3.14159265359
#define TAU 6.28318530718

float param(float p, float lo, float hi) { return mix(lo, hi, p); }

// --- Hash / Noise (3D) ---
float hash(float n) { return fract(sin(n) * 43758.5453); }

float vnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = dot(i, vec3(1.0, 57.0, 113.0));
    return mix(mix(mix(hash(n), hash(n + 1.0), f.x),
                   mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
               mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                   mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
}

float vfbm(vec3 p, float complexity) {
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 5; i++) {
        v += amp * vnoise(p);
        p *= 2.01;
        amp *= 0.5 * complexity;
    }
    return v;
}

// --- HSV ---
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// --- Jelly physics: propagating wave deformation ---
float jellyDeform(vec3 dir, float t, float jelly) {
    // Multiple standing waves across the sphere surface
    float wave1 = sin(dir.x * 5.0 + t * 3.0) * sin(dir.y * 4.0 - t * 2.5);
    float wave2 = sin(dir.z * 6.0 + t * 2.0) * sin(dir.x * 3.0 + t * 1.7);
    float wave3 = sin((dir.y + dir.z) * 4.5 - t * 3.5);

    // Damped spring bounce
    float bounce = sin(t * 4.0) * exp(-fract(t * 0.5) * 2.0);

    return (wave1 * 0.3 + wave2 * 0.25 + wave3 * 0.2 + bounce * 0.25) * jelly;
}

// --- SDF: displaced sphere with jelly ---
float mapSphere(vec3 p, float t, float dispAmt, float complexity, float jelly) {
    float r = length(p);
    vec3 dir = p / max(r, 0.001);

    // FBM displacement
    float disp = vfbm(dir * 3.0 + t * 0.3, complexity) * dispAmt;

    // Jelly wobble
    disp += jellyDeform(dir, t, jelly) * dispAmt * 0.5;

    // Gravity sag — bottom of sphere droops slightly when jelly is high
    disp += jelly * 0.08 * smoothstep(0.0, -1.0, dir.y);

    return r - 0.85 - disp;
}

vec3 calcNormal(vec3 p, float t, float dispAmt, float complexity, float jelly) {
    vec2 e = vec2(0.002, 0.0);
    return normalize(vec3(
        mapSphere(p + e.xyy, t, dispAmt, complexity, jelly) -
        mapSphere(p - e.xyy, t, dispAmt, complexity, jelly),
        mapSphere(p + e.yxy, t, dispAmt, complexity, jelly) -
        mapSphere(p - e.yxy, t, dispAmt, complexity, jelly),
        mapSphere(p + e.yyx, t, dispAmt, complexity, jelly) -
        mapSphere(p - e.yyx, t, dispAmt, complexity, jelly)
    ));
}

// --- Wireframe pattern from spherical UVs ---
// Returns: x = wire intensity, y = vertex dot intensity
vec2 wireframe(vec3 dir, float gridDensity, float wireThickness, float vertexSize) {
    // Spherical coordinates
    float theta = atan(dir.z, dir.x);         // -PI to PI
    float phi = asin(clamp(dir.y, -1.0, 1.0)); // -PI/2 to PI/2

    // Grid UVs
    vec2 gridUV = vec2(theta / TAU + 0.5, phi / PI + 0.5) * gridDensity;
    vec2 gridFrac = fract(gridUV);

    // Distance to nearest grid line (horizontal and vertical)
    float dLine = min(
        min(gridFrac.x, 1.0 - gridFrac.x),
        min(gridFrac.y, 1.0 - gridFrac.y)
    );

    // Distance to nearest grid intersection (vertex)
    vec2 dCorner = min(gridFrac, 1.0 - gridFrac);
    float dVertex = length(dCorner);

    // Wire edge with anti-aliasing
    float wire = 1.0 - smoothstep(0.0, wireThickness, dLine);

    // Vertex dot
    float vertex = 1.0 - smoothstep(0.0, wireThickness * 2.5, dVertex);
    vertex *= vertexSize;

    return vec2(wire, vertex);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // --- Params ---
    float dispAmt    = param(a, 0.05, 0.6);
    float gridDens   = param(b, 4.0, 24.0);
    float complexity = param(c, 0.5, 1.0);
    float jelly      = d;
    float hueBase    = e;
    float speed      = param(f, 0.2, 2.0);
    float wireGlow   = param(g, 0.3, 2.0);
    float vertexSize = h;

    float t = iTime * speed;

    // --- Camera: slow orbit ---
    float camAngle = t * 0.25;
    vec3 ro = vec3(sin(camAngle) * 2.8, 0.4 * sin(t * 0.15), cos(camAngle) * 2.8);
    vec3 ta = vec3(0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.5 * ww);

    // --- Raymarch ---
    float totalDist = 0.0;
    bool hit = false;
    vec3 hitPos;

    for (int i = 0; i < 80; i++) {
        hitPos = ro + rd * totalDist;
        float dist = mapSphere(hitPos, t, dispAmt, complexity, jelly);
        if (dist < 0.001) { hit = true; break; }
        if (totalDist > 10.0) break;
        totalDist += dist * 0.6;
    }

    vec3 col = vec3(0.0);

    if (hit) {
        vec3 n = calcNormal(hitPos, t, dispAmt, complexity, jelly);

        // Surface direction for wireframe (use normal for displaced grid)
        vec3 surfDir = normalize(hitPos);

        // Wireframe
        float wireThick = 0.06 / gridDens; // thinner at higher density
        vec2 wf = wireframe(surfDir, gridDens, wireThick, vertexSize);
        float wireVal = wf.x;
        float vertVal = wf.y;

        // Lighting
        vec3 light1 = normalize(vec3(1.0, 2.0, 1.5));
        vec3 light2 = normalize(vec3(-1.0, 0.5, -0.5));
        float diff = max(dot(n, light1), 0.0) * 0.7 + max(dot(n, light2), 0.0) * 0.3 + 0.1;

        // Fresnel
        float fresnel = pow(1.0 - max(dot(-rd, n), 0.0), 3.0);

        // Specular
        vec3 refl = reflect(rd, n);
        float spec = pow(max(dot(refl, light1), 0.0), 32.0);

        // Wire color: bright hue-shifted
        vec3 wireCol = hsv2rgb(vec3(hueBase, 0.7, 1.0));
        vec3 vertCol = hsv2rgb(vec3(hueBase + 0.15, 0.5, 1.0));

        // Dark interior between wires
        vec3 fillCol = hsv2rgb(vec3(hueBase + 0.05, 0.4, 0.06));

        // Compose: wireframe on dark surface
        col = fillCol * diff;
        col = mix(col, wireCol * wireGlow * diff, wireVal);
        col += vertCol * vertVal * wireGlow * 1.5;

        // Specular on wires
        col += wireCol * spec * wireVal * 0.4;

        // Fresnel rim glow
        col += hsv2rgb(vec3(hueBase + 0.3, 0.6, 0.8)) * fresnel * 0.4;

        // Pulsing glow at vertices tied to jelly physics
        float pulse = 0.5 + 0.5 * sin(t * 4.0 + surfDir.x * 3.0 + surfDir.y * 5.0);
        col += vertCol * vertVal * pulse * jelly * 0.6;

    } else {
        // Background: faint grid glow
        float bgGlow = exp(-length(uv) * 2.0) * 0.03;
        col = hsv2rgb(vec3(hueBase, 0.3, bgGlow));
    }


    // Tone map
    col = col / (col + 0.5);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
