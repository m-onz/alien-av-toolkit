// Shader 64: Noise Vertex Torus (B&W)
// Wireframe torus with sin-based vertex displacement
//
// a = displacement amp   b = displacement freq   c = speed         d = mesh density
// e = orbit speed        f = tube thickness      g = glitch        h = brightness

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

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash_f(float n) { return fract(sin(n) * 43758.5453); }

float torusSDF(vec3 p, float R, float r, float t, float amp, float freq) {
    vec2 q = vec2(length(p.xz) - R, p.y);
    float d = length(q) - r;

    float theta = atan(p.z, p.x);
    float phi = atan(q.y, q.x);

    float disp = sin(theta * freq * 2.0 + t * 1.3) * 0.3;
    disp += sin(phi * freq * 3.0 + t * 0.9) * 0.25;
    disp += sin((theta + phi) * freq * 2.5 + t * 1.7) * 0.2;
    disp += sin(theta * freq * 5.0 + phi * 2.0 + t * 2.2) * 0.1;

    return d - disp * amp;
}

vec3 torusNormal(vec3 p, float R, float r, float t, float amp, float freq) {
    float ep = 0.005;
    vec3 n = vec3(0.0);
    vec3 k;
    k = vec3( 1,-1,-1); n += k * torusSDF(p + k * ep, R, r, t, amp, freq);
    k = vec3(-1,-1, 1); n += k * torusSDF(p + k * ep, R, r, t, amp, freq);
    k = vec3(-1, 1,-1); n += k * torusSDF(p + k * ep, R, r, t, amp, freq);
    k = vec3( 1, 1, 1); n += k * torusSDF(p + k * ep, R, r, t, amp, freq);
    return normalize(n);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float amp     = param(a, 0.02, 0.2);
    float freq    = param(b, 1.0, 5.0);
    float speed   = param(c, 0.3, 2.0);
    float meshDen = param(d, 6.0, 20.0);
    float orbSpd  = param(e, 0.1, 0.8);
    float tubeR   = param(f, 0.15, 0.5);
    float glitch  = param(g, 0.0, 1.0);
    float bright  = param(h, 0.5, 2.0);

    float t = iTime * speed;
    float gt = floor(t * 6.0);

    float R = 1.0;
    float r = tubeR;

    // Glitch UV
    float lineGlitch = hash_f(floor(uv.y * 20.0) + gt);
    uv.x += (lineGlitch - 0.5) * 0.08 * glitch * step(0.85, lineGlitch);

    // Orbiting camera — tilted view
    float camAngle = iTime * orbSpd;
    vec3 ro = vec3(sin(camAngle) * 3.5, 1.2 + 0.5 * sin(iTime * 0.15), cos(camAngle) * 3.5);
    vec3 fwd = normalize(-ro);
    vec3 rt = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(rt, fwd);
    vec3 rd = normalize(fwd * 1.5 + uv.x * rt + uv.y * up);

    // Raymarch
    float totalDist = 0.0;
    bool hit = false;
    vec3 hitPos;

    for (int i = 0; i < 50; i++) {
        vec3 p = ro + rd * totalDist;
        float dd = torusSDF(p, R, r, t, amp, freq);
        if (dd < 0.004) {
            hitPos = p;
            hit = true;
            break;
        }
        if (totalDist > 10.0) break;
        totalDist += dd * 0.8;
    }

    float bw = 0.0;

    if (hit) {
        // Torus UV for grid
        float theta = atan(hitPos.z, hitPos.x);
        vec2 q = vec2(length(hitPos.xz) - R, hitPos.y);
        float phi = atan(q.y, q.x);

        // Grid lines — major rings and tube rings
        float gridTheta = fract((theta / TAU + 0.5) * meshDen);
        float gridPhi = fract((phi / TAU + 0.5) * meshDen * 0.6);
        vec2 gridDist = min(vec2(gridTheta, gridPhi), 1.0 - vec2(gridTheta, gridPhi));
        float lineW = 0.04 + 0.015 / (1.0 + totalDist * 0.3);
        float grid = 1.0 - smoothstep(0.0, lineW, min(gridDist.x, gridDist.y));

        // Diagonal cross lines for triangulated look
        float diag = fract((theta / TAU + phi / TAU + 1.0) * meshDen * 0.5);
        float diagDist = min(diag, 1.0 - diag);
        grid = max(grid, 1.0 - smoothstep(0.0, lineW * 0.7, diagDist));

        // Vertex dots
        float vertDot = 1.0 - smoothstep(0.0, lineW * 2.5, length(gridDist));

        // Lighting
        vec3 n = torusNormal(hitPos, R, r, t, amp, freq);
        float diff = max(dot(n, vec3(0.37, 0.74, 0.56)), 0.0);
        float rim = pow(1.0 - abs(dot(n, -rd)), 2.0);
        float shade = diff * 0.6 + rim * 0.25 + 0.15;

        bw = (grid * 0.85 + vertDot * 0.25) * shade;
        bw += shade * 0.03;

        bw *= exp(-totalDist * 0.08);
    }

    // Scan lines
    float scanLine = sin(fragCoord.y * 2.0) * 0.5 + 0.5;
    bw *= 0.9 + scanLine * 0.1;

    // Grain
    float grain = hash_f(dot(fragCoord.xy, vec2(12.9898, 78.233)) + iTime * 43.0);
    bw += (grain - 0.5) * 0.03;

    // Flicker
    bw *= 0.95 + 0.05 * sin(t * 20.0 + hash_f(gt) * 30.0);

    bw *= bright;
    fragColor = vec4(vec3(clamp(bw, 0.0, 1.0)), 1.0);
}
