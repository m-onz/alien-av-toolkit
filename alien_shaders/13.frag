// Shader 13: Distorted Mesh Wave / Ocean
// Wireframe ocean surface — perspective grid with wave displacement
//
// a = wave height      b = wave frequency    c = speed         d = mesh density
// e = turbulence       f = camera height     g = glitch        h = brightness

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

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash_f(float n) { return fract(sin(n) * 43758.5453); }

float waves(vec2 p, float t, float freq, float amp, float turb) {
    float w = 0.0;
    w += sin(p.x * freq + t * 1.3) * 0.35;
    w += sin(p.y * freq * 0.7 - t * 0.9) * 0.25;
    w += sin((p.x + p.y) * freq * 0.5 + t * 1.6) * 0.2;
    w += sin((p.x - p.y) * freq * 1.1 + t * 0.8) * 0.12;
    w += sin(p.x * freq * 2.3 + p.y * freq * 1.8 + t * 2.2) * 0.08 * (0.5 + turb);
    w += sin(p.y * freq * 3.0 - p.x * freq * 0.5 + t * 1.7) * 0.06 * turb;
    return w * amp;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float amp      = param(a, 0.15, 1.0);
    float freq     = param(b, 1.5, 6.0);
    float speed    = param(c, 0.3, 2.0);
    float meshDen  = param(d, 2.0, 15.0);
    float turb     = param(e, 0.0, 1.0);
    float camH     = param(f, 0.3, 0.8);
    float glitchAmt= param(g, 0.0, 1.0);
    float bright   = param(h, 0.5, 2.0);

    float t = iTime * speed;

    // Glitch UV displacement
    float gt = floor(t * 6.0);
    float lineGlitch = hash_f(floor(uv.y * 25.0) + gt);
    uv.x += (lineGlitch - 0.5) * 0.15 * glitchAmt * step(0.85, lineGlitch);

    // Camera — drifts forward over the surface
    vec3 ro = vec3(t * 0.4, 2.0 + camH * 3.0, t * 0.6);
    vec3 target = ro + vec3(0.0, -camH, 1.0);

    vec3 fwd = normalize(target - ro);
    vec3 rt = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(rt, fwd);
    vec3 rd = normalize(fwd * 1.5 + uv.x * rt + uv.y * up);

    // Raymarch to wave surface
    float bw = 0.0;
    float totalDist = 0.0;
    bool hit = false;
    vec3 hitPos;

    for (int i = 0; i < 50; i++) {
        vec3 p = ro + rd * totalDist;
        float wh = waves(p.xz, t, freq, amp, turb);
        float dd = p.y - wh;
        if (dd < 0.02) {
            hitPos = p;
            hit = true;
            break;
        }
        if (totalDist > 40.0) break;
        totalDist += max(dd * 0.4, 0.08);
    }

    if (hit) {
        vec2 wp = hitPos.xz;

        // Wireframe grid
        vec2 gridUV = fract(wp * meshDen);
        vec2 gridDist = min(gridUV, 1.0 - gridUV);
        float lineWidth = 0.03 + 0.02 / (1.0 + totalDist * 0.1);
        float gridLine = 1.0 - smoothstep(0.0, lineWidth, min(gridDist.x, gridDist.y));

        // Vertex dots at grid intersections
        float dotSize = lineWidth * 2.5;
        float vertDot = 1.0 - smoothstep(0.0, dotSize, length(gridDist));

        // Surface normal via central differences
        float ep = 0.06;
        float hL = waves(wp + vec2(-ep, 0.0), t, freq, amp, turb);
        float hR = waves(wp + vec2( ep, 0.0), t, freq, amp, turb);
        float hD = waves(wp + vec2(0.0, -ep), t, freq, amp, turb);
        float hU = waves(wp + vec2(0.0,  ep), t, freq, amp, turb);
        vec3 n = normalize(vec3(hL - hR, ep * 2.0, hD - hU));

        // Lighting
        float diff = max(dot(n, vec3(0.37, 0.74, 0.56)), 0.0);
        float rim = pow(1.0 - abs(dot(n, normalize(-rd))), 2.0);
        float shade = diff * 0.6 + rim * 0.3 + 0.1;

        // Combine grid + vertex dots + subtle fill
        bw = (gridLine * 0.9 + vertDot * 0.3) * shade;
        bw += shade * 0.04;

        // Distance fog
        bw *= exp(-totalDist * 0.06);
    }

    // Horizon glow
    bw += smoothstep(0.1, 0.0, abs(uv.y + 0.1)) * 0.12;

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
