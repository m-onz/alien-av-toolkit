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

// --- Inlined helpers ---

float saturate(float x) { return clamp(x, 0.0, 1.0); }
float param(float p, float lo, float hi) { return mix(lo, hi, p); }
#define PI 3.14159265359
#define TAU 6.28318530718

vec2 uvCenter(vec2 fragCoord, vec2 resolution) {
    return (fragCoord - 0.5 * resolution) / resolution.y;
}

float hash(float p) { p = fract(p * 0.011); p *= p + 7.5; p *= p + p; return fract(p); }
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.13); p3 += dot(p3, p3.yzx + 3.333); return fract((p3.x + p3.y) * p3.z); }
float hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }

float noise(vec2 p) {
    vec2 i = floor(p); vec2 ff = fract(p); ff = ff * ff * (3.0 - 2.0 * ff);
    float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, ff.x), mix(c, d, ff.x), ff.y);
}

float fbm(vec2 p, float t) {
    float v = 0.0; float a = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 5; i++) { v += a * noise(p + t * 0.1); p = rot * p * 2.0; a *= 0.5; }
    return v;
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// --- Volcanic Primordial Soup ---

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 p = uvCenter(fragCoord, iResolution.xy);
    float speed = param(f, 0.2, 1.5);
    float t = iTime * speed;
    float lavaIntensity = param(a, 0.3, 1.0);
    float flowSpeed = param(d, 0.1, 0.5);
    float crustFormation = param(e, 0.0, 0.8);
    vec2 flowDir = vec2(sin(p.x * 2.0 + t * 0.3) * 0.3, -1.0);
    vec2 flowedP = p + flowDir * t * flowSpeed;
    float lava = fbm(flowedP * 3.0, t * 0.5);
    lava = pow(lava, 0.8);
    float cracks = fbm(p * 8.0, t * 0.1);
    cracks = smoothstep(0.4, 0.6, cracks) * crustFormation;
    float ventActivity = param(b, 0.0, 1.0);
    float vents = 0.0;
    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        vec2 ventPos = vec2(sin(fi * 2.1 + t * 0.05) * 0.35, cos(fi * 1.7 + t * 0.04) * 0.35);
        float dist = length(p - ventPos);
        float vent = exp(-dist * dist * 20.0);
        vent *= 0.5 + 0.5 * sin(t * 3.0 + fi * 2.0);
        vents += vent;
    }
    vents *= ventActivity;
    float eruptionFreq = param(h, 0.0, 0.1);
    float eruption = 0.0;
    float rng = hash(vec3(floor(t * 2.0), 0.0, 0.0));
    if (rng < eruptionFreq) {
        vec2 eruptPos = vec2(hash(vec3(floor(t * 2.0), 1.0, 0.0)) - 0.5, hash(vec3(floor(t * 2.0), 2.0, 0.0)) - 0.5) * 0.6;
        float dist = length(p - eruptPos);
        float eruptPhase = fract(t * 2.0);
        eruption = exp(-dist * dist * 10.0) * (1.0 - eruptPhase);
    }
    float heat = lava * lavaIntensity + vents * 0.5 + eruption * 0.8;
    heat = clamp(heat, 0.0, 1.0);
    float visibleHeat = heat * (1.0 - cracks * 0.7);
    vec3 lavaColor;
    if (visibleHeat < 0.2) lavaColor = mix(vec3(0.05, 0.02, 0.02), vec3(0.3, 0.05, 0.0), visibleHeat / 0.2);
    else if (visibleHeat < 0.5) lavaColor = mix(vec3(0.3, 0.05, 0.0), vec3(0.9, 0.3, 0.0), (visibleHeat - 0.2) / 0.3);
    else if (visibleHeat < 0.8) lavaColor = mix(vec3(0.9, 0.3, 0.0), vec3(1.0, 0.7, 0.2), (visibleHeat - 0.5) / 0.3);
    else lavaColor = mix(vec3(1.0, 0.7, 0.2), vec3(1.0, 1.0, 0.8), (visibleHeat - 0.8) / 0.2);
    vec3 col = lavaColor;
    vec3 crustColor = vec3(0.1, 0.08, 0.06);
    col = mix(col, crustColor, cracks * (1.0 - heat * 0.5));
    float lifeEmergence = param(c, 0.0, 1.0);
    float lifeZone = smoothstep(0.5, 0.2, heat) * smoothstep(0.0, 0.15, heat);
    float life = fbm(p * 15.0, t * 0.3) * lifeZone * lifeEmergence;
    vec3 lifeColor = hsv2rgb(vec3(0.25 + life * 0.1, 0.8, 0.7));
    col = mix(col, lifeColor, life * 0.8);
    float shimmer = param(g, 0.0, 1.0);
    float shimmerPattern = sin(p.y * 30.0 + t * 5.0) * cos(p.x * 25.0 - t * 4.0);
    shimmerPattern *= heat * shimmer * 0.1;
    col += vec3(shimmerPattern, shimmerPattern * 0.5, 0.0);
    for (int i = 0; i < 15; i++) {
        float fi = float(i);
        vec2 smokePos = vec2(fract(sin(fi * 127.1) * 43758.5453) - 0.5, mod(fract(sin(fi * 269.5) * 43758.5453) + t * 0.1, 1.0) - 0.5) * 0.8;
        float dist = length(p - smokePos);
        float smoke = exp(-dist * dist * 100.0) * 0.3;
        col = mix(col, vec3(0.2, 0.18, 0.15), smoke * (1.0 - heat));
    }
    fragColor = vec4(col, 1.0);
}
