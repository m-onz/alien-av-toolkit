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
// 6.frag — Reaction-Diffusion Blob
// ============================================================
// Raymarched displaced sphere with reaction-diffusion surface
// pattern. Constrained color palette around a single hue.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Displacement — how much the RD pattern deforms surface [0.02 .. 0.5]
//   b = Pattern scale — spatial frequency of RD on sphere      [3 .. 15]
//   c = Complexity — pattern density / kill rate               [0.3 .. 1.0]
//   d = Warp — domain warping of the surface pattern           [0 .. 1.5]
//   e = Hue — base color (narrow palette, not rainbow)
//   f = Speed — animation rate                                 [0.2 .. 2.0]
//   g = Glow — emission from active pattern regions            [0 .. 1.5]
//   h = Roughness — specular sharpness                         [0.05 .. 0.8]
// ============================================================

#define PI 3.14159265359
#define TAU 6.28318530718

float param(float p, float lo, float hi) { return mix(lo, hi, p); }


// --- HSV ---
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// --- Fake RD pattern — sin-based, no noise lookups ---
float rdPattern(vec3 dir, float scale, float complexity, float warp, float t) {
    vec3 p = dir * scale;

    // Sin-based domain warp
    p += vec3(
        sin(p.y * 1.5 + p.z * 0.8 + t * 0.1),
        sin(p.z * 1.3 + p.x * 0.9 + t * 0.08),
        sin(p.x * 1.1 + p.y * 0.7 + t * 0.12)
    ) * warp;

    // Activator: layered sin waves
    float activator = sin(p.x + t * 0.15) * 0.3
                    + sin(p.y * 1.3 + p.x * 0.5 + t * 0.2) * 0.25
                    + sin((p.x + p.y + p.z) * 0.8 * complexity + t * 0.1) * 0.2
                    + sin(p.z * 1.7 + p.y * 0.4 + t * 0.25) * 0.15;

    // Inhibitor: offset waves
    float inhibitor = sin(p.x * 1.8 - t * 0.1 + 30.0) * 0.3
                    + sin(p.y * 2.0 + p.z * 0.7 - t * 0.15 + 30.0) * 0.25
                    + sin((p.z - p.x) * 1.5 * complexity + t * 0.08 + 30.0) * 0.2;

    float rd = activator - inhibitor * 0.7;
    rd = smoothstep(0.05, 0.25, rd);

    // Fine detail
    rd += sin(dir.x * scale * 3.0 + t * 0.2) * sin(dir.y * scale * 2.5 + t * 0.15) * 0.2 * complexity;

    return clamp(rd, 0.0, 1.0);
}

// --- SDF: sphere displaced by RD pattern ---
float mapSphere(vec3 p, float t, float dispAmt, float scale, float complexity, float warp) {
    float r = length(p);
    vec3 dir = p / max(r, 0.001);

    float rd = rdPattern(dir, scale, complexity, warp, t);
    float disp = rd * dispAmt;

    // Sin-based wobble
    disp += (sin(dir.x * 2.0 + dir.z * 1.5 + t * 0.3) * 0.5 + 0.5) * dispAmt * 0.2;

    return r - 0.85 - disp;
}

vec3 calcNormal(vec3 p, float t, float dispAmt, float scale, float complexity, float warp) {
    float ep = 0.005;
    vec3 n = vec3(0.0);
    vec3 k;
    k = vec3( 1,-1,-1); n += k * mapSphere(p + k * ep, t, dispAmt, scale, complexity, warp);
    k = vec3(-1,-1, 1); n += k * mapSphere(p + k * ep, t, dispAmt, scale, complexity, warp);
    k = vec3(-1, 1,-1); n += k * mapSphere(p + k * ep, t, dispAmt, scale, complexity, warp);
    k = vec3( 1, 1, 1); n += k * mapSphere(p + k * ep, t, dispAmt, scale, complexity, warp);
    return normalize(n);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // --- Params ---
    float dispAmt    = param(a, 0.02, 0.5);
    float scale      = param(b, 3.0, 15.0);
    float complexity = param(c, 0.3, 1.0);
    float warp       = param(d, 0.0, 1.5);
    float hueBase    = e;
    float speed      = param(f, 0.2, 2.0);
    float glow       = param(g, 0.0, 1.5);
    float roughness  = param(h, 0.05, 0.8);

    float t = iTime * speed;

    // --- Camera: slow orbit ---
    float camAngle = t * 0.2;
    vec3 ro = vec3(sin(camAngle) * 2.6, 0.3 * sin(t * 0.13), cos(camAngle) * 2.6);
    vec3 ta = vec3(0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.5 * ww);

    // --- Raymarch ---
    float totalDist = 0.0;
    bool hit = false;
    vec3 hitPos;

    for (int i = 0; i < 50; i++) {
        hitPos = ro + rd * totalDist;
        float dist = mapSphere(hitPos, t, dispAmt, scale, complexity, warp);
        if (dist < 0.004) { hit = true; break; }
        if (totalDist > 6.0) break;
        totalDist += dist * 0.8;
    }

    vec3 col = vec3(0.0);

    if (hit) {
        vec3 n = calcNormal(hitPos, t, dispAmt, scale, complexity, warp);
        vec3 surfDir = normalize(hitPos);

        // RD pattern value at hit point for coloring
        float rdVal = rdPattern(surfDir, scale, complexity, warp, t);

        // --- Constrained palette: 3 shades around base hue ---
        vec3 colDeep  = hsv2rgb(vec3(hueBase + 0.02, 0.7, 0.08));  // dark crevices
        vec3 colMid   = hsv2rgb(vec3(hueBase, 0.6, 0.45));          // mid tone
        vec3 colBright = hsv2rgb(vec3(hueBase - 0.03, 0.5, 0.9));   // raised bumps

        // Map RD pattern to color gradient
        vec3 surfCol = mix(colDeep, colMid, smoothstep(0.0, 0.4, rdVal));
        surfCol = mix(surfCol, colBright, smoothstep(0.4, 0.9, rdVal));

        // --- Lighting ---
        vec3 light1 = vec3(0.37, 0.74, 0.56);
        float diff = max(dot(n, light1), 0.0) * 0.75 + 0.15;

        // Specular
        vec3 refl = reflect(rd, n);
        float specPow = 8.0 + (1.0 - roughness) * 40.0;
        float spec = pow(max(dot(refl, light1), 0.0), specPow);

        // Fresnel
        float fresnel = pow(1.0 - max(dot(-rd, n), 0.0), 3.0);

        // Compose
        col = surfCol * diff;
        col += vec3(1.0, 0.95, 0.9) * spec * (1.0 - roughness) * 0.4;
        col += hsv2rgb(vec3(hueBase + 0.15, 0.4, 0.6)) * fresnel * 0.3;

        // Emission glow from active RD regions
        col += colBright * rdVal * rdVal * glow * 0.5;

        // Subsurface-like scattering: light bleeds through thin raised areas
        float sss = smoothstep(0.5, 1.0, rdVal) * max(dot(-n, light1), 0.0);
        col += hsv2rgb(vec3(hueBase + 0.08, 0.5, 0.7)) * sss * 0.15;

        // Depth fade
        float fog = exp(-totalDist * 0.12);
        col *= fog;

    } else {
        // Background: subtle ambient
        float bgGlow = exp(-length(uv) * 2.5) * 0.04;
        col = hsv2rgb(vec3(hueBase, 0.3, bgGlow));
    }


    // Tone map
    col = col / (col + 0.5);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
