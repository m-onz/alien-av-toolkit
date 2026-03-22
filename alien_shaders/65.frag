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
// 65.frag — Glitch Star Field (B&W)
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Star density — number of visible stars
//   b = Nebula intensity — background gas clouds
//   c = Warp speed — hyperspace travel effect
//   d = Twinkle rate — star flicker frequency
//   e = Streak length — motion blur / star trails
//   f = Glitch — digital corruption
//   g = Depth layers — parallax layer count
//   h = Brightness
// ============================================================

#define PI 3.14159265359

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash_f(float n) { return fract(sin(n) * 43758.5453); }
float hash2_f(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 ff = fract(p);
    ff = ff * ff * (3.0 - 2.0 * ff);
    return mix(mix(hash2_f(i), hash2_f(i + vec2(1.0, 0.0)), ff.x),
               mix(hash2_f(i + vec2(0.0, 1.0)), hash2_f(i + vec2(1.0, 1.0)), ff.x), ff.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float starDens  = param(a, 0.3, 0.9);
    float nebulaInt = param(b, 0.0, 1.0);
    float warpSpd   = param(c, 0.0, 3.0);
    float twinkle   = param(d, 1.0, 8.0);
    float streakLen = param(e, 0.0, 0.5);
    float glitchAmt = param(f, 0.0, 1.5);
    int numLayers   = 2 + int(g * 4.0);
    float bright    = param(h, 0.5, 2.0);

    float t = iTime;
    float gt = floor(t * 6.0);

    // Glitch UV
    float lineGlitch = hash_f(floor(uv.y * 20.0) + gt);
    uv.x += (lineGlitch - 0.5) * 0.08 * glitchAmt * step(0.83, lineGlitch);

    // Warp zoom effect
    vec2 warpUV = uv;
    float warpPhase = t * warpSpd;
    warpUV *= 1.0 + sin(warpPhase) * 0.1 * warpSpd;

    float bw = 0.0;

    // Multi-layer parallax star field
    for (int layer = 0; layer < 6; layer++) {
        if (layer >= numLayers) break;
        float fl = float(layer);
        float depth = 1.0 + fl * 0.8;
        float layerScale = 15.0 + fl * 10.0;

        vec2 lp = warpUV * layerScale + vec2(t * 0.1 * depth, fl * 50.0);

        // Star streak direction (radial from center for warp effect)
        vec2 streakDir = normalize(warpUV + 0.001) * streakLen / depth;

        vec2 cell = floor(lp);
        vec2 cellF = fract(lp);

        // Check this cell and neighbors for stars
        for (int dx = -1; dx <= 1; dx++) {
            for (int dy = -1; dy <= 1; dy++) {
                vec2 neighbor = cell + vec2(float(dx), float(dy));
                float starProb = hash2_f(neighbor + vec2(fl * 100.0));

                float isVisible = step(1.0 - starDens * 0.3, starProb);

                vec2 starPos = vec2(
                    hash2_f(neighbor * 1.1 + vec2(fl * 7.0, 0.0)),
                    hash2_f(neighbor * 1.3 + vec2(0.0, fl * 11.0))
                );

                vec2 diff = cellF - starPos - vec2(float(dx), float(dy));

                // Streak
                float streakD = length(diff - streakDir * clamp(dot(diff, streakDir) / (dot(streakDir, streakDir) + 0.0001), 0.0, 1.0));
                float pointD = length(diff);
                float starD = mix(pointD, streakD, min(streakLen * 3.0, 1.0));

                float starSize = (0.05 + hash2_f(neighbor + 30.0) * 0.1) / depth;
                float star = smoothstep(starSize, 0.0, starD);

                // Twinkle
                float twinklePhase = hash2_f(neighbor + 50.0) * 100.0 + t * twinkle;
                star *= 0.5 + 0.5 * sin(twinklePhase);

                // Glitch: some stars randomly vanish
                float starGlitch = 1.0 - glitchAmt * 0.3 * step(0.8, hash_f(dot(neighbor, vec2(7.1, 13.3)) + gt));

                bw += star * isVisible * starGlitch / depth;
            }
        }
    }

    // Nebula: domain warped noise for gas clouds
    vec2 nebP = warpUV * 3.0;
    float nw1 = vnoise(nebP * 0.5 + t * 0.05) * 2.0 - 1.0;
    float nw2 = vnoise(nebP * 0.5 + vec2(50.0) + t * 0.03) * 2.0 - 1.0;
    nebP += vec2(nw1, nw2) * 1.5;
    float nebula = vnoise(nebP) * vnoise(nebP * 2.0 + 10.0);
    nebula = smoothstep(0.1, 0.5, nebula) * nebulaInt * 0.3;
    bw += nebula;

    // Scan lines
    float scanLine = sin(fragCoord.y * 2.0) * 0.5 + 0.5;
    bw *= 0.88 + scanLine * 0.12;

    // Block glitch
    vec2 blockUV = floor(uv * 8.0);
    float blockTrigger = step(0.92 - glitchAmt * 0.1, hash2_f(blockUV + vec2(gt)));
    bw *= 1.0 + blockTrigger * 0.4;

    // Grain
    float grain = hash2_f(fragCoord.xy + vec2(t * 100.0));
    bw += (grain - 0.5) * 0.04 * (0.3 + glitchAmt * 0.7);

    // Flicker
    float flicker = 0.93 + 0.07 * sin(t * 25.0 + hash_f(gt) * 50.0);
    bw *= flicker;

    bw *= bright;
    bw = bw / (1.0 + bw * 0.5);
    fragColor = vec4(vec3(clamp(bw, 0.0, 1.0)), 1.0);
}
