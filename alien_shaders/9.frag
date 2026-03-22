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
// 9.frag — Mesh Noise Landscape
// ============================================================
// 3D wireframe grid centered on screen with noise vertex
// displacement. Clean white lines on black. Rotates on axis.
// Size grows beyond screen bounds. Visible at all defaults.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Height — vertex noise amplitude (very responsive)   [0 .. 8.0]
//   b = Size — landscape scale, grows beyond screen         [1.5 .. 12]
//   c = Warp — domain distortion of terrain shape           [0 .. 2.0]
//   d = Warp speed — domain warp animation (moves default)  [0.3 .. 1.5]
//   e = Rotation X — tilt forward/back                      [0.7 .. TAU+0.7]
//   f = Rotation Y — spin                                   [0 .. TAU]
//   g = Grid density — mesh subdivisions                    [6 .. 14]
//   h = Noise speed — terrain movement (default=moving)     [0.2 .. 2.0]
// ============================================================

#define PI 3.14159265359
#define TAU 6.28318530718
#define MAXGRID 14

float param(float p, float lo, float hi) { return mix(lo, hi, p); }

// Sin-based terrain — no hash/noise lookups, still organic
float terrainH(vec2 p, float warp, float warpSpd, float t) {
    p += vec2(sin(p.y * 0.7 + t * warpSpd), cos(p.x * 0.6 + t * warpSpd * 0.8)) * warp;
    float h = sin(p.x * 1.0 + t * 0.3) * 0.35;
    h += sin(p.y * 0.8 - t * 0.2) * 0.3;
    h += sin((p.x + p.y) * 1.5 + t * 0.5) * 0.2;
    h += sin((p.x - p.y) * 2.0 + t * 0.4) * 0.15;
    return h;
}

mat3 rotateX(float ang) {
    float c = cos(ang), s = sin(ang);
    return mat3(1,0,0, 0,c,-s, 0,s,c);
}
mat3 rotateY(float ang) {
    float c = cos(ang), s = sin(ang);
    return mat3(c,0,s, 0,1,0, -s,0,c);
}

vec2 proj(vec3 p) {
    float z = p.z + 5.0;
    return p.xy * 2.0 / max(z, 0.1);
}

float lineDist(vec2 p, vec2 va, vec2 vb) {
    vec2 ab = vb - va;
    float l2 = dot(ab, ab);
    if (l2 < 1e-8) return length(p - va);
    float t = clamp(dot(p - va, ab) / l2, 0.0, 1.0);
    return length(p - (va + ab * t));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float heightAmp  = param(a, 0.0, 8.0);
    float sz         = param(b, 1.5, 12.0);
    float warp       = param(c, 0.0, 2.0);
    float warpSpeed  = param(d, 0.3, 1.5);
    float rxa        = param(e, 0.7, TAU + 0.7);
    float rya        = param(f, 0.0, TAU);
    float gridCount  = param(g, 6.0, 14.0);
    float nSpeed     = param(h, 0.2, 2.0);

    float t = iTime;
    mat3 rot = rotateY(rya) * rotateX(rxa);

    int gN = int(gridCount);
    float stp = sz / gridCount;
    float hf = sz * 0.5;

    // Pixel size for crisp anti-aliasing
    float px = 1.5 / iResolution.y;
    // Reject margin: skip segments whose bbox is far from this pixel
    float margin = px * 3.0 + 0.05;

    float bright = 0.0;

    // Horizontal lines
    for (int j = 0; j <= MAXGRID; j++) {
        if (j > gN) break;
        float gz = -hf + float(j) * stp;

        float gx0 = -hf;
        float hy0 = terrainH(vec2(gx0, gz) * 2.0 + t * nSpeed, warp, warpSpeed, t) * heightAmp;
        vec2 prev = proj(rot * vec3(gx0, hy0, gz));

        for (int i = 1; i <= MAXGRID; i++) {
            if (i > gN) break;
            float gx = -hf + float(i) * stp;
            float hy = terrainH(vec2(gx, gz) * 2.0 + t * nSpeed, warp, warpSpeed, t) * heightAmp;
            vec2 cur = proj(rot * vec3(gx, hy, gz));

            // Bounding box reject — skip segments far from this pixel
            vec2 lo = min(prev, cur) - margin;
            vec2 hi = max(prev, cur) + margin;
            if (uv.x >= lo.x && uv.x <= hi.x && uv.y >= lo.y && uv.y <= hi.y) {
                float dist = lineDist(uv, prev, cur);
                bright = max(bright, 1.0 - smoothstep(0.0, px, dist));
            }

            prev = cur;
        }
    }

    // Vertical lines
    for (int i = 0; i <= MAXGRID; i++) {
        if (i > gN) break;
        float gx = -hf + float(i) * stp;

        float gz0 = -hf;
        float hy0 = terrainH(vec2(gx, gz0) * 2.0 + t * nSpeed, warp, warpSpeed, t) * heightAmp;
        vec2 prev = proj(rot * vec3(gx, hy0, gz0));

        for (int j = 1; j <= MAXGRID; j++) {
            if (j > gN) break;
            float gz = -hf + float(j) * stp;
            float hy = terrainH(vec2(gx, gz) * 2.0 + t * nSpeed, warp, warpSpeed, t) * heightAmp;
            vec2 cur = proj(rot * vec3(gx, hy, gz));

            vec2 lo = min(prev, cur) - margin;
            vec2 hi = max(prev, cur) + margin;
            if (uv.x >= lo.x && uv.x <= hi.x && uv.y >= lo.y && uv.y <= hi.y) {
                float dist = lineDist(uv, prev, cur);
                bright = max(bright, 1.0 - smoothstep(0.0, px, dist));
            }

            prev = cur;
        }
    }

    fragColor = vec4(vec3(clamp(bright, 0.0, 1.0)), 1.0);
}
