// Shader 42: Cloth Simulation
// Wireframe cloth sheet pinned at corners, billowing with noise vertex displacement
//
// a = wind strength    b = wind speed      c = mesh density    d = drape / gravity
// e = orbit speed      f = ripple scale    g = glitch          h = brightness

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

// Freedom factor — 0 at pin points (top corners), 1 far away
float pinning(vec2 p) {
    float d1 = length(p - vec2(-1.0, 1.0));
    float d2 = length(p - vec2( 1.0, 1.0));
    return smoothstep(0.0, 0.8, min(d1, d2));
}

// Cloth Z displacement — sin-based waves modulated by pin freedom
float clothZ(vec2 p, float t, float wind, float wSpd, float drape, float ripple) {
    float free = pinning(p);

    float z = 0.0;
    z += sin(p.x * 2.0 * ripple + t * wSpd * 1.3) * 0.4;
    z += sin(p.y * 1.5 * ripple + p.x * 1.2 + t * wSpd * 0.9) * 0.3;
    z += sin((p.x - p.y) * 3.0 * ripple + t * wSpd * 1.7) * 0.2;
    z += sin(p.x * 5.0 * ripple + p.y * 2.5 + t * wSpd * 2.2) * 0.1;

    // Gravity sag — bottom of cloth droops
    float grav = max(0.0, 1.0 - p.y) * drape * 0.4;

    return z * wind * free + grav * free;
}

// SDF — thin displaced slab with finite rectangular extent
float clothSDF(vec3 p, float t, float wind, float wSpd, float drape, float ripple) {
    vec2 cp = clamp(p.xy, -1.05, 1.05);
    float edgeDist = length(p.xy - cp);

    float cz = clothZ(cp, t, wind, wSpd, drape, ripple);
    float surfDist = abs(p.z - cz) - 0.01;

    return surfDist + edgeDist;
}

vec3 clothNormal(vec3 p, float t, float wind, float wSpd, float drape, float ripple) {
    float ep = 0.006;
    vec3 n = vec3(0.0);
    vec3 k;
    k = vec3( 1,-1,-1); n += k * clothSDF(p + k * ep, t, wind, wSpd, drape, ripple);
    k = vec3(-1,-1, 1); n += k * clothSDF(p + k * ep, t, wind, wSpd, drape, ripple);
    k = vec3(-1, 1,-1); n += k * clothSDF(p + k * ep, t, wind, wSpd, drape, ripple);
    k = vec3( 1, 1, 1); n += k * clothSDF(p + k * ep, t, wind, wSpd, drape, ripple);
    return normalize(n);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float wind    = param(a, 0.1, 1.0);
    float wSpd    = param(b, 0.5, 3.0);
    float meshDen = param(c, 4.0, 20.0);
    float drape   = param(d, 0.0, 2.0);
    float orbSpd  = param(e, 0.0, 1.0);
    float ripple  = param(f, 0.5, 3.0);
    float glitch  = param(g, 0.0, 1.0);
    float bright  = param(h, 0.5, 2.0);

    float t = iTime;
    float gt = floor(t * 6.0);

    // Orbiting camera
    float angle = t * orbSpd * 0.3;
    vec3 ro = vec3(sin(angle) * 3.5, 0.3, cos(angle) * 3.5);
    vec3 fwd = normalize(-ro);
    vec3 rt = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(rt, fwd);
    vec3 rd = normalize(fwd * 1.5 + uv.x * rt + uv.y * up);

    // Glitch — horizontal line jitter
    float lineGlitch = hash_f(floor(uv.y * 20.0) + gt);
    rd.x += (lineGlitch - 0.5) * 0.04 * glitch * step(0.85, lineGlitch);
    rd = normalize(rd);

    float totalDist = 0.0;
    float bw = 0.0;
    bool hit = false;
    vec3 hitPos;

    for (int i = 0; i < 60; i++) {
        vec3 p = ro + rd * totalDist;
        float dd = clothSDF(p, t, wind, wSpd, drape, ripple);
        if (dd < 0.003) {
            hitPos = p;
            hit = true;
            break;
        }
        if (totalDist > 10.0) break;
        totalDist += dd * 0.8;
    }

    if (hit) {
        // Wireframe grid
        vec2 gridUV = fract((hitPos.xy + 1.05) * meshDen * 0.5);
        vec2 gridDist = min(gridUV, 1.0 - gridUV);
        float lineW = 0.04 + 0.015 / (1.0 + totalDist * 0.3);
        float grid = 1.0 - smoothstep(0.0, lineW, min(gridDist.x, gridDist.y));

        // Diagonal cross-lines for triangulated cloth look
        float diag1 = fract((hitPos.x + hitPos.y + 2.1) * meshDen * 0.5);
        float diagDist = min(diag1, 1.0 - diag1);
        grid = max(grid, 1.0 - smoothstep(0.0, lineW * 0.7, diagDist));

        // Vertex dots at intersections
        float vertDot = 1.0 - smoothstep(0.0, lineW * 2.5, length(gridDist));

        // Lighting — both sides of cloth
        vec3 n = clothNormal(hitPos, t, wind, wSpd, drape, ripple);
        vec3 lightDir = vec3(0.41, 0.82, 0.41);
        float diff = abs(dot(n, lightDir));
        float rim = pow(1.0 - abs(dot(n, -rd)), 2.0);
        float shade = diff * 0.6 + rim * 0.25 + 0.15;

        bw = (grid * 0.85 + vertDot * 0.25) * shade;
        bw += shade * 0.03;

        // Bright dots at pin points
        float pinGlow = 1.0 - smoothstep(0.0, 0.12, length(hitPos.xy - vec2(-1.0, 1.0)));
        pinGlow += 1.0 - smoothstep(0.0, 0.12, length(hitPos.xy - vec2(1.0, 1.0)));
        bw += pinGlow * 0.6;

        bw *= exp(-totalDist * 0.08);
    }

    // Scan lines
    float scanLine = sin(fragCoord.y * 2.0) * 0.5 + 0.5;
    bw *= 0.9 + scanLine * 0.1;

    // Grain
    float grain = hash_f(dot(fragCoord.xy, vec2(12.9898, 78.233)) + t * 50.0);
    bw += (grain - 0.5) * 0.03 * (0.3 + glitch);

    // Flicker
    bw *= 0.95 + 0.05 * sin(t * 25.0 + hash_f(gt) * 40.0);

    bw *= bright;
    bw = bw / (1.0 + bw * 0.5);
    fragColor = vec4(vec3(clamp(bw, 0.0, 1.0)), 1.0);
}
