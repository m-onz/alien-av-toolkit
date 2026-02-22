// Shader 27: Volcanic Primordial Soup
// Lava flows, thermal vents, and emerging thermophile life
// Unique visual: hot reds/oranges with green life at edges
//
// a = lava intensity
// b = vent activity
// c = life emergence
// d = flow speed
// e = crust formation
// f = animation speed
// g = heat shimmer
// h = eruption frequency

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
        v += a * noise(p + t * 0.1);
        p = rot * p * 2.0;
        a *= 0.5;
    }
    return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    float speed = mix(0.2, 1.5, f);
    float t = iTime * speed;
    
    // Lava flow parameters
    float lavaIntensity = mix(0.3, 1.0, a);
    float flowSpeed = mix(0.1, 0.5, d);
    float crustFormation = mix(0.0, 0.8, e);
    
    // Flow direction (downward with lateral spread)
    vec2 flowDir = vec2(sin(p.x * 2.0 + t * 0.3) * 0.3, -1.0);
    vec2 flowedP = p + flowDir * t * flowSpeed;
    
    // Base lava pattern
    float lava = fbm(flowedP * 3.0, t * 0.5);
    lava = pow(lava, 0.8);
    
    // Cracks in the lava (cooled crust)
    float cracks = fbm(p * 8.0, t * 0.1);
    cracks = smoothstep(0.4, 0.6, cracks) * crustFormation;
    
    // Hot spots (thermal vents)
    float ventActivity = mix(0.0, 1.0, b);
    float vents = 0.0;
    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        vec2 ventPos = vec2(
            sin(fi * 2.1 + t * 0.05) * 0.35,
            cos(fi * 1.7 + t * 0.04) * 0.35
        );
        float dist = length(p - ventPos);
        float vent = exp(-dist * dist * 20.0);
        
        // Pulsing
        vent *= 0.5 + 0.5 * sin(t * 3.0 + fi * 2.0);
        vents += vent;
    }
    vents *= ventActivity;
    
    // Eruptions (random bursts)
    float eruptionFreq = mix(0.0, 0.1, h);
    float eruption = 0.0;
    float rng = hash(vec3(floor(t * 2.0), 0.0, 0.0));
    if (rng < eruptionFreq) {
        vec2 eruptPos = vec2(
            hash(vec3(floor(t * 2.0), 1.0, 0.0)) - 0.5,
            hash(vec3(floor(t * 2.0), 2.0, 0.0)) - 0.5
        ) * 0.6;
        float dist = length(p - eruptPos);
        float eruptPhase = fract(t * 2.0);
        eruption = exp(-dist * dist * 10.0) * (1.0 - eruptPhase);
    }
    
    // Combine heat sources
    float heat = lava * lavaIntensity + vents * 0.5 + eruption * 0.8;
    heat = clamp(heat, 0.0, 1.0);
    
    // Reduce heat where crust forms
    float visibleHeat = heat * (1.0 - cracks * 0.7);
    
    // Lava colors (black -> red -> orange -> yellow -> white)
    vec3 lavaColor;
    if (visibleHeat < 0.2) {
        lavaColor = mix(vec3(0.05, 0.02, 0.02), vec3(0.3, 0.05, 0.0), visibleHeat / 0.2);
    } else if (visibleHeat < 0.5) {
        lavaColor = mix(vec3(0.3, 0.05, 0.0), vec3(0.9, 0.3, 0.0), (visibleHeat - 0.2) / 0.3);
    } else if (visibleHeat < 0.8) {
        lavaColor = mix(vec3(0.9, 0.3, 0.0), vec3(1.0, 0.7, 0.2), (visibleHeat - 0.5) / 0.3);
    } else {
        lavaColor = mix(vec3(1.0, 0.7, 0.2), vec3(1.0, 1.0, 0.8), (visibleHeat - 0.8) / 0.2);
    }
    
    vec3 col = lavaColor;
    
    // Cooled crust (dark with cracks showing hot lava)
    vec3 crustColor = vec3(0.1, 0.08, 0.06);
    col = mix(col, crustColor, cracks * (1.0 - heat * 0.5));
    
    // Thermophile life (green organisms at cooler edges)
    float lifeEmergence = mix(0.0, 1.0, c);
    float lifeZone = smoothstep(0.5, 0.2, heat) * smoothstep(0.0, 0.15, heat);
    float life = fbm(p * 15.0, t * 0.3) * lifeZone * lifeEmergence;
    
    // Life colors (green to yellow-green thermophiles)
    vec3 lifeColor = hsv2rgb(vec3(0.25 + life * 0.1, 0.8, 0.7));
    col = mix(col, lifeColor, life * 0.8);
    
    // Heat shimmer (distortion effect simulated with color)
    float shimmer = mix(0.0, 1.0, g);
    float shimmerPattern = sin(p.y * 30.0 + t * 5.0) * cos(p.x * 25.0 - t * 4.0);
    shimmerPattern *= heat * shimmer * 0.1;
    col += vec3(shimmerPattern, shimmerPattern * 0.5, 0.0);
    
    // Smoke/ash particles rising
    for (int i = 0; i < 15; i++) {
        float fi = float(i);
        vec2 smokePos = vec2(
            fract(sin(fi * 127.1) * 43758.5453) - 0.5,
            mod(fract(sin(fi * 269.5) * 43758.5453) + t * 0.1, 1.0) - 0.5
        ) * 0.8;
        float dist = length(p - smokePos);
        float smoke = exp(-dist * dist * 100.0) * 0.3;
        col = mix(col, vec3(0.2, 0.18, 0.15), smoke * (1.0 - heat));
    }
    
    // Vignette (darker at edges)
    vec2 vc = uv * 2.0 - 1.0;
    col *= 1.0 - dot(vc, vc) * 0.2;
    
    fragColor = vec4(col, 1.0);
}
