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
// 56.frag — Glitch Terrain Flyover (B&W)
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Terrain roughness — FBM detail
//   b = Height scale — mountain height
//   c = Camera height — viewing altitude
//   d = Speed — flyover speed
//   e = Fog density — atmospheric haze
//   f = Glitch — terrain vertex corruption
//   g = Grid overlay — wireframe visibility
//   h = Brightness
// ============================================================

#define PI 3.14159265359

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash_f(float n) { return fract(sin(n) * 43758.5453); }
float hash2_f(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2_f(i), hash2_f(i + vec2(1.0, 0.0)), f.x),
               mix(hash2_f(i + vec2(0.0, 1.0)), hash2_f(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p, int octaves) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        v += amp * vnoise(p);
        p *= 2.0;
        amp *= 0.5;
    }
    return v;
}

float terrain(vec2 p, float roughness, float heightScale, float glitchAmt, float gt) {
    int oct = 2 + int(roughness * 4.0);
    float h2 = fbm(p, oct) * heightScale;
    // Glitch: quantized displacement
    float trigger = step(0.7, hash_f(floor(p.x * 3.0) * 7.1 + floor(p.y * 3.0) * 13.3 + gt));
    h2 += trigger * glitchAmt * 0.3 * (hash_f(floor(p.x * 3.0) + gt * 2.0) - 0.5);
    return h2;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float roughness  = a;
    float heightScale= param(b, 0.3, 1.5);
    float camHeight  = param(c, 0.5, 2.0);
    float speed      = param(d, 0.3, 2.0);
    float fogDens    = param(e, 0.1, 0.5);
    float glitchAmt  = param(f, 0.0, 1.5);
    float gridViz    = g;
    float bright     = param(h, 0.5, 2.0);

    float t = iTime * speed;
    float gt = floor(t * 6.0);

    // Camera
    vec3 ro = vec3(0.0, camHeight, t);
    vec3 rd = normalize(vec3(uv.x, uv.y - 0.1, 0.8));

    // Raymarch terrain
    float totalDist = 0.0;
    float bw = 0.0;
    bool hit = false;
    vec3 hitPos = vec3(0.0);

    for (int i = 0; i < 40; i++) {
        vec3 p = ro + rd * totalDist;
        float h2 = terrain(p.xz, roughness, heightScale, glitchAmt, gt);
        float dd = p.y - h2;
        if (dd < 0.01) {
            hit = true;
            hitPos = p;
            break;
        }
        totalDist += dd * 0.5 + 0.02;
        if (totalDist > 20.0) break;
    }

    if (hit) {
        // Normal via finite differences
        float ep = 0.05;
        float hC = terrain(hitPos.xz, roughness, heightScale, glitchAmt, gt);
        float hR = terrain(hitPos.xz + vec2(ep, 0.0), roughness, heightScale, glitchAmt, gt);
        float hU = terrain(hitPos.xz + vec2(0.0, ep), roughness, heightScale, glitchAmt, gt);
        vec3 nor = normalize(vec3(hC - hR, ep, hC - hU));

        vec3 lightDir = normalize(vec3(0.3, 0.8, 0.5));
        float diff = max(dot(nor, lightDir), 0.0);
        float spec = pow(max(dot(reflect(-lightDir, nor), -rd), 0.0), 16.0);

        bw = 0.2 + 0.6 * diff + 0.3 * spec;

        // Grid overlay
        vec2 gridP = fract(hitPos.xz * 2.0);
        float grid = smoothstep(0.05, 0.0, min(gridP.x, gridP.y));
        grid += smoothstep(0.05, 0.0, min(1.0 - gridP.x, 1.0 - gridP.y));
        bw += grid * gridViz * 0.3;

        // Fog
        float fog = exp(-totalDist * fogDens);
        bw *= fog;
    } else {
        bw = 0.02;
    }

    // Scan lines
    float scanLine = sin(fragCoord.y * 2.0) * 0.5 + 0.5;
    bw *= 0.88 + scanLine * 0.12;

    // Glitch horizontal tear
    float tearY = hash_f(gt * 7.3) * 2.0 - 1.0;
    float inTear = smoothstep(0.08, 0.0, abs(uv.y - tearY)) * glitchAmt;
    bw += inTear * 0.15;

    // Block glitch
    vec2 blockUV = floor(uv * 10.0);
    float blockTrigger = step(0.92 - glitchAmt * 0.1, hash2_f(blockUV + vec2(gt)));
    bw *= 1.0 + blockTrigger * 0.4;

    // Grain
    float grain = hash2_f(fragCoord.xy + vec2(t * 100.0)) * 0.08;
    bw += grain * glitchAmt * 0.5;

    // Flicker
    float flicker = 0.93 + 0.07 * sin(t * 25.0 + hash_f(gt) * 50.0);
    bw *= flicker;

    bw *= bright;
    bw = bw / (1.0 + bw * 0.5);
    fragColor = vec4(vec3(clamp(bw, 0.0, 1.0)), 1.0);
}
