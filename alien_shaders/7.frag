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
// 7.frag — Plasma Metal Blob
// ============================================================
// Raymarched displaced sphere with chaotic plasma/metallic
// surface that warps and folds into strange attractors.
// Iridescent oil-slick sheen over turbulent molten metal.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Displacement — surface chaos intensity              [0.05 .. 0.7]
//   b = Fold density — frequency of plasma folds            [2 .. 12]
//   c = Chaos — feedback warp iterations / strangeness      [0 .. 1]
//   d = Metallic — blend from plasma to chrome              [0 .. 1]
//   e = Hue — base color shift
//   f = Speed — animation rate                              [0.2 .. 2.5]
//   g = Iridescence — oil-slick rainbow sheen intensity     [0 .. 1]
//   h = Glitch — surface tearing / discontinuities          [0 .. 1]
// ============================================================

#define PI 3.14159265359
#define TAU 6.28318530718

float param(float p, float lo, float hi) { return mix(lo, hi, p); }

// --- Hash ---
float hash1(float n) { return fract(sin(n) * 43758.5453); }

// --- Value noise 3D ---
float vnoise(vec3 p) {
    vec3 i = floor(p), fr = fract(p);
    fr = fr * fr * (3.0 - 2.0 * fr);
    float n = dot(i, vec3(1.0, 57.0, 113.0));
    return mix(mix(mix(hash1(n), hash1(n + 1.0), fr.x),
                   mix(hash1(n + 57.0), hash1(n + 58.0), fr.x), fr.y),
               mix(mix(hash1(n + 113.0), hash1(n + 114.0), fr.x),
                   mix(hash1(n + 170.0), hash1(n + 171.0), fr.x), fr.y), fr.z);
}

// --- HSV ---
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// --- Chaotic plasma field ---
// Iterated sin folds with feedback — gets increasingly strange
float plasmaField(vec3 p, float foldDens, float chaos, float t) {
    float v = 0.0;
    vec3 q = p * foldDens;

    // Iterative folding — each pass feeds back into the next
    for (int i = 0; i < 6; i++) {
        q = abs(q) / dot(q, q) - 1.0; // inversion fold (like fractal flames)
        q.xy = q.xy * cos(t * 0.3 + float(i)) + q.yx * vec2(1.0, -1.0) * sin(t * 0.3 + float(i));
        q += vec3(sin(t * 0.17 + float(i) * 1.3),
                  cos(t * 0.13 + float(i) * 0.7),
                  sin(t * 0.11 + float(i) * 2.1)) * chaos;
        v += length(q) * 0.15;
    }
    return v;
}

// --- Glitch tears ---
float glitchTear(vec3 dir, float t, float intensity) {
    // Axis-aligned slicing that jumps
    float slice = floor(dir.y * 8.0 + sin(t * 5.0) * 3.0);
    float tear = step(0.7, fract(sin(slice * 91.7 + t * 2.3) * 43758.5));
    float offset = (fract(sin(slice * 47.3 + t) * 9837.5) - 0.5) * 2.0;
    return tear * offset * intensity;
}

// --- SDF ---
float mapSphere(vec3 p, float t, float dispAmt, float foldDens, float chaos,
                float glitch) {
    float r = length(p);
    vec3 dir = p / max(r, 0.001);

    // Plasma displacement
    float plasma = plasmaField(dir, foldDens, chaos, t);
    float disp = plasma * dispAmt * 0.3;

    // Glitch offset
    disp += glitchTear(dir, t, glitch) * dispAmt * 0.15;

    // Turbulent low-freq shape
    float turb = sin(dir.x * 3.0 + t) * sin(dir.y * 2.7 - t * 0.8) * sin(dir.z * 3.3 + t * 0.6);
    disp += turb * dispAmt * 0.12;

    return r - 0.8 - disp;
}

vec3 calcNormal(vec3 p, float t, float dispAmt, float foldDens, float chaos,
                float glitch) {
    vec2 ep = vec2(0.003, 0.0);
    return normalize(vec3(
        mapSphere(p + ep.xyy, t, dispAmt, foldDens, chaos, glitch) -
        mapSphere(p - ep.xyy, t, dispAmt, foldDens, chaos, glitch),
        mapSphere(p + ep.yxy, t, dispAmt, foldDens, chaos, glitch) -
        mapSphere(p - ep.yxy, t, dispAmt, foldDens, chaos, glitch),
        mapSphere(p + ep.yyx, t, dispAmt, foldDens, chaos, glitch) -
        mapSphere(p - ep.yyx, t, dispAmt, foldDens, chaos, glitch)
    ));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // --- Params ---
    float dispAmt    = param(a, 0.05, 0.7);
    float foldDens   = param(b, 2.0, 12.0);
    float chaos      = c;
    float metallic   = d;
    float hueBase    = e;
    float speed      = param(f, 0.2, 2.5);
    float iridAmt    = g;
    float glitch     = h;

    float t = iTime * speed;

    // --- Camera: orbit ---
    float camAngle = t * 0.2;
    vec3 ro = vec3(sin(camAngle) * 2.8, 0.3 * sin(t * 0.15), cos(camAngle) * 2.8);
    vec3 ta = vec3(0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rayDir = normalize(uv.x * uu + uv.y * vv + 1.5 * ww);

    // --- Raymarch ---
    float totalDist = 0.0;
    bool hit = false;
    vec3 hitPos;

    for (int i = 0; i < 80; i++) {
        hitPos = ro + rayDir * totalDist;
        float dist = mapSphere(hitPos, t, dispAmt, foldDens, chaos, glitch);
        if (dist < 0.001) { hit = true; break; }
        if (totalDist > 10.0) break;
        totalDist += dist * 0.5;
    }

    vec3 col = vec3(0.0);

    if (hit) {
        vec3 n = calcNormal(hitPos, t, dispAmt, foldDens, chaos, glitch);
        vec3 surfDir = normalize(hitPos);
        vec3 viewDir = normalize(ro - hitPos);

        // Plasma value at surface
        float plasma = plasmaField(surfDir, foldDens, chaos, t);

        // --- Metallic base color ---
        // Folded plasma drives color bands
        float colorPhase = fract(plasma * 0.5 + hueBase);
        vec3 hotCol = hsv2rgb(vec3(hueBase, 0.7, 0.9));
        vec3 coldCol = hsv2rgb(vec3(hueBase + 0.06, 0.5, 0.25));
        vec3 baseCol = mix(coldCol, hotCol, smoothstep(0.3, 0.7, fract(plasma * 1.5)));

        // Chrome: high metallic blends toward environment reflection color
        vec3 refl = reflect(rayDir, n);
        float envNoise = vnoise(refl * 3.0 + t * 0.2);
        vec3 envCol = hsv2rgb(vec3(hueBase + envNoise * 0.15, 0.3, 0.6 + envNoise * 0.3));
        baseCol = mix(baseCol, envCol, metallic * 0.6);

        // --- Iridescence: oil-slick sheen ---
        float iridAngle = dot(n, viewDir);
        vec3 iridCol = 0.5 + 0.5 * cos(TAU * (iridAngle * 3.0 + vec3(0.0, 0.33, 0.67) + t * 0.08));
        baseCol = mix(baseCol, iridCol, iridAmt * 0.5);

        // --- Lighting ---
        vec3 light1 = normalize(vec3(1.0, 1.5, 1.0));
        vec3 light2 = normalize(vec3(-0.8, 0.3, -0.6));
        float diff = max(dot(n, light1), 0.0) * 0.6 + max(dot(n, light2), 0.0) * 0.2 + 0.15;

        // Specular: sharp for metallic
        float specPow = mix(16.0, 80.0, metallic);
        float spec1 = pow(max(dot(refl, light1), 0.0), specPow);
        float spec2 = pow(max(dot(refl, light2), 0.0), specPow * 0.5) * 0.4;

        // Fresnel
        float fresnel = pow(1.0 - max(iridAngle, 0.0), 3.0 + metallic * 2.0);

        // Compose
        col = baseCol * diff;

        // Metallic spec reflects base color, dielectric reflects white
        vec3 specCol = mix(vec3(1.0), baseCol, metallic * 0.7);
        col += specCol * (spec1 + spec2) * 0.5;

        // Fresnel rim with iridescence
        col += mix(hsv2rgb(vec3(hueBase + 0.2, 0.5, 0.6)), iridCol, iridAmt) * fresnel * 0.4;

        // Plasma emission: bright hot spots where plasma peaks
        float emitMask = smoothstep(0.6, 0.9, fract(plasma * 2.0));
        vec3 emitCol = hsv2rgb(vec3(hueBase - 0.05, 0.9, 1.0));
        col += emitCol * emitMask * (1.0 - metallic) * 0.35;

        // Glitch bands: horizontal color tears
        float tearMask = abs(glitchTear(surfDir, t, glitch));
        col = mix(col, emitCol * 1.2, tearMask * 0.5);

        // Depth fade
        col *= exp(-totalDist * 0.1);

    } else {
        // Background: plasma wisps
        float bgPlasma = plasmaField(rayDir * 0.5, foldDens * 0.3, chaos * 0.5, t);
        float bgGlow = exp(-length(uv) * 2.0) * 0.06;
        bgGlow += smoothstep(0.4, 0.8, fract(bgPlasma)) * 0.02;
        col = hsv2rgb(vec3(hueBase, 0.4, bgGlow));
    }


    // Tone map
    col = col / (col + 0.5);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
