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

// --- Ice Crystal / Frozen Ecosystem ---

float iceHex(vec2 p) {
    vec2 q = abs(p);
    return max(q.x * 0.866 + q.y * 0.5, q.y) - 1.0;
}

float iceCrystals(vec2 p, float t) {
    float crystals = 0.0;
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        vec2 center = vec2(sin(fi * 1.1 + t * 0.05) * 0.3, cos(fi * 1.7 + t * 0.04) * 0.3);
        float angle = fi * 1.047 + t * 0.02;
        mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        vec2 q = rot * (p - center) * (8.0 + fi * 2.0);
        float hex = 1.0 - smoothstep(0.0, 0.1, iceHex(q));
        crystals += hex * (0.5 + 0.5 * sin(fi + t));
    }
    return clamp(crystals, 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 p = uvCenter(fragCoord, iResolution.xy);
    float speed = param(f, 0.2, 1.5);
    float t = iTime * speed;
    float temp = param(a, 0.05, 0.5);
    float glacialFlow = param(d, 0.0, 0.3);
    vec2 flow = vec2(sin(t * 0.02 + p.y * 2.0), cos(t * 0.015 + p.x * 2.0)) * glacialFlow;
    vec2 flowedP = p + flow;
    float crystalDensity = param(b, 0.0, 1.0);
    float crystals = iceCrystals(flowedP, t) * crystalDensity;
    float frostIntensity = param(c, 0.0, 1.0);
    float frost = 0.0;
    frost += fbm(flowedP * 15.0, t) * 0.5;
    frost += fbm(flowedP * 30.0 + 100.0, t * 0.5) * 0.3;
    frost += fbm(flowedP * 60.0 + 200.0, t * 0.3) * 0.2;
    frost *= frostIntensity * (1.0 - temp);
    float coldLife = param(h, 0.0, 1.0);
    float survivalPockets = param(g, 0.0, 1.0);
    float life = 0.0;
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        vec2 pocket = vec2(sin(fi * 2.3 + t * 0.03) * 0.35, cos(fi * 1.9 + t * 0.025) * 0.35);
        float dist = length(flowedP - pocket);
        float pocketWarmth = exp(-dist * dist * (5.0 + survivalPockets * 10.0));
        float organism = fbm(flowedP * 10.0 + fi * 10.0, t) * pocketWarmth;
        organism *= coldLife * (0.5 + temp);
        life += organism;
    }
    life = clamp(life, 0.0, 1.0);
    float genome = fbm(flowedP * 3.0, t * 0.2);
    float coldTolerance = fract(genome * 3.47);
    vec3 iceColor = vec3(0.7, 0.85, 1.0);
    vec3 deepIce = vec3(0.15, 0.25, 0.45);
    vec3 frostColor = vec3(0.9, 0.95, 1.0);
    vec3 col = mix(deepIce, iceColor, 0.3 + frost * 0.4);
    col += vec3(0.2, 0.25, 0.3) * crystals;
    col = mix(col, frostColor, frost * 0.3);
    if (life > 0.05) {
        float lifeHue = 0.5 + coldTolerance * 0.15;
        vec3 lifeColor = hsv2rgb(vec3(lifeHue, 0.7, 0.8));
        col = mix(col, lifeColor, life * 0.8);
    }
    float auroraIntensity = param(e, 0.0, 0.5);
    float aurora = sin(p.x * 3.0 + t * 0.5) * cos(p.y * 2.0 - t * 0.3);
    aurora += sin(p.x * 5.0 - t * 0.7) * 0.5;
    aurora = aurora * 0.5 + 0.5;
    aurora *= smoothstep(0.0, 0.3, p.y + 0.3);
    vec3 auroraColor = hsv2rgb(vec3(0.45 + sin(t * 0.2) * 0.1, 0.8, aurora));
    col += auroraColor * auroraIntensity * (1.0 - life);
    col = mix(col, col * vec3(0.8, 0.85, 1.0), (1.0 - temp) * 0.3);
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        vec2 pocket = vec2(sin(fi * 2.3 + t * 0.03) * 0.35, cos(fi * 1.9 + t * 0.025) * 0.35);
        float dist = length(flowedP - pocket);
        float warmth = exp(-dist * dist * 15.0) * survivalPockets * temp;
        col += vec3(0.15, 0.1, 0.05) * warmth;
    }
    float sparkle = hash(vec3(floor(fragCoord.xy * 0.5), floor(t * 10.0)));
    if (sparkle > 0.995) { col += vec3(0.3, 0.35, 0.4) * crystalDensity; }
    fragColor = vec4(col, 1.0);
}
