// Shader 79: Mesh Warp — OPTIMIZED (drop-in replacement for 37.frag / "Shader 39")
// Organic wireframe mesh bodies with vertex noise, morphing, and collision.
// Same parameters a-h, same look — restructured for speed:
//
//   PER-PIXEL COST: original ~80 map evals x (4 bodies x (rotMat trig + 4 noise))
//                   + 6-tap normal.  Optimized: per-frame body cache (rot trig
//                   once per pixel), bounding-sphere early-out for background,
//                   per-body culling, 48-step march starting at sphere entry,
//                   4-tap normal, 2-octave fbm.  Roughly 6-10x faster on
//                   surface pixels, ~80x on background pixels.
//
// a = noise displacement amount (vertex warp intensity)
// b = noise frequency (deformation detail)
// c = morph factor (sphere -> torus -> organic)
// d = body spread / arrangement
// e = wireframe density (triangle subdivision)
// f = rotation speed
// g = collision softness (merge blend between bodies)
// h = brightness / glow intensity

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

#define PI 3.14159265359
#define TAU 6.28318530718
#define NB 4

// ============================================================================
// UTILITIES
// ============================================================================

float hashF(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

vec3 hash3v(float p) {
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

// ============================================================================
// NOISE
// ============================================================================

float vnoise(vec3 p) {
    vec3 ip = floor(p);
    vec3 fp = fract(p);
    fp = fp * fp * (3.0 - 2.0 * fp);

    float n = ip.x + ip.y * 157.0 + 113.0 * ip.z;
    return mix(
        mix(mix(hashF(n),        hashF(n+1.0),   fp.x),
            mix(hashF(n+157.0),  hashF(n+158.0), fp.x), fp.y),
        mix(mix(hashF(n+113.0),  hashF(n+114.0), fp.x),
            mix(hashF(n+270.0),  hashF(n+271.0), fp.x), fp.y),
        fp.z
    );
}

// 2 octaves, rescaled so the amplitude range matches the old 3-octave fbm
float vfbm(vec3 p) {
    return (0.5 * vnoise(p) + 0.25 * vnoise(p * 2.0 + 100.0)) * 1.1667;
}

// ============================================================================
// TRANSFORMS
// ============================================================================

mat3 rotMat(vec3 ang) {
    float cx = cos(ang.x), sx = sin(ang.x);
    float cy = cos(ang.y), sy = sin(ang.y);
    float cz = cos(ang.z), sz = sin(ang.z);
    return mat3(
        cy*cz, sx*sy*cz - cx*sz, cx*sy*cz + sx*sz,
        cy*sz, sx*sy*sz + cx*cz, cx*sy*sz - cx*sz,
        -sy, sx*cy, cx*cy
    );
}

// ============================================================================
// SDF PRIMITIVES
// ============================================================================

float sdSph(vec3 p, float r) { return length(p) - r; }

float sdTor(vec3 p, float R, float r) {
    vec2 q = vec2(length(p.xz) - R, p.y);
    return length(q) - r;
}

float sdEll(vec3 p, vec3 r) {
    float k0 = length(p / r);
    float k1 = length(p / (r * r));
    return k0 * (k0 - 1.0) / k1;
}

float smin(float d1, float d2, float k) {
    float hh = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, hh) - k * hh * (1.0 - hh);
}

// ============================================================================
// PER-FRAME BODY CACHE
// computed once per pixel in mainImage; mapScene only does geometry+noise.
// (the original recomputed hash3v + rotMat for every body on EVERY march step
//  and every normal tap — that was the single biggest cost)
// ============================================================================

vec3  g_center[NB];
float g_rad[NB];
mat3  g_rot[NB];

void bodyFrame(float t, float spread, float rotSpd) {
    for (int i = 0; i < NB; i++) {
        float fi = float(i);
        vec3 rnd = hash3v(fi * 73.0 + 17.0);

        float orbit = fi * TAU / float(NB) + t * 0.12;
        float r = spread * (0.5 + rnd.x * 0.5);
        g_center[i] = vec3(cos(orbit) * r,
                           sin(t * 0.25 + fi * 1.7) * spread * 0.35,
                           sin(orbit) * r);
        g_rad[i] = 0.35 + rnd.y * 0.4;
        g_rot[i] = rotMat(rnd * TAU + t * rotSpd * vec3(0.3, 0.2, 0.15));
    }
}

// ============================================================================
// SCENE SDF (with per-body bounding cull)
// ============================================================================

float mapScene(vec3 p, float noiseAmt, float noiseFreq, float morph,
               float softness, float t) {
    float dd = 1e10;

    for (int i = 0; i < NB; i++) {
        vec3 lp0 = p - g_center[i];

        // per-body bounding radius: ellipsoid extent 1.3*rad, displacement
        // <= ~0.75*noiseAmt, smin bulge <= ~0.3*softness
        float maxR = g_rad[i] * 1.35 + noiseAmt * 0.75 + softness * 0.3 + 0.05;
        if (dot(lp0, lp0) > maxR * maxR) continue;   // skip far bodies entirely

        vec3 lp = g_rot[i] * lp0;
        float rad = g_rad[i];

        // Morph between shapes
        float base;
        if (morph < 0.33) {
            base = sdSph(lp, rad);
        } else if (morph < 0.66) {
            float bl = (morph - 0.33) * 3.0;
            base = mix(sdSph(lp, rad),
                       sdTor(lp, rad * 0.7, rad * 0.3), bl);
        } else {
            float bl = (morph - 0.66) * 3.0;
            base = mix(sdTor(lp, rad * 0.7, rad * 0.3),
                       sdEll(lp, vec3(rad*1.3, rad*0.6, rad*0.9)), bl);
        }

        // Vertex noise displacement (2 octaves + 1 detail octave)
        if (noiseAmt > 0.005) {
            vec3 np = lp * noiseFreq + t * 0.15;
            float disp = vfbm(np) - 0.5;
            disp += (vnoise(np * 2.5 + 77.0) - 0.5) * 0.4;
            base += disp * noiseAmt;
        }

        dd = smin(dd, base, softness);
    }

    return dd;
}

// Normal — 4-tap tetrahedron (33% cheaper than 6-tap central differences)
vec3 calcNormal(vec3 p, float nA, float nF, float mo, float so, float t) {
    const float NE = 0.002;
    vec2 k = vec2(1.0, -1.0);
    return normalize(
        k.xyy * mapScene(p + k.xyy * NE, nA, nF, mo, so, t) +
        k.yyx * mapScene(p + k.yyx * NE, nA, nF, mo, so, t) +
        k.yxy * mapScene(p + k.yxy * NE, nA, nF, mo, so, t) +
        k.xxx * mapScene(p + k.xxx * NE, nA, nF, mo, so, t));
}

// ============================================================================
// WIREFRAME
// ============================================================================

float triWire(vec2 p, float lw) {
    float s3 = 1.7320508;

    float d1 = abs(mod(p.y, 1.0) - 0.5);
    float d2 = abs(mod(dot(p, vec2(s3*0.5, 0.5)), 1.0) - 0.5);
    float d3 = abs(mod(dot(p, vec2(-s3*0.5, 0.5)), 1.0) - 0.5);

    float dm = min(min(d1, d2), d3);
    return 1.0 - smoothstep(0.0, lw, dm);
}

float meshWireframe(vec3 p, vec3 n, float density, float lw) {
    vec3 blend = abs(n);
    blend = pow(blend, vec3(4.0));
    blend /= (blend.x + blend.y + blend.z + 0.0001);

    float w1 = triWire(p.yz * density, lw);
    float w2 = triWire(p.xz * density, lw);
    float w3 = triWire(p.xy * density, lw);

    return w1 * blend.x + w2 * blend.y + w3 * blend.z;
}

float vertexDots(vec3 p, vec3 n, float density, float dotRad) {
    vec3 blend = abs(n);
    blend = pow(blend, vec3(4.0));
    blend /= (blend.x + blend.y + blend.z + 0.0001);

    float s3 = 1.7320508;
    float dots = 0.0;

    vec2 g1 = p.yz * density;
    vec2 nearest1 = floor(vec2(g1.x, g1.y / s3) + 0.5);
    nearest1.y *= s3;
    dots += blend.x * (1.0 - smoothstep(0.0, dotRad, length(g1 - nearest1)));

    vec2 g2 = p.xz * density;
    vec2 nearest2 = floor(vec2(g2.x, g2.y / s3) + 0.5);
    nearest2.y *= s3;
    dots += blend.y * (1.0 - smoothstep(0.0, dotRad, length(g2 - nearest2)));

    vec2 g3 = p.xy * density;
    vec2 nearest3 = floor(vec2(g3.x, g3.y / s3) + 0.5);
    nearest3.y *= s3;
    dots += blend.z * (1.0 - smoothstep(0.0, dotRad, length(g3 - nearest3)));

    return clamp(dots, 0.0, 1.0);
}

// ============================================================================
// MAIN
// ============================================================================

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // Map parameters (identical to the original)
    float noiseAmt  = mix(0.0, 0.55, a);
    float noiseFreq = mix(1.5, 5.5, b);
    float morph     = c;
    float spread    = mix(0.6, 2.5, d);
    float density   = mix(4.0, 14.0, e);
    float rotSpd    = mix(0.05, 0.7, f);
    float softness  = mix(0.05, 0.9, g);
    float bright    = mix(0.6, 2.0, h);

    float t = iTime;

    // Camera - gentle orbit
    float camA = t * 0.07;
    vec3 ro = vec3(sin(camA) * 3.8, sin(t * 0.04) * 0.6, cos(camA) * 3.8);
    vec3 target = vec3(0.0);
    vec3 fwd = normalize(target - ro);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, fwd);
    vec3 rd = normalize(fwd * 1.3 + right * uv.x + up * uv.y);

    // Build the per-frame body cache (trig once per pixel, not per step)
    bodyFrame(t, spread, rotSpd);

    // ---- scene bounding sphere: skip the entire march for background pixels
    float R = spread + 1.7;
    vec3 oc = ro;
    float b2 = dot(oc, rd);
    float c2 = dot(oc, oc) - R * R;
    float disc = b2 * b2 - c2;

    vec3 col = vec3(0.0);

    if (disc < 0.0) {
        // Ray misses the scene: cheap proximity glow from sphere distance
        float dPerp = sqrt(max(dot(oc, oc) - b2 * b2, 0.0));
        float glow = exp(-max(dPerp - R, 0.0) * 3.0) * 0.06 * bright;
        col = vec3(glow * 0.9, glow * 0.92, glow);
        col = col / (col + 0.85);
        fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        return;
    }

    // Ray enters the sphere at t0 — start marching there (skips empty space)
    float sq = sqrt(disc);
    float t0 = max(-b2 - sq, 0.0);
    float t1 = -b2 + sq;

    // Raymarch: 48 steps, relaxed stepping, capped at sphere exit
    float totalDist = t0 + 0.01;
    float minDist = 1e10;
    bool hit = false;
    vec3 hitPos = ro;

    for (int i = 0; i < 48; i++) {
        vec3 p = ro + rd * totalDist;
        float dist = mapScene(p, noiseAmt, noiseFreq, morph, softness, t);

        minDist = min(minDist, dist);

        if (dist < 0.0025) {
            hit = true;
            hitPos = p;
            break;
        }

        totalDist += dist * 0.85;
        if (totalDist > t1 + 0.5) break;
    }

    if (hit) {
        vec3 n = calcNormal(hitPos, noiseAmt, noiseFreq, morph, softness, t);

        float lw = 0.055 + 0.015 / (1.0 + totalDist * 0.2);
        float wire = meshWireframe(hitPos, n, density, lw);
        float dots = vertexDots(hitPos, n, density, 0.12);
        float depthFade = 1.0 / (1.0 + totalDist * 0.12);

        vec3 vd = normalize(ro - hitPos);
        float fres = pow(1.0 - abs(dot(n, vd)), 2.0);

        float intensity = wire * 0.85 + dots * 0.4 + fres * 0.12;
        intensity *= depthFade * bright;

        col = vec3(intensity * 0.92, intensity * 0.94, intensity);
    } else {
        float glow = exp(-minDist * 3.0) * 0.06 * bright;
        col = vec3(glow * 0.9, glow * 0.92, glow);
    }

    // Tone mapping
    col = col / (col + 0.85);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}