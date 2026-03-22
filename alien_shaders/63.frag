// Shader 63: Noise Vertex Sphere (B&W)
// Wireframe sphere with sin-based radial vertex displacement
//
// a = displacement amp   b = displacement freq   c = speed         d = mesh density
// e = orbit speed        f = pulse rate          g = glitch        h = brightness

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

float sphereSDF(vec3 p, float t, float amp, float freq) {
    float r = length(p);
    vec3 n = p / max(r, 0.001);
    float disp = sin(n.x * freq * 3.0 + n.y * 2.0 + t * 1.3) * 0.3;
    disp += sin(n.y * freq * 2.5 + n.z * 1.5 + t * 0.9) * 0.25;
    disp += sin((n.x + n.z) * freq * 4.0 + t * 1.7) * 0.15;
    disp += sin(n.z * freq * 5.0 + n.x * n.y * 3.0 + t * 2.2) * 0.1;
    return r - 1.0 - disp * amp;
}

vec3 sphereNormal(vec3 p, float t, float amp, float freq) {
    float ep = 0.005;
    vec3 n = vec3(0.0);
    vec3 k;
    k = vec3( 1,-1,-1); n += k * sphereSDF(p + k * ep, t, amp, freq);
    k = vec3(-1,-1, 1); n += k * sphereSDF(p + k * ep, t, amp, freq);
    k = vec3(-1, 1,-1); n += k * sphereSDF(p + k * ep, t, amp, freq);
    k = vec3( 1, 1, 1); n += k * sphereSDF(p + k * ep, t, amp, freq);
    return normalize(n);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float amp     = param(a, 0.05, 0.4);
    float freq    = param(b, 1.0, 4.0);
    float speed   = param(c, 0.3, 2.0);
    float meshDen = param(d, 6.0, 20.0);
    float orbSpd  = param(e, 0.1, 0.8);
    float pulse   = param(f, 0.0, 2.0);
    float glitch  = param(g, 0.0, 1.0);
    float bright  = param(h, 0.5, 2.0);

    float t = iTime * speed;
    float gt = floor(t * 6.0);

    // Glitch UV
    float lineGlitch = hash_f(floor(uv.y * 20.0) + gt);
    uv.x += (lineGlitch - 0.5) * 0.08 * glitch * step(0.85, lineGlitch);

    // Orbiting camera
    float camAngle = iTime * orbSpd;
    vec3 ro = vec3(sin(camAngle) * 3.0, 0.5 * sin(iTime * 0.2), cos(camAngle) * 3.0);
    vec3 fwd = normalize(-ro);
    vec3 rt = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(rt, fwd);
    vec3 rd = normalize(fwd * 1.5 + uv.x * rt + uv.y * up);

    // Pulse modulates amplitude
    float ampPulse = amp * (1.0 + sin(t * pulse) * 0.3);

    // Raymarch
    float totalDist = 0.0;
    bool hit = false;
    vec3 hitPos;

    for (int i = 0; i < 50; i++) {
        vec3 p = ro + rd * totalDist;
        float dd = sphereSDF(p, t, ampPulse, freq);
        if (dd < 0.004) {
            hitPos = p;
            hit = true;
            break;
        }
        if (totalDist > 8.0) break;
        totalDist += dd * 0.8;
    }

    float bw = 0.0;

    if (hit) {
        // Spherical coordinates for lat/long grid
        vec3 hp = normalize(hitPos);
        float theta = atan(hp.z, hp.x);
        float phi = asin(clamp(hp.y, -1.0, 1.0));

        // Grid lines
        float gridTheta = fract((theta / TAU + 0.5) * meshDen);
        float gridPhi = fract((phi / PI + 0.5) * meshDen);
        vec2 gridDist = min(vec2(gridTheta, gridPhi), 1.0 - vec2(gridTheta, gridPhi));
        float lineW = 0.04 + 0.015 / (1.0 + totalDist * 0.3);
        float grid = 1.0 - smoothstep(0.0, lineW, min(gridDist.x, gridDist.y));

        // Vertex dots
        float vertDot = 1.0 - smoothstep(0.0, lineW * 2.5, length(gridDist));

        // Lighting
        vec3 n = sphereNormal(hitPos, t, ampPulse, freq);
        float diff = max(dot(n, vec3(0.37, 0.74, 0.56)), 0.0);
        float rim = pow(1.0 - abs(dot(n, -rd)), 2.0);
        float shade = diff * 0.6 + rim * 0.25 + 0.15;

        bw = (grid * 0.85 + vertDot * 0.25) * shade;
        bw += shade * 0.03;

        bw *= exp(-totalDist * 0.1);
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
