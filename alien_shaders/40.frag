// Shader 40: Lattice Warp - Wireframe Grid Volumes
// Domain-warped wireframe cubic lattice clipped to bounding volumes
// Two interpenetrating bodies - where they overlap, grids collide
// Clean white on black - no glow, no extras
//
// a = domain warp amount
// b = warp frequency
// c = grid cell size (sparse -> dense)
// d = line thickness
// e = bounding shape morph (sphere -> torus)
// f = rotation speed
// g = body spread
// h = brightness

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

vec3 hash3v(float p) {
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

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
// WIREFRAME LATTICE - distance to nearest cube edge in repeating space
// ============================================================================

float wireGrid(vec3 p, float cs, float r) {
    vec3 q = abs(mod(p + cs * 0.5, cs) - cs * 0.5);
    vec3 dd = cs * 0.5 - q;
    // Distance to edges parallel to each axis
    float ex = length(dd.yz);
    float ey = length(dd.xz);
    float ez = length(dd.xy);
    return min(min(ex, ey), ez) - r;
}

// ============================================================================
// DOMAIN WARP - cheap sine-based, no noise lookups
// ============================================================================

vec3 warpPos(vec3 p, float amt, float freq, float phase) {
    return p + vec3(
        sin(p.y * freq + phase * 0.50 + p.z * 0.3),
        sin(p.z * freq + phase * 0.40 + p.x * 0.3),
        sin(p.x * freq + phase * 0.35 + p.y * 0.3)
    ) * amt;
}

// ============================================================================
// BOUNDING SHAPES
// ============================================================================

float sdSph(vec3 p, float r) { return length(p) - r; }

float sdTor(vec3 p, float R, float r) {
    vec2 q = vec2(length(p.xz) - R, p.y);
    return length(q) - r;
}

// ============================================================================
// SCENE - 2 interpenetrating wireframe lattice bodies
// ============================================================================

float mapScene(vec3 p, float wamt, float wfreq, float cs, float thick,
               float morph, float rspd, float spread, float t) {
    float result = 1e10;

    for (int i = 0; i < 2; i++) {
        float fi = float(i);
        vec3 rnd = hash3v(fi * 73.0 + 17.0);

        // Body position - orbit
        float orbit = fi * PI + t * 0.1;
        vec3 center = vec3(cos(orbit), sin(t * 0.2 + fi * 2.0) * 0.3,
                           sin(orbit)) * spread;

        // Per-body rotation
        mat3 rot = rotMat(rnd * TAU + t * rspd * vec3(0.25, 0.2, 0.15));
        vec3 bp = rot * (p - center);

        // Bounding shape with morph
        float boundSize = 1.0 + rnd.z * 0.4;
        float bound = 0.0;
        if (morph < 0.5) {
            float bl = morph * 2.0;
            bound = mix(sdSph(bp, boundSize),
                        sdTor(bp, boundSize * 0.7, boundSize * 0.35), bl);
        } else {
            float bl = (morph - 0.5) * 2.0;
            bound = mix(sdTor(bp, boundSize * 0.7, boundSize * 0.35),
                        sdSph(bp * vec3(1.0, 1.5, 0.7), boundSize * 0.8), bl);
        }

        // Domain-warped lattice (different phase per body)
        vec3 wp = warpPos(bp, wamt, wfreq, t + fi * 50.0);
        float grid = wireGrid(wp, cs, thick);

        // Clip lattice to bounding volume
        float body = max(grid, bound);
        result = min(result, body);
    }

    return result;
}

// ============================================================================
// MAIN
// ============================================================================

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float wamt   = mix(0.0, 0.8, a);
    float wfreq  = mix(1.0, 4.0, b);
    float cs     = mix(0.6, 0.15, c);   // inverted: high c = dense grid
    float thick  = mix(0.005, 0.03, d);
    float morph  = e;
    float rspd   = mix(0.05, 0.6, f);
    float spread = mix(0.3, 1.8, g);
    float bright = mix(0.5, 1.5, h);

    float t = iTime;

    // Camera - orbit
    float camA = t * 0.08;
    vec3 ro = vec3(sin(camA) * 4.0, sin(t * 0.04) * 0.5, cos(camA) * 4.0);
    vec3 fwd = normalize(-ro);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, fwd);
    vec3 rd = normalize(fwd * 1.3 + right * uv.x + up * uv.y);

    // Raymarch - 50 steps, fast SDF
    float td = 0.0;
    bool hit = false;
    vec3 hitPos = ro;

    for (int i = 0; i < 50; i++) {
        vec3 p = ro + rd * td;
        float dist = mapScene(p, wamt, wfreq, cs, thick, morph, rspd, spread, t);

        if (dist < 0.001) {
            hit = true;
            hitPos = p;
            break;
        }

        td += dist * 0.9;
        if (td > 12.0) break;
    }

    vec3 col = vec3(0.0);

    if (hit) {
        // Clean white, depth fade only
        float depthFade = 1.0 / (1.0 + td * 0.12);
        col = vec3(depthFade * bright);
    }

    // Vignette
    vec2 vc = fragCoord / iResolution.xy * 2.0 - 1.0;
    col *= 1.0 - dot(vc, vc) * 0.15;

    fragColor = vec4(col, 1.0);
}
