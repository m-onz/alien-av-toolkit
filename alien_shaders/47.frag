// Shader 47: Noise Cube Swarm (B&W)
// Raymarched distorted cubes with noise-driven swirling motion, smooth merging
//
// a = cube count        b = cube size       c = speed           d = spread
// e = distortion        f = spin rate       g = glitch          h = brightness

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

#define MAX_CUBES 10

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash_f(float n) { return fract(sin(n) * 43758.5453); }

float smin(float aa, float bb, float k) {
    float hh = clamp(0.5 + 0.5 * (bb - aa) / k, 0.0, 1.0);
    return mix(bb, aa, hh) - k * hh * (1.0 - hh);
}

// Distorted box — sin-based vertex warping
float sdDistortBox(vec3 p, float sz, float dist, float tt) {
    p += vec3(
        sin(p.y * 6.0 + tt * 2.0) * sin(p.z * 5.0 + tt * 1.5),
        sin(p.z * 6.0 + tt * 1.8) * sin(p.x * 5.0 + tt * 2.2),
        sin(p.x * 6.0 + tt * 2.5) * sin(p.y * 5.0 + tt * 1.3)
    ) * dist;
    vec3 q = abs(p) - vec3(sz);
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

mat3 rotX(float aa) { float cc = cos(aa), ss = sin(aa); return mat3(1,0,0, 0,cc,-ss, 0,ss,cc); }
mat3 rotY(float aa) { float cc = cos(aa), ss = sin(aa); return mat3(cc,0,ss, 0,1,0, -ss,0,cc); }

// Noise-driven cube position — layered sin waves for swirling organic paths
vec3 cubePos(float i, float t, float spread) {
    // Multi-frequency oscillators
    float px = sin(t * 0.4 + i * 2.1) * cos(t * 0.25 + i * 0.7);
    float py = cos(t * 0.35 + i * 1.8) * sin(t * 0.2 + i * 1.3);
    float pz = sin(t * 0.45 + i * 0.9) * cos(t * 0.15 + i * 2.5);

    // Orbital component — cubes orbit around center
    float orbit = t * (0.3 + sin(i * 3.7) * 0.15);
    float orbitR = 0.5 + 0.3 * sin(t * 0.15 + i * 1.1);

    px += sin(orbit + i * 1.047) * orbitR;
    py += cos(orbit * 0.7 + i * 0.8) * orbitR * 0.6;
    pz += sin(orbit * 0.5 + i * 2.0 + 1.0) * orbitR;

    // High-freq wobble
    px += sin(t * 1.5 + i * 4.3) * 0.12;
    py += sin(t * 1.3 + i * 5.1) * 0.08;
    pz += sin(t * 1.7 + i * 3.7) * 0.1;

    return vec3(px, py, pz) * spread;
}

// Smooth continuous rotation with wobble
mat3 cubeRot(float i, float t, float spin) {
    float rx = t * spin * sin(i * 17.1) + sin(t * 0.5 + i * 2.3) * 0.5;
    float ry = t * spin * sin(i * 29.3) + cos(t * 0.4 + i * 1.7) * 0.5;
    return rotY(ry) * rotX(rx);
}

float scene(vec3 p, float t, int numCubes, float cubeSize, float spread, float spin, float distort) {
    float dd = 1e10;
    for (int i = 0; i < MAX_CUBES; i++) {
        if (i >= numCubes) break;
        float fi = float(i);
        vec3 cpos = cubePos(fi, t, spread);
        mat3 crot = cubeRot(fi, t, spin);
        vec3 lp = crot * (p - cpos);

        // Per-cube size pulsation
        float sz = cubeSize * (0.8 + 0.3 * sin(t * 0.8 + fi * 1.7));

        float cd = sdDistortBox(lp, sz, distort * sz, t + fi * 0.5);
        dd = smin(dd, cd, 0.08);
    }
    return dd;
}

vec3 sceneNormal(vec3 p, float t, int numCubes, float cubeSize, float spread, float spin, float distort) {
    float ep = 0.005;
    vec3 n = vec3(0.0);
    vec3 k;
    k = vec3( 1,-1,-1); n += k * scene(p + k * ep, t, numCubes, cubeSize, spread, spin, distort);
    k = vec3(-1,-1, 1); n += k * scene(p + k * ep, t, numCubes, cubeSize, spread, spin, distort);
    k = vec3(-1, 1,-1); n += k * scene(p + k * ep, t, numCubes, cubeSize, spread, spin, distort);
    k = vec3( 1, 1, 1); n += k * scene(p + k * ep, t, numCubes, cubeSize, spread, spin, distort);
    return normalize(n);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    int numCubes   = 3 + int(a * 7.0);
    float cubeSize = param(b, 0.1, 0.3);
    float speed    = param(c, 0.3, 2.0);
    float spread   = param(d, 0.8, 2.0);
    float distort  = param(e, 0.0, 0.15);
    float spin     = param(f, 0.3, 3.0);
    float glitch   = param(g, 0.0, 1.0);
    float bright   = param(h, 0.5, 2.0);

    float t = iTime * speed;
    float gt = floor(t * 6.0);

    // Glitch UV
    float lineGlitch = hash_f(floor(uv.y * 20.0) + gt);
    uv.x += (lineGlitch - 0.5) * 0.08 * glitch * step(0.85, lineGlitch);

    // Orbiting camera
    float camAngle = iTime * 0.3;
    vec3 ro = vec3(sin(camAngle) * 5.0, 1.5 + sin(iTime * 0.15) * 0.5, cos(camAngle) * 5.0);
    vec3 fwd = normalize(-ro);
    vec3 rt = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(rt, fwd);
    vec3 rd = normalize(fwd * 1.8 + uv.x * rt + uv.y * up);

    // Raymarch
    float totalDist = 0.0;
    float lastDist = 1.0;
    bool hit = false;
    vec3 hitPos;

    for (int i = 0; i < 50; i++) {
        hitPos = ro + rd * totalDist;
        lastDist = scene(hitPos, t, numCubes, cubeSize, spread, spin, distort);
        if (lastDist < 0.004) {
            hit = true;
            break;
        }
        if (totalDist > 10.0) break;
        totalDist += lastDist * 0.9;
    }

    float bw = 0.0;

    if (hit) {
        vec3 n = sceneNormal(hitPos, t, numCubes, cubeSize, spread, spin, distort);

        // Find closest cube for edge detection
        float edgeBri = 0.0;
        for (int i = 0; i < MAX_CUBES; i++) {
            if (i >= numCubes) break;
            float fi = float(i);
            vec3 cpos = cubePos(fi, t, spread);
            mat3 crot = cubeRot(fi, t, spin);
            vec3 lp = crot * (hitPos - cpos);
            float sz = cubeSize * (0.8 + 0.3 * sin(t * 0.8 + fi * 1.7));

            // Apply same distortion for edge detection
            vec3 dlp = lp + vec3(
                sin(lp.y * 6.0 + (t + fi * 0.5) * 2.0) * sin(lp.z * 5.0 + (t + fi * 0.5) * 1.5),
                sin(lp.z * 6.0 + (t + fi * 0.5) * 1.8) * sin(lp.x * 5.0 + (t + fi * 0.5) * 2.2),
                sin(lp.x * 6.0 + (t + fi * 0.5) * 2.5) * sin(lp.y * 5.0 + (t + fi * 0.5) * 1.3)
            ) * distort * sz;

            vec3 q = abs(dlp) - vec3(sz);
            float bd = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
            if (bd < 0.02) {
                vec3 ap = abs(dlp);
                float eXY = max(abs(ap.x - sz), abs(ap.y - sz));
                float eXZ = max(abs(ap.x - sz), abs(ap.z - sz));
                float eYZ = max(abs(ap.y - sz), abs(ap.z - sz));
                float eDist = min(min(eXY, eXZ), eYZ);
                edgeBri = 1.0 - smoothstep(0.0, sz * 0.18, eDist);
                break;
            }
        }

        // Lighting
        float diff = max(dot(n, vec3(0.37, 0.74, 0.56)), 0.0);
        float rim = pow(1.0 - abs(dot(n, -rd)), 2.5);

        // Curvature-based highlight — bright at sharp bends from distortion
        float ao = 0.5 + 0.5 * (scene(hitPos + n * 0.1, t, numCubes, cubeSize, spread, spin, distort) / 0.1);

        float shade = diff * 0.6 + 0.15;

        // Combine face shading + distorted wireframe edges + rim + AO
        bw = shade * 0.4 + edgeBri * 0.7 + rim * 0.35;
        bw *= 0.5 + ao * 0.5;

        // Distance fog
        bw *= exp(-totalDist * 0.08);
    }

    // Near-miss glow
    float glow = exp(-lastDist * lastDist * 8.0) * 0.15;
    bw += glow;

    // Scan lines
    float scanLine = sin(fragCoord.y * 2.0) * 0.5 + 0.5;
    bw *= 0.9 + scanLine * 0.1;

    // Block glitch
    vec2 blockUV = floor(uv * 8.0);
    float blockTrigger = step(0.92 - glitch * 0.08, hash_f(dot(blockUV, vec2(127.1, 311.7)) + gt));
    bw = mix(bw, 1.0 - bw, blockTrigger * glitch * 0.4);

    // Grain
    float grain = hash_f(dot(fragCoord.xy, vec2(12.9898, 78.233)) + iTime * 50.0);
    bw += (grain - 0.5) * 0.03;

    // Flicker
    bw *= 0.95 + 0.05 * sin(t * 20.0 + hash_f(gt) * 30.0);

    bw *= bright;
    fragColor = vec4(vec3(clamp(bw, 0.0, 1.0)), 1.0);
}
