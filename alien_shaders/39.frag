// Shader 39: Mesh Warp - Wireframe Mesh Morphing & Collision
// Organic wireframe mesh bodies with vertex noise, morphing, and collision
// Monochrome minimal aesthetic - white wireframe on black
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
// NOISE (named vnoise to avoid GLSL built-in noise3 conflict)
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

float vfbm(vec3 p, int oct) {
    float v = 0.0;
    float amp = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 4; i++) {
        if (i >= oct) break;
        v += amp * vnoise(p);
        p = p * 2.0 + shift;
        amp *= 0.5;
    }
    return v;
}

// ============================================================================
// 3D TRANSFORMS
// ============================================================================

mat3 rotMat(vec3 ang) {
    float cx = cos(ang.x), sx = sin(ang.x);
    float cy = cos(ang.y), sy = sin(ang.y);
    float cz = cos(ang.z), sz = sin(ang.z);
    return mat3(
        cy*cz, sx*sy*cz - cx*sz, cx*sy*cz + sx*sz,
        cy*sz, sx*sy*sz + cx*cz, cx*sy*sz - sx*cz,
        -sy, sx*cy, cx*cy
    );
}

// ============================================================================
// SDF PRIMITIVES
// ============================================================================

float sdSph(vec3 p, float r) {
    return length(p) - r;
}

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
// MESH BODIES
// ============================================================================

#define NUM_BODIES 4

vec3 bodyPos(int idx, float t, float spread) {
    float fi = float(idx);
    vec3 rnd = hash3v(fi * 73.0 + 17.0);

    float orbit = fi * TAU / float(NUM_BODIES) + t * 0.12;
    float r = spread * (0.5 + rnd.x * 0.5);
    float yOff = sin(t * 0.25 + fi * 1.7) * spread * 0.35;

    return vec3(cos(orbit) * r, yOff, sin(orbit) * r);
}

float bodyRadius(int idx) {
    float fi = float(idx);
    vec3 rnd = hash3v(fi * 73.0 + 17.0);
    return 0.35 + rnd.y * 0.4;
}

// ============================================================================
// SCENE SDF
// ============================================================================

float mapScene(vec3 p, float noiseAmt, float noiseFreq, float morph,
               float spread, float softness, float rotSpd, float t) {
    float dd = 1e10;

    for (int i = 0; i < NUM_BODIES; i++) {
        vec3 center = bodyPos(i, t, spread);
        float rad = bodyRadius(i);

        vec3 rnd = hash3v(float(i) * 73.0 + 17.0);
        mat3 rot = rotMat(rnd * TAU + t * rotSpd * vec3(0.3, 0.2, 0.15));
        vec3 lp = rot * (p - center);

        // Morph between shapes
        float base = 0.0;
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

        // Vertex noise displacement
        if (noiseAmt > 0.005) {
            vec3 np = lp * noiseFreq + t * 0.15;
            float disp = vfbm(np, 3) - 0.5;
            disp += (vnoise(np * 2.5 + 77.0) - 0.5) * 0.4;
            base += disp * noiseAmt;
        }

        dd = smin(dd, base, softness);
    }

    return dd;
}

// Normal via central differences
vec3 calcNormal(vec3 p, float nA, float nF, float mo, float sp,
                float so, float rs, float t) {
    vec2 ep = vec2(0.002, 0.0);
    return normalize(vec3(
        mapScene(p+ep.xyy, nA,nF,mo,sp,so,rs,t) - mapScene(p-ep.xyy, nA,nF,mo,sp,so,rs,t),
        mapScene(p+ep.yxy, nA,nF,mo,sp,so,rs,t) - mapScene(p-ep.yxy, nA,nF,mo,sp,so,rs,t),
        mapScene(p+ep.yyx, nA,nF,mo,sp,so,rs,t) - mapScene(p-ep.yyx, nA,nF,mo,sp,so,rs,t)
    ));
}

// ============================================================================
// WIREFRAME - Triangular grid via tri-planar projection
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

    // Map parameters
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

    // Camera matrix
    vec3 fwd = normalize(target - ro);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, fwd);
    vec3 rd = normalize(fwd * 1.3 + right * uv.x + up * uv.y);

    // Raymarch
    float totalDist = 0.0;
    float minDist = 1e10;
    bool hit = false;
    vec3 hitPos = ro;

    for (int i = 0; i < 80; i++) {
        vec3 p = ro + rd * totalDist;
        float dist = mapScene(p, noiseAmt, noiseFreq, morph, spread, softness, rotSpd, t);

        minDist = min(minDist, dist);

        if (dist < 0.002) {
            hit = true;
            hitPos = p;
            break;
        }

        totalDist += dist * 0.7;
        if (totalDist > 15.0) break;
    }

    vec3 col = vec3(0.0);

    if (hit) {
        vec3 n = calcNormal(hitPos, noiseAmt, noiseFreq, morph, spread, softness, rotSpd, t);

        // Wireframe
        float lw = 0.055 + 0.015 / (1.0 + totalDist * 0.2);
        float wire = meshWireframe(hitPos, n, density, lw);

        // Vertex dots
        float dots = vertexDots(hitPos, n, density, 0.12);

        // Depth fade
        float depthFade = 1.0 / (1.0 + totalDist * 0.12);

        // Fresnel edge highlight
        vec3 vd = normalize(ro - hitPos);
        float fres = pow(1.0 - abs(dot(n, vd)), 2.0);

        // Combine wireframe + dots + edge glow
        float intensity = wire * 0.85 + dots * 0.4 + fres * 0.12;
        intensity *= depthFade * bright;

        // Monochrome with very subtle cool tint
        col = vec3(intensity * 0.92, intensity * 0.94, intensity);

    } else {
        // Subtle proximity glow in background
        float glow = exp(-minDist * 3.0) * 0.06 * bright;
        col = vec3(glow * 0.9, glow * 0.92, glow);
    }

    // Vignette
    vec2 vc = fragCoord / iResolution.xy * 2.0 - 1.0;
    col *= 1.0 - dot(vc, vc) * 0.2;

    // Tone mapping
    col = col / (col + 0.85);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
