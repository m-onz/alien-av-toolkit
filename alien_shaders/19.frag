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
// 19.frag — Glitch Helix (variation on 18 Glitch Tubes)
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Glitch intensity — corruption amount
//   b = Helix count — number of spiraling strands
//   c = Helix tightness — how tight the spiral winds
//   d = Tube radius — thickness of helix strands
//   e = Speed — rotation and travel speed
//   f = Chromatic — chromatic aberration strength
//   g = Scan density — scan line frequency
//   h = Bit crush — color quantization depth
// ============================================================

#define TAU 6.28318530
#define PI 3.14159265

float hash_f(float nn) { return fract(sin(nn) * 43758.5453); }
float hash2_f(vec2 pp) { return fract(sin(dot(pp, vec2(127.1, 311.7))) * 43758.5453); }

// Helix strand distance - tube spiraling around Y axis
float helixDist(vec2 uv, float idx, float numStrands, float tightness, float radius, float tt) {
    float phase = idx / numStrands * TAU;
    float yFreq = tightness;

    // Strand oscillates in X based on Y position
    float helixX = sin(uv.y * yFreq + tt + phase) * 0.4;
    float helixSpread = cos(uv.y * yFreq + tt + phase);

    // Depth fade based on which side of helix
    float depthFade = helixSpread * 0.3 + 0.7;

    float dd = abs(uv.x - helixX) - radius;
    return dd;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float tt = iTime;

    float glitch     = 0.1 + a * 0.9;
    int numStrands   = 2 + int(b * 8.0);
    float tightness  = 3.0 + c * 15.0;
    float tubeRadius = 0.01 + d * 0.06;
    float speed      = 0.5 + e * 2.0;
    float chromaAmt  = f * 0.04;
    float scanDensity = 1.0 + g * 4.0;
    float bitDepth   = 16.0 - h * 12.0;

    // Glitch time
    float glitchTime = floor(tt * 5.0);

    // Vertical glitch displacement (vs horizontal in 18)
    float colGlitch = hash_f(floor(uv.x * 20.0) + glitchTime);
    vec2 glitchUV = uv;
    glitchUV.y += (colGlitch - 0.5) * 0.12 * glitch * step(0.82, colGlitch);

    // Diagonal block glitch
    vec2 blockUV = floor((glitchUV + vec2(glitchUV.y * 0.5, 0.0)) * 8.0);
    float blockTrigger = step(0.9 - glitch * 0.1, hash2_f(blockUV + vec2(glitchTime)));
    glitchUV += vec2(hash2_f(blockUV) - 0.5, hash2_f(blockUV + vec2(1.0)) - 0.5) * 0.06 * blockTrigger;

    vec3 col = vec3(0.01);

    // Render helix strands
    float numF = float(numStrands);
    for (int ii = 0; ii < 10; ii++) {
        if (ii >= numStrands) break;
        float idx = float(ii);

        float dd = helixDist(glitchUV, idx, numF, tightness, tubeRadius, tt * speed);

        // Glow
        float glow = 0.012 / (abs(dd) + 0.008);

        // Strand phase for depth sorting
        float phase = idx / numF * TAU;
        float depthVal = cos(glitchUV.y * tightness + tt * speed + phase);
        float depthFade = depthVal * 0.3 + 0.7;

        // Strand color - cycle hue along length
        float hue = idx / numF + glitchUV.y * 0.1 + tt * 0.05;
        vec3 strandCol = 0.5 + 0.5 * cos(TAU * (hue + vec3(0.0, 0.33, 0.67)));

        // Pulse along strand
        float pulse = sin(tt * speed * 2.5 + glitchUV.y * 4.0 + idx * 1.5) * 0.3 + 0.7;
        strandCol *= pulse * depthFade;

        col += strandCol * glow * 0.12;

        // Core
        float core = smoothstep(tubeRadius * 0.4, 0.0, abs(dd));
        col += strandCol * core * depthFade * 0.7;
    }

    // Chromatic aberration - vertical shift (vs horizontal in 18)
    col.r += hash2_f(glitchUV * 40.0 + vec2(0.0, chromaAmt)) * glitch * 0.12;
    col.b += hash2_f(glitchUV * 40.0 - vec2(0.0, chromaAmt)) * glitch * 0.12;

    // Diagonal scan lines (vs horizontal in 18)
    float scanAngle = glitchUV.x + glitchUV.y;
    float scanLine = sin(scanAngle * iResolution.y * scanDensity * 0.5) * 0.5 + 0.5;
    col *= 0.85 + scanLine * 0.15;

    // Interlace flicker
    float interlace = mod(fragCoord.y + tt * 30.0, 3.0);
    col *= 0.9 + 0.1 * step(1.0, interlace);

    // Block color rotation (rgb shift vs swap in 18)
    col = mix(col, col.brg, blockTrigger * 0.6);

    // Noise grain
    float grain = hash2_f(fragCoord.xy + vec2(tt * 60.0));
    col += (grain - 0.5) * 0.05;

    // Flicker
    float flicker = 0.93 + 0.07 * sin(tt * 30.0 + hash_f(glitchTime) * 50.0);
    col *= flicker;


    // Bit crush
    float bc = max(bitDepth, 2.0);
    col = floor(col * bc) / bc;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
