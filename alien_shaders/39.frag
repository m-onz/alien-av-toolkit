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
// 39.frag — Glitch Boids Flock (B&W)
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Flock density — number of boids             [4 .. 16]
//   b = Separation — how hard boids repel each other
//   c = Cohesion — pull toward flock center
//   d = Alignment — match neighbor velocity
//   e = Glitch — vertex jitter / positional corruption
//   f = Speed — animation / flight speed
//   g = Camera X rotation — orbit horizontal angle
//   h = Camera Y rotation — orbit vertical angle
// ============================================================

#define PI 3.14159265359
#define TAU 6.28318530718
#define MAX_BOIDS 16

float param(float p, float lo, float hi) { return mix(lo, hi, p); }

float hash(float n) { return fract(sin(n) * 43758.5453123); }
vec3 hash3(float n) {
    return fract(sin(vec3(n, n + 1.0, n + 2.0) * vec3(43758.5453, 22578.1459, 19642.3490)));
}

float smin(float aa, float bb, float k) {
    float hh = clamp(0.5 + 0.5 * (bb - aa) / k, 0.0, 1.0);
    return mix(bb, aa, hh) - k * hh * (1.0 - hh);
}

// --- Glitch offset ---
vec3 glitchJump(float seed, float amt, float gt) {
    float trigger = step(0.5, hash(seed * 3.7 + gt));
    vec3 off = vec3(
        hash(seed + gt * 1.1) - 0.5,
        hash(seed + gt * 2.3 + 10.0) - 0.5,
        hash(seed + gt * 3.7 + 20.0) - 0.5
    );
    return off * amt * trigger * 2.0;
}

// --- Boid position ---
vec3 boidPos(int i, float t, float separation, float cohesion, float alignment, float glitchAmt, float gt) {
    float fi = float(i);
    vec3 seed = hash3(fi * 17.31);

    float orbitSpeed = 0.3 + seed.x * 0.4;
    float orbitRadius = 0.8 + seed.y * 1.2;
    float phase = seed.z * TAU;
    float tilt = (seed.x - 0.5) * 1.2;

    vec3 basePos = vec3(
        cos(t * orbitSpeed + phase) * orbitRadius,
        sin(t * orbitSpeed * 0.7 + phase + tilt) * orbitRadius * 0.5,
        sin(t * orbitSpeed + phase) * orbitRadius
    );

    float sepForce = separation * 0.6;
    vec3 fromCenter = normalize(basePos + 0.001) * sepForce;
    basePos += fromCenter * (0.3 + 0.2 * sin(t * 0.5 + fi));

    vec3 flockCenter = vec3(
        sin(t * 0.15) * 0.5,
        cos(t * 0.12) * 0.3,
        sin(t * 0.1 + 1.0) * 0.5
    );
    basePos = mix(basePos, flockCenter, cohesion * 0.3);

    float alignWave = sin(t * 2.0 + fi * alignment * 0.5) * alignment * 0.3;
    basePos.y += alignWave;

    // Glitch jitter
    basePos += glitchJump(fi * 13.0, glitchAmt, gt);

    return basePos;
}

// --- Scene SDF ---
vec2 mapScene(vec3 p, float t, int numBoids, float sep, float coh, float ali, float glitchAmt, float gt) {
    float dd = 100.0;
    float closest = 0.0;
    for (int i = 0; i < MAX_BOIDS; i++) {
        if (i >= numBoids) break;
        vec3 bp = boidPos(i, t, sep, coh, ali, glitchAmt, gt);
        float bd = length(p - bp) - 0.07;
        if (bd < dd) { closest = float(i); }
        dd = smin(dd, bd, 0.08);
    }
    return vec2(dd, closest);
}

float mapSceneD(vec3 p, float t, int numBoids, float sep, float coh, float ali, float glitchAmt, float gt) {
    float dd = 100.0;
    for (int i = 0; i < MAX_BOIDS; i++) {
        if (i >= numBoids) break;
        vec3 bp = boidPos(i, t, sep, coh, ali, glitchAmt, gt);
        float bd = length(p - bp) - 0.07;
        dd = smin(dd, bd, 0.08);
    }
    return dd;
}

// --- Normal (tetrahedral) ---
vec3 calcNormal(vec3 p, float t, int numBoids, float sep, float coh, float ali, float glitchAmt, float gt) {
    float ep = 0.004;
    vec3 a0 = vec3( 1, -1, -1);
    vec3 a1 = vec3(-1, -1,  1);
    vec3 a2 = vec3(-1,  1, -1);
    vec3 a3 = vec3( 1,  1,  1);
    return normalize(
        a0 * mapSceneD(p + a0 * ep, t, numBoids, sep, coh, ali, glitchAmt, gt) +
        a1 * mapSceneD(p + a1 * ep, t, numBoids, sep, coh, ali, glitchAmt, gt) +
        a2 * mapSceneD(p + a2 * ep, t, numBoids, sep, coh, ali, glitchAmt, gt) +
        a3 * mapSceneD(p + a3 * ep, t, numBoids, sep, coh, ali, glitchAmt, gt)
    );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    int numBoids     = int(param(a, 4.0, 16.0));
    float separation = b;
    float cohesion   = c;
    float alignment  = d;
    float glitchAmt  = param(e, 0.0, 1.5);
    float speed      = param(f, 0.2, 2.0);
    float camAngleX  = param(g, 0.0, TAU);
    float camAngleY  = param(h, -0.8, 0.8);

    float t = iTime * speed;
    float gt = floor(t * 6.0);

    // Glitch UV distortion
    float glitchTime = floor(t * 5.0);
    vec2 glitchUV = uv;
    float lineGlitch = hash(floor(uv.y * 20.0) + glitchTime);
    glitchUV.x += (lineGlitch - 0.5) * 0.1 * glitchAmt * step(0.8, lineGlitch);

    // Camera
    float camDist = 4.5;
    vec3 camPos = vec3(
        cos(camAngleX) * cos(camAngleY) * camDist,
        sin(camAngleY) * camDist,
        sin(camAngleX) * cos(camAngleY) * camDist
    );
    vec3 camFwd = normalize(-camPos);
    vec3 camRight = normalize(cross(camFwd, vec3(0.0, 1.0, 0.0)));
    vec3 camUp = cross(camRight, camFwd);

    vec3 rd = normalize(glitchUV.x * camRight + glitchUV.y * camUp + 1.5 * camFwd);
    vec3 ro = camPos;

    // Raymarch
    float totalDist = 0.0;
    float minDist = 100.0;
    bool hit = false;
    vec3 hitPos = vec3(0.0);
    float closestIdx = 0.0;

    for (int i = 0; i < 50; i++) {
        vec3 p = ro + rd * totalDist;
        vec2 sc = mapScene(p, t, numBoids, separation, cohesion, alignment, glitchAmt, gt);
        minDist = min(minDist, sc.x);
        closestIdx = sc.y;

        if (sc.x < 0.003) {
            hit = true;
            hitPos = p;
            break;
        }
        totalDist += sc.x;
        if (totalDist > 12.0) break;
    }

    float bw = 0.0;

    if (hit) {
        vec3 n = calcNormal(hitPos, t, numBoids, separation, cohesion, alignment, glitchAmt, gt);

        vec3 lightDir = normalize(vec3(0.6, 0.8, -0.5));
        float diff = max(dot(n, lightDir), 0.0) * 0.7 + 0.3;

        vec3 viewDir = normalize(ro - hitPos);
        vec3 halfDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(n, halfDir), 0.0), 32.0);
        float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);

        // Flicker per boid
        float flicker = 1.0 - glitchAmt * 0.3 * step(0.75, hash(gt + closestIdx * 5.0));

        bw = diff;
        bw += spec * 0.4;
        bw += fresnel * 0.3;
        bw *= flicker;

        float fog = exp(-totalDist * 0.15);
        bw *= fog;
    } else {
        bw = exp(-minDist * 2.0) * 0.1;
    }

    // Trail dots
    int trailCount = numBoids < 8 ? numBoids : 8;
    for (int i = 0; i < 8; i++) {
        if (i >= trailCount) break;
        vec3 bp = boidPos(i, t, separation, cohesion, alignment, glitchAmt, gt);
        vec3 toB = bp - ro;
        float zDist = dot(toB, camFwd);
        float zValid = step(0.1, zDist);
        vec2 screenPos = vec2(dot(toB, camRight), dot(toB, camUp)) / (max(zDist, 0.1) / 1.5);
        float dd = length(glitchUV - screenPos);
        bw += 0.003 / (dd + 0.005) * 0.06 * zValid;
    }

    // Scan lines
    float scanLine = sin(fragCoord.y * 2.0) * 0.5 + 0.5;
    bw *= 0.88 + scanLine * 0.12;

    // Block glitch
    vec2 blockUV = floor(uv * 8.0);
    float blockTrigger = step(0.92 - glitchAmt * 0.1, hash(dot(blockUV, vec2(127.1, 311.7)) + glitchTime));
    bw *= 1.0 + blockTrigger * 0.5;

    // Noise grain
    float grain = hash(dot(fragCoord.xy, vec2(12.9898, 78.233)) + t * 50.0);
    bw += (grain - 0.5) * 0.06 * (0.3 + glitchAmt * 0.7);

    // Flicker
    float flicker = 0.93 + 0.07 * sin(t * 25.0 + hash(glitchTime) * 40.0);
    bw *= flicker;


    bw = bw / (1.0 + bw * 0.5);
    fragColor = vec4(vec3(clamp(bw, 0.0, 1.0)), 1.0);
}
