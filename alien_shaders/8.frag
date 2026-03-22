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
// 8.frag — Flow Field Blob
// ============================================================
// Raymarched displaced sphere with curl noise flow field
// texture on the surface. Vortices, streaks, and velocity-
// driven color zones wrapped around a 3D blob.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Flow intensity — curl noise displacement strength   [0.05 .. 0.5]
//   b = Scale — spatial frequency of flow field             [3 .. 12]
//   c = Turbulence — layers of curl noise                   [1 .. 4]
//   d = Vortex strength — spinning vortex hotspots          [0 .. 2]
//   e = Hue — base color / velocity tint                    [0 .. 0.3]
//   f = Speed — animation rate                              [0.3 .. 2.0]
//   g = Streaks — flow line visibility                      [0 .. 1]
//   h = Zone strength — speed-based color banding           [0 .. 1]
// ============================================================

#define PI 3.14159265359
#define TAU 6.28318530718

float param(float p, float lo, float hi) { return mix(lo, hi, p); }

// --- Hash / Noise ---
float hash1(float n) { return fract(sin(n) * 43758.5453); }
float hash2d(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.13);
    p3 += dot(p3, p3.yzx + 3.333);
    return fract((p3.x + p3.y) * p3.z);
}

float vnoise2d(vec2 p) {
    vec2 i = floor(p); vec2 fr = fract(p);
    fr = fr * fr * (3.0 - 2.0 * fr);
    float va = hash2d(i); float vb = hash2d(i + vec2(1.0, 0.0));
    float vc = hash2d(i + vec2(0.0, 1.0)); float vd = hash2d(i + vec2(1.0, 1.0));
    return mix(mix(va, vb, fr.x), mix(vc, vd, fr.x), fr.y);
}

float vnoise3d(vec3 p) {
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

// --- Curl noise on 2D (for spherical UV) ---
vec2 curlField(vec2 p, float t) {
    float eps = 0.01;
    float n  = vnoise2d(p + t * 0.1);
    float nx = vnoise2d(p + vec2(eps, 0.0) + t * 0.1);
    float ny = vnoise2d(p + vec2(0.0, eps) + t * 0.1);
    return vec2(ny - n, -(nx - n)) / eps;
}

// --- Spherical UV from direction ---
vec2 sphereUV(vec3 dir) {
    float theta = atan(dir.z, dir.x);
    float phi = asin(clamp(dir.y, -1.0, 1.0));
    return vec2(theta / TAU + 0.5, phi / PI + 0.5);
}

// --- Flow field on sphere surface ---
// Returns: x = speed, y = angle, z = activity
vec3 flowOnSphere(vec3 dir, float scale, float flowInt, int turbLayers,
                  float vortexStr, float t) {
    vec2 suv = sphereUV(dir) * scale;

    // Multi-octave curl noise
    vec2 velocity = vec2(0.0);
    float amp = 1.0;
    vec2 pos = suv;
    for (int i = 0; i < 4; i++) {
        if (i >= turbLayers) break;
        velocity += curlField(pos, t * (1.0 + float(i) * 0.3)) * amp;
        pos *= 2.0;
        amp *= 0.5;
    }
    velocity *= flowInt;

    // Vortex hotspots on the sphere
    for (int i = 0; i < 5; i++) {
        vec2 vc = vec2(
            sin(float(i) * 2.1 + t * 0.2) * 0.3 + 0.5,
            cos(float(i) * 1.7 + t * 0.15) * 0.3 + 0.5
        ) * scale;
        vec2 toV = suv - vc;
        float dist = length(toV);
        float vortex = exp(-dist * dist * 2.0);
        float spin = mod(float(i), 2.0) * 2.0 - 1.0;
        velocity += vec2(-toV.y, toV.x) * vortex * vortexStr * spin;
    }

    float spd = length(velocity);
    float angle = atan(velocity.y, velocity.x);
    float activity = 0.3 + spd * 0.7 + vnoise2d(suv + t * 0.5) * 0.3;
    activity = clamp(activity, 0.0, 1.0);

    return vec3(spd, angle, activity);
}

// --- SDF: sphere displaced by flow field ---
float mapSphere(vec3 p, float t, float dispAmt, float scale, float flowInt,
                int turbLayers, float vortexStr) {
    float r = length(p);
    vec3 dir = p / max(r, 0.001);

    vec3 flow = flowOnSphere(dir, scale, flowInt, turbLayers, vortexStr, t);
    float spd = flow.x;

    // Displacement from flow speed — fast regions bulge out
    float disp = spd * dispAmt * 0.25;

    // Low-freq shape variation
    disp += vnoise3d(dir * 2.5 + t * 0.15) * dispAmt * 0.2;

    return r - 0.82 - disp;
}

vec3 calcNormal(vec3 p, float t, float dispAmt, float scale, float flowInt,
                int turbLayers, float vortexStr) {
    vec2 ep = vec2(0.003, 0.0);
    return normalize(vec3(
        mapSphere(p + ep.xyy, t, dispAmt, scale, flowInt, turbLayers, vortexStr) -
        mapSphere(p - ep.xyy, t, dispAmt, scale, flowInt, turbLayers, vortexStr),
        mapSphere(p + ep.yxy, t, dispAmt, scale, flowInt, turbLayers, vortexStr) -
        mapSphere(p - ep.yxy, t, dispAmt, scale, flowInt, turbLayers, vortexStr),
        mapSphere(p + ep.yyx, t, dispAmt, scale, flowInt, turbLayers, vortexStr) -
        mapSphere(p - ep.yyx, t, dispAmt, scale, flowInt, turbLayers, vortexStr)
    ));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // --- Params ---
    float dispAmt    = param(a, 0.05, 0.5);
    float scale      = param(b, 3.0, 12.0);
    int turbLayers   = int(param(c, 1.0, 4.0));
    float vortexStr  = param(d, 0.0, 2.0);
    float velColor   = param(e, 0.0, 0.3);
    float speed      = param(f, 0.3, 2.0);
    float streaks    = g;
    float zoneStr    = h;

    float flowInt = dispAmt * 5.0; // flow visual intensity linked to displacement
    float t = iTime * speed;

    // --- Camera: orbit ---
    float camAngle = t * 0.22;
    vec3 ro = vec3(sin(camAngle) * 2.7, 0.35 * sin(t * 0.14), cos(camAngle) * 2.7);
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
        float dist = mapSphere(hitPos, t, dispAmt, scale, flowInt, turbLayers, vortexStr);
        if (dist < 0.001) { hit = true; break; }
        if (totalDist > 10.0) break;
        totalDist += dist * 0.6;
    }

    vec3 col = vec3(0.0);

    if (hit) {
        vec3 n = calcNormal(hitPos, t, dispAmt, scale, flowInt, turbLayers, vortexStr);
        vec3 surfDir = normalize(hitPos);
        vec3 viewDir = normalize(ro - hitPos);

        // Flow field at surface
        vec3 flow = flowOnSphere(surfDir, scale, flowInt, turbLayers, vortexStr, t);
        float spd = flow.x;
        float angle = flow.y;
        float activity = flow.z;

        // --- Speed-based color zones ---
        float baseHue;
        if (spd < 0.15) baseHue = 0.6;       // slow = blue
        else if (spd < 0.4) baseHue = 0.35;   // medium = green
        else if (spd < 0.8) baseHue = 0.15;   // fast = orange
        else baseHue = 0.0;                    // very fast = red

        float genome = vnoise2d(sphereUV(surfDir) * 3.0 + t * 0.05);
        float hue = mix(genome, baseHue, zoneStr);
        hue += (angle / PI) * 0.1 * velColor;

        float sat = 0.6 + 0.3 * activity;
        float val = 0.15 + 0.75 * activity;

        vec3 surfCol = hsv2rgb(vec3(fract(hue), sat, val));

        // Velocity direction tint
        vec3 velVis = vec3(
            cos(angle) * 0.5 + 0.5,
            sin(angle) * 0.5 + 0.5,
            cos(angle + 2.094) * 0.5 + 0.5
        );
        surfCol = mix(surfCol, velVis, spd * 0.15 * velColor);

        // --- Streaks: flow lines along velocity ---
        if (spd > 0.3) {
            float streak = sin(angle * 8.0 + spd * 20.0 - t * 5.0) * 0.5 + 0.5;
            surfCol += vec3(streak * 0.2 * streaks * spd);
        }

        // --- Lighting ---
        vec3 light1 = normalize(vec3(1.0, 2.0, 1.5));
        vec3 light2 = normalize(vec3(-1.0, 0.5, -0.5));
        float diff = max(dot(n, light1), 0.0) * 0.6 + max(dot(n, light2), 0.0) * 0.2 + 0.15;

        // Specular
        vec3 refl = reflect(rayDir, n);
        float spec = pow(max(dot(refl, light1), 0.0), 24.0);

        // Fresnel
        float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);

        // Compose
        col = surfCol * diff;
        col += vec3(1.0, 0.95, 0.9) * spec * 0.3;
        col += hsv2rgb(vec3(baseHue + 0.2, 0.4, 0.5)) * fresnel * 0.3;

        // Active regions glow
        col = mix(vec3(0.01, 0.015, 0.02), col, smoothstep(0.0, 0.2, activity));

        // Depth fade
        col *= exp(-totalDist * 0.1);

    } else {
        float bgGlow = exp(-length(uv) * 2.5) * 0.03;
        col = vec3(bgGlow * 0.5, bgGlow * 0.6, bgGlow * 0.8);
    }


    // Tone map
    col = col / (col + 0.5);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
