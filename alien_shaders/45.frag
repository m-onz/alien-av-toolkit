// Shader 45: Prism Spectral (ported from prism-spectral.html)
// Eigenmode decomposition — overlapping wave patterns
//
// a = mode count (complexity)
// b = noise floor
// c = mode speed
// d = spatial scale
// e = hue spread
// f = emergence glow
// g = mode coupling visual
// h = brightness

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

#define PI 3.14159265
#define MAX_MODES 10

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash(float n) { return fract(sin(n) * 43758.5453); }

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float aspect = iResolution.x / iResolution.y;
    vec2 p = (uv - 0.5) * 2.0;
    p.x *= aspect;

    float modeCount = param(a, 3.0, 10.0);
    float noiseFlr  = param(b, 0.0, 0.5);
    float modeSpd   = param(c, 0.3, 3.0);
    float scale     = param(d, 0.5, 3.0);
    float hueSpread = param(e, 0.3, 2.0);
    float emergeGlo = param(f, 0.2, 1.5);
    float coupling  = param(g, 0.0, 1.0);
    float bright    = param(h, 0.5, 2.0);

    float t = iTime;
    p *= scale;

    float totalField = 0.0;
    vec3 totalColor = vec3(0.0);
    float totalWeight = 0.001;

    for (int i = 0; i < MAX_MODES; i++) {
        float fi = float(i);
        if (fi >= modeCount) break;

        // Procedural mode parameters
        float freq = (hash(fi * 7.13) - 0.5) * 8.0;
        float amp = 0.2 + hash(fi * 13.71) * 0.6;
        float phase = hash(fi * 23.37) * PI * 2.0 + t * modeSpd * freq * 0.3;
        float kx = floor((hash(fi * 31.17) - 0.5) * 8.0);
        float ky = floor((hash(fi * 37.91) - 0.5) * 8.0);
        float shape = floor(hash(fi * 43.53) * 4.0);
        float hue = fract(fi / modeCount * hueSpread);
        vec2 center = vec2(hash(fi * 51.13) - 0.5, hash(fi * 57.71) - 0.5) * 0.5;

        // Age-based envelope
        float age = mod(t * 0.3 + fi * 1.7, 8.0);
        float envelope = smoothstep(0.0, 2.0, age) * smoothstep(8.0, 6.0, age) * amp;

        vec2 lp = p - center;
        float spatial = 0.0;

        if (shape < 1.0) {
            spatial = sin(kx * lp.x + ky * lp.y + phase);
        } else if (shape < 2.0) {
            float r = length(lp);
            spatial = sin(length(vec2(kx, ky)) * r + phase) * exp(-r * r * 2.0);
        } else if (shape < 3.0) {
            float r = length(lp);
            float theta = atan(lp.y, lp.x);
            spatial = sin(kx * r + ky * theta + phase) * exp(-r * r * 1.5);
        } else {
            spatial = sin(kx * lp.x * lp.y + phase) * exp(-dot(lp, lp));
        }

        float contribution = spatial * envelope;

        // Mode coupling: interference between adjacent modes
        if (coupling > 0.01 && i > 0) {
            float prevFreq = (hash(float(i-1) * 7.13) - 0.5) * 8.0;
            float freqDist = abs(freq - prevFreq);
            contribution *= 1.0 + coupling * sin(freqDist * t) * 0.5;
        }

        totalField += contribution;
        float w = abs(contribution);
        totalColor += hsv2rgb(vec3(hue, 0.7, 1.0)) * w;
        totalWeight += w;
    }

    // RMT noise floor
    float noise = 0.0;
    for (float i = 1.0; i < 8.0; i++) {
        float ff = i * 1.7;
        noise += sin(p.x * ff + t * i * 0.3) * cos(p.y * ff * 1.3 - t * i * 0.2);
    }
    noise = noise / 8.0 * noiseFlr;
    totalField += noise;

    vec3 signalColor = totalColor / totalWeight;
    float signalBright = clamp(abs(totalField - noise) * 0.8, 0.0, 1.0);
    signalColor *= signalBright * bright;

    vec3 noiseColor = vec3(0.1, 0.1, 0.15) * abs(noise) * 3.0;
    vec3 col = vec3(0.01, 0.01, 0.02) + noiseColor * 0.3 + signalColor * 0.9;

    float emergence = smoothstep(noiseFlr * 2.0, noiseFlr * 4.0, abs(totalField - noise));
    col += vec3(0.1, 0.2, 0.3) * emergence * emergeGlo;

    fragColor = vec4(col, 1.0);
}
