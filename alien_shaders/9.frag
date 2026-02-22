// Shader 25: Eternal Ice Age
// Frozen ecosystem with ice crystals and cold-adapted life
// Based on F16 eternal ice age experiment
//
// a = temperature (0=frozen, 1=thaw)
// b = ice crystal density
// c = cold-adapted life
// d = frost patterns
// e = aurora intensity
// f = animation speed
// g = survival pockets
// h = glacial flow

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

float hash(vec3 p) {
    p = fract(p * vec3(443.9, 441.4, 437.2));
    p += dot(p, p.yzx + 19.2);
    return fract((p.x + p.y) * p.z);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = i.x + i.y * 157.0;
    return mix(
        mix(hash(vec3(n, 0.0, 0.0)), hash(vec3(n + 1.0, 0.0, 0.0)), f.x),
        mix(hash(vec3(n + 157.0, 0.0, 0.0)), hash(vec3(n + 158.0, 0.0, 0.0)), f.x),
        f.y
    );
}

float fbm(vec2 p, float t) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 5; i++) {
        v += a * noise(p + t * 0.05);
        p = rot * p * 2.0;
        a *= 0.5;
    }
    return v;
}

// Ice crystal pattern (hexagonal)
float iceHex(vec2 p) {
    vec2 q = abs(p);
    return max(q.x * 0.866 + q.y * 0.5, q.y) - 1.0;
}

float iceCrystals(vec2 p, float t) {
    float crystals = 0.0;
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        vec2 center = vec2(
            sin(fi * 1.1 + t * 0.05) * 0.3,
            cos(fi * 1.7 + t * 0.04) * 0.3
        );
        float angle = fi * 1.047 + t * 0.02;
        mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        vec2 q = rot * (p - center) * (8.0 + fi * 2.0);
        float hex = 1.0 - smoothstep(0.0, 0.1, iceHex(q));
        crystals += hex * (0.5 + 0.5 * sin(fi + t));
    }
    return clamp(crystals, 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    float speed = mix(0.2, 1.5, f);
    float t = iTime * speed;
    
    // Temperature (low = frozen)
    float temp = mix(0.05, 0.5, a);
    
    // Glacial flow (slow drift)
    float glacialFlow = mix(0.0, 0.3, h);
    vec2 flow = vec2(
        sin(t * 0.02 + p.y * 2.0),
        cos(t * 0.015 + p.x * 2.0)
    ) * glacialFlow;
    vec2 flowedP = p + flow;
    
    // Ice crystal layer
    float crystalDensity = mix(0.0, 1.0, b);
    float crystals = iceCrystals(flowedP, t) * crystalDensity;
    
    // Frost patterns (dendritic)
    float frostIntensity = mix(0.0, 1.0, d);
    float frost = 0.0;
    frost += fbm(flowedP * 15.0, t) * 0.5;
    frost += fbm(flowedP * 30.0 + 100.0, t * 0.5) * 0.3;
    frost += fbm(flowedP * 60.0 + 200.0, t * 0.3) * 0.2;
    frost *= frostIntensity * (1.0 - temp);
    
    // Cold-adapted life (survives in pockets)
    float coldLife = mix(0.0, 1.0, c);
    float survivalPockets = mix(0.0, 1.0, g);
    
    // Life clusters in warm pockets
    float life = 0.0;
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        vec2 pocket = vec2(
            sin(fi * 2.3 + t * 0.03) * 0.35,
            cos(fi * 1.9 + t * 0.025) * 0.35
        );
        float dist = length(flowedP - pocket);
        float pocketWarmth = exp(-dist * dist * (5.0 + survivalPockets * 10.0));
        
        // Cold-adapted organisms
        float organism = fbm(flowedP * 10.0 + fi * 10.0, t) * pocketWarmth;
        organism *= coldLife * (0.5 + temp);
        life += organism;
    }
    life = clamp(life, 0.0, 1.0);
    
    // Genome for life coloring
    float genome = fbm(flowedP * 3.0, t * 0.2);
    float coldTolerance = fract(genome * 3.47);
    
    // Base ice color
    vec3 iceColor = vec3(0.7, 0.85, 1.0);
    vec3 deepIce = vec3(0.15, 0.25, 0.45);
    vec3 frostColor = vec3(0.9, 0.95, 1.0);
    
    // Layer the ice
    vec3 col = mix(deepIce, iceColor, 0.3 + frost * 0.4);
    
    // Add crystal highlights
    col += vec3(0.2, 0.25, 0.3) * crystals;
    
    // Add frost surface
    col = mix(col, frostColor, frost * 0.3);
    
    // Cold-adapted life (cyan-blue organisms)
    if (life > 0.05) {
        float lifeHue = 0.5 + coldTolerance * 0.15; // cyan to blue
        vec3 lifeColor = hsv2rgb(vec3(lifeHue, 0.7, 0.8));
        col = mix(col, lifeColor, life * 0.8);
    }
    
    // Aurora borealis effect
    float auroraIntensity = mix(0.0, 0.5, e);
    float aurora = sin(p.x * 3.0 + t * 0.5) * cos(p.y * 2.0 - t * 0.3);
    aurora += sin(p.x * 5.0 - t * 0.7) * 0.5;
    aurora = aurora * 0.5 + 0.5;
    aurora *= smoothstep(0.0, 0.3, p.y + 0.3); // stronger at top
    
    vec3 auroraColor = hsv2rgb(vec3(0.45 + sin(t * 0.2) * 0.1, 0.8, aurora));
    col += auroraColor * auroraIntensity * (1.0 - life);
    
    // Temperature-based tinting
    col = mix(col, col * vec3(0.8, 0.85, 1.0), (1.0 - temp) * 0.3);
    
    // Warm pockets glow slightly
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        vec2 pocket = vec2(
            sin(fi * 2.3 + t * 0.03) * 0.35,
            cos(fi * 1.9 + t * 0.025) * 0.35
        );
        float dist = length(flowedP - pocket);
        float warmth = exp(-dist * dist * 15.0) * survivalPockets * temp;
        col += vec3(0.15, 0.1, 0.05) * warmth;
    }
    
    // Subtle sparkle on ice
    float sparkle = hash(vec3(floor(fragCoord.xy * 0.5), floor(t * 10.0)));
    if (sparkle > 0.995) {
        col += vec3(0.3, 0.35, 0.4) * crystalDensity;
    }
    
    // Vignette (darker at edges = colder)
    vec2 vc = uv * 2.0 - 1.0;
    col *= 1.0 - dot(vc, vc) * 0.2;
    
    fragColor = vec4(col, 1.0);
}
