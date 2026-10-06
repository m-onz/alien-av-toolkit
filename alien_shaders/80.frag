// Shader 80: Metallic Blob Wobbler — OPTIMIZED (drop-in replacement for 15.frag)
// Bang-triggered fluid metallic blob that wobbles and compounds effects.
// Same parameters a-h, same look — restructured for speed:
//
//   PER-PIXEL COST: original 96 map evals x (3x fbm 3-oct = 9 noise when
//   displacement is up) + 6-tap normal.  Optimized: bounding-sphere early-out
//   for background pixels, march starts at sphere entry, 56 steps with relaxed
//   stepping, 4-tap normal, displacement fbm at 2 octaves (amplitude-rescaled).
//   Roughly 3-4x faster on surface pixels, ~90x on background pixels.
//
// a = bang envelope 1 (main wobble trigger)
// b = bang envelope 2 (expansion trigger)
// c = bang envelope 3 (texture displacement trigger)
// d = blob smoothness / metaball blend
// e = metallic reflectivity
// f = wobble decay rate
// g = base color hue
// h = environment rotation speed

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

float hash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

vec3 hsv2rgb(float h, float s, float v) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(vec3(h) + K.xyz) * 6.0 - K.www);
    return v * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), s);
}

// ============================================================================
// NOISE
// ============================================================================

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n = i.x + i.y * 57.0 + 113.0 * i.z;
    return mix(
        mix(mix(hash(vec3(n, 0.0, 0.0)), hash(vec3(n + 1.0, 0.0, 0.0)), f.x),
            mix(hash(vec3(n + 57.0, 0.0, 0.0)), hash(vec3(n + 58.0, 0.0, 0.0)), f.x), f.y),
        mix(mix(hash(vec3(n + 113.0, 0.0, 0.0)), hash(vec3(n + 114.0, 0.0, 0.0)), f.x),
            mix(hash(vec3(n + 170.0, 0.0, 0.0)), hash(vec3(n + 171.0, 0.0, 0.0)), f.x), f.y),
        f.z
    );
}

// 2 octaves, amplitude-rescaled to match the old 3-octave fbm range
float fbm(vec3 p) {
    return (0.5 * noise(p) + 0.25 * noise(p * 2.0 + 100.0)) * 1.1667;
}

// ============================================================================
// SDF PRIMITIVES
// ============================================================================

float sdSphere(vec3 p, float r) { return length(p) - r; }

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// ============================================================================
// ENERGY ACCUMULATOR
// ============================================================================

float accumulateEnergy(float bang, float t, float decayRate) {
    float energy = bang;
    float resonance = bang * sin(t * 15.0) * exp(-t * decayRate * 0.5);
    energy += abs(resonance) * 0.3;
    return energy;
}

// ============================================================================
// METALLIC BLOB SDF
// ============================================================================

float mapBlob(vec3 p, float wobbleEnergy, float expandEnergy, float dispEnergy, float smoothness, float t) {
    float d = 1e10;

    float baseSize = 0.5 + expandEnergy * 0.3;

    // Wobble displacement
    vec3 wobble = vec3(0.0);
    if (wobbleEnergy > 0.01) {
        float wobbleFreq = 3.0 + wobbleEnergy * 5.0;
        float wobbleAmp = wobbleEnergy * 0.2;
        wobble.x = sin(p.y * wobbleFreq + t * 8.0) * wobbleAmp;
        wobble.y = sin(p.z * wobbleFreq + t * 7.0) * wobbleAmp;
        wobble.z = sin(p.x * wobbleFreq + t * 9.0) * wobbleAmp;
    }

    // Texture displacement — 3 fbm components at 2 octaves (was 3 octaves)
    vec3 disp = vec3(0.0);
    if (dispEnergy > 0.01) {
        float noiseScale = 2.0 + dispEnergy * 3.0;
        float noiseAmp = dispEnergy * 0.15;
        disp = vec3(
            fbm(p * noiseScale + t * 0.5) - 0.5,
            fbm(p * noiseScale + 100.0 + t * 0.5) - 0.5,
            fbm(p * noiseScale + 200.0 + t * 0.5) - 0.5
        ) * noiseAmp;
    }

    vec3 pDisp = p + wobble + disp;

    // Main center blob
    d = sdSphere(pDisp, baseSize);

    float blobSmooth = mix(0.1, 0.4, smoothness);

    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float angle = fi * TAU / 5.0 + t * 0.5;
        float radius = 0.4 + sin(t * 2.0 + fi) * 0.1;
        radius += expandEnergy * 0.2;

        vec3 blobPos = vec3(
            cos(angle) * radius,
            sin(angle * 0.7 + t) * 0.2,
            sin(angle) * radius
        );

        float blobSize = 0.15 + sin(t * 3.0 + fi * 2.0) * 0.05;
        blobSize += wobbleEnergy * 0.1;

        d = smin(d, sdSphere(pDisp - blobPos, blobSize), blobSmooth);
    }

    float topSize = 0.2 + wobbleEnergy * 0.15;
    d = smin(d, sdSphere(pDisp - vec3(0.0, baseSize * 0.8, 0.0), topSize), blobSmooth);
    d = smin(d, sdSphere(pDisp - vec3(0.0, -baseSize * 0.8, 0.0), topSize), blobSmooth);

    return d;
}

// 4-tap tetrahedron normal (was 6-tap central differences)
vec3 calcNormal(vec3 p, float wobbleEnergy, float expandEnergy, float dispEnergy, float smoothness, float t) {
    const float NE = 0.0015;
    vec2 k = vec2(1.0, -1.0);
    return normalize(
        k.xyy * mapBlob(p + k.xyy * NE, wobbleEnergy, expandEnergy, dispEnergy, smoothness, t) +
        k.yyx * mapBlob(p + k.yyx * NE, wobbleEnergy, expandEnergy, dispEnergy, smoothness, t) +
        k.yxy * mapBlob(p + k.yxy * NE, wobbleEnergy, expandEnergy, dispEnergy, smoothness, t) +
        k.xxx * mapBlob(p + k.xxx * NE, wobbleEnergy, expandEnergy, dispEnergy, smoothness, t));
}

// ============================================================================
// ENVIRONMENT / REFLECTION
// ============================================================================

vec3 envMap(vec3 rd, float t, float hue, float envSpeed) {
    float angle = t * envSpeed;
    float c = cos(angle), s = sin(angle);
    rd.xz = vec2(rd.x * c - rd.z * s, rd.x * s + rd.z * c);

    vec3 col = vec3(0.0);

    float horizon = smoothstep(-0.2, 0.5, rd.y);
    vec3 skyColor = hsv2rgb(hue, 0.3, 0.8);
    vec3 groundColor = hsv2rgb(hue + 0.5, 0.4, 0.1);
    col = mix(groundColor, skyColor, horizon);

    float bands = sin(rd.y * 10.0 + rd.x * 5.0) * 0.5 + 0.5;
    bands = pow(bands, 4.0);
    col += vec3(1.0) * bands * 0.3;

    float light1 = pow(max(dot(rd, normalize(vec3(1.0, 0.5, 0.5))), 0.0), 32.0);
    float light2 = pow(max(dot(rd, normalize(vec3(-0.5, 0.3, -1.0))), 0.0), 16.0);
    col += hsv2rgb(hue + 0.1, 0.5, 1.0) * light1;
    col += hsv2rgb(hue + 0.6, 0.6, 0.8) * light2;

    return col;
}

// ============================================================================
// MAIN
// ============================================================================

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // Parameters (identical to the original)
    float bang1 = a;
    float bang2 = b;
    float bang3 = c;
    float smoothness = d;
    float metallic = mix(0.3, 1.0, e);
    float decayRate = mix(1.0, 8.0, f);
    float hue = g;
    float envSpeed = mix(0.1, 1.0, h);

    float t = iTime;

    float wobbleEnergy = accumulateEnergy(bang1, t, decayRate);
    float expandEnergy = accumulateEnergy(bang2, t, decayRate * 0.7);
    float dispEnergy = accumulateEnergy(bang3, t, decayRate * 0.5);

    float totalEnergy = wobbleEnergy + expandEnergy + dispEnergy;

    // Camera setup
    vec3 ro = vec3(0.0, 0.0, -2.5);
    vec3 rd = normalize(vec3(uv, 1.0));

    // Slight camera shake on high energy
    if (totalEnergy > 0.5) {
        float shake = (totalEnergy - 0.5) * 0.02;
        ro.xy += vec2(sin(t * 50.0), cos(t * 47.0)) * shake;
    }

    vec3 col = vec3(0.0);
    bool hit = false;
    vec3 hitPos;
    float minDist = 1e10;

    // ---- bounding sphere around the whole blob cluster (max extent ~2.0)
    const float R = 2.05;
    vec3 oc = ro;
    float b2 = dot(oc, rd);
    float c2 = dot(oc, oc) - R * R;
    float disc = b2 * b2 - c2;

    if (disc < 0.0) {
        // Ray misses everything: cheap proximity glow
        float dPerp = sqrt(max(dot(oc, oc) - b2 * b2, 0.0));
        minDist = max(dPerp - R, 0.0);
    } else {
        float sq = sqrt(disc);
        float t0 = max(-b2 - sq, 0.0);
        float t1 = -b2 + sq;

        // Raymarch: start at sphere entry, 56 relaxed steps, stop at exit
        float totalDist = t0 + 0.01;

        for (int i = 0; i < 56; i++) {
            vec3 p = ro + rd * totalDist;
            float d = mapBlob(p, wobbleEnergy, expandEnergy, dispEnergy, smoothness, t);

            minDist = min(minDist, d);

            if (d < 0.0015) {
                hit = true;
                hitPos = p;
                break;
            }

            totalDist += d * 0.9;
            if (totalDist > t1 + 0.3) break;
        }
    }

    if (hit) {
        vec3 n = calcNormal(hitPos, wobbleEnergy, expandEnergy, dispEnergy, smoothness, t);

        vec3 v = normalize(ro - hitPos);
        vec3 r = reflect(-v, n);

        float fresnel = pow(1.0 - max(dot(n, v), 0.0), 5.0);
        fresnel = mix(0.04, 1.0, fresnel);

        vec3 baseColor = hsv2rgb(hue, 0.6, 0.3);
        vec3 envColor = envMap(r, t, hue, envSpeed);

        col = mix(baseColor, envColor, metallic * fresnel);

        vec3 lightDir = normalize(vec3(1.0, 1.0, -0.5));
        float spec = pow(max(dot(r, lightDir), 0.0), 64.0);
        col += vec3(1.0) * spec * metallic;

        vec3 lightDir2 = normalize(vec3(-0.5, 0.5, -1.0));
        float spec2 = pow(max(dot(r, lightDir2), 0.0), 32.0);
        col += hsv2rgb(hue + 0.3, 0.5, 1.0) * spec2 * 0.5;

        float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        col += hsv2rgb(hue + 0.5, 0.7, 1.0) * rim * 0.3;

        col += hsv2rgb(hue, 0.8, 1.0) * totalEnergy * 0.2;

    } else {
        // Background with glow from blob proximity
        float glow = exp(-minDist * 3.0);
        col = hsv2rgb(hue, 0.5, 0.05);
        col += hsv2rgb(hue, 0.7, 0.5) * glow * 0.3;
    }

    // Flash on bang
    col += vec3(0.2, 0.25, 0.3) * bang1 * 0.4;
    col += vec3(0.25, 0.2, 0.2) * bang2 * 0.3;
    col += vec3(0.2, 0.2, 0.25) * bang3 * 0.2;

    // Tone mapping
    col = col / (col + 1.0);
    col = pow(col, vec3(0.9));

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}