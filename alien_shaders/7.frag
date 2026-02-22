// Shader 22: Perpetual Emergence
// Seasonal cycles, plate tectonics, critical dynamics
// Based on quantum-perpetual-v4 experiment
//
// a = season intensity
// b = tectonic activity
// c = critical dynamics
// d = turbulence
// e = temperature variation
// f = animation speed
// g = instability flicker
// h = domain wall glow

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
    
    float speed = mix(0.3, 2.0, f);
    float t = iTime * speed;
    
    // SEASONAL CYCLES (dual frequencies for complex pattern)
    float seasonIntensity = mix(0.1, 0.5, a);
    float season = sin(t * 0.1) * cos(t * 0.07);
    float climate = sin(t * 0.05) * cos(t * 0.06 + 1.7);
    float seasonalTemp = 0.5 + seasonIntensity * season;
    float humidity = 0.5 + 0.25 * climate;
    
    // TECTONIC DRIFT
    float tectonicActivity = mix(0.0, 1.0, b);
    vec2 drift = vec2(
        sin(t * 0.02 + p.x * 0.5),
        cos(t * 0.015 + p.y * 0.6)
    ) * tectonicActivity * 0.1;
    vec2 driftedP = p + drift;
    
    // Plate velocity (mantle convection pattern)
    float mantle = sin(fragCoord.x * 0.02 + t * 0.03) * cos(fragCoord.y * 0.03 - t * 0.02);
    float plateVelocity = (mantle * 0.5 + 0.5) * tectonicActivity;
    
    // Genome from warped fbm
    float genome = fbm(driftedP * 3.0, t * 0.5);
    
    // CRITICAL DYNAMICS - system near phase transition
    float criticalStrength = mix(0.0, 1.0, c);
    float totalLife = fbm(driftedP * 5.0, t);
    float criticalPoint = 0.5 + 0.3 * sin(t * 0.03);
    float nearCritical = exp(-abs(totalLife - criticalPoint) * 8.0) * criticalStrength;
    
    // Species A: thrives in warmth
    float tempOpt = fract(genome * 3.47 + 0.3);
    float tempStress = abs(seasonalTemp - tempOpt);
    float tempBoost = exp(-tempStress * 4.0);
    
    float spA = fbm(driftedP * 8.0 + vec2(t * 0.3, 0.0), t) * tempBoost;
    spA *= (1.0 + season * 0.5);
    
    // Species B: thrives in cold
    float coldAdapt = 1.0 - tempBoost;
    float spB = fbm(driftedP * 7.0 + vec2(0.0, t * 0.25), t * 0.8) * coldAdapt;
    spB *= (1.0 + humidity * 0.5);
    
    // TURBULENT MIXING
    float turbulence = mix(0.0, 1.0, d);
    float turb = sin(fragCoord.x * 0.08 + t * 2.0) * cos(fragCoord.y * 0.11 - t * 1.5);
    turb *= 0.1 * (1.0 + nearCritical * 0.5) * turbulence;
    spA += turb * (hash(vec3(fragCoord.xy, t)) - 0.5);
    spB -= turb * (hash(vec3(fragCoord.xy + 500.0, t)) - 0.5);
    
    spA = clamp(spA, 0.0, 1.0);
    spB = clamp(spB, 0.0, 1.0);
    totalLife = spA + spB;
    
    // Temperature field
    float tempVar = mix(0.3, 1.0, e);
    float temp = seasonalTemp + (spA + spB) * 0.15 * tempVar;
    
    // Color
    float hue = genome * 0.85 + 0.08 * (spA / (totalLife + 0.001) - 0.5);
    float sat = smoothstep(0.0, 0.25, totalLife) * 0.9;
    float val = 0.015 + smoothstep(0.0, 0.4, totalLife) * 0.85 + temp * 0.12;
    val *= 0.92 + 0.08 * season;
    
    vec3 col = hsv2rgb(vec3(fract(hue), sat, val));
    
    // Temperature tint
    col = mix(col, vec3(1.0, 0.85, 0.7), smoothstep(0.7, 0.9, temp) * 0.15); // warm
    col = mix(col, vec3(0.1, 0.15, 0.3), smoothstep(0.2, 0.0, temp) * 0.2);  // cold
    
    // Plate boundaries glow
    col += vec3(0.15, 0.1, 0.08) * smoothstep(0.5, 0.8, plateVelocity) * val;
    
    // Instability flicker
    float flicker = mix(0.0, 1.0, g);
    float flickerPattern = sin(t * 3.0 + fragCoord.x * 0.1) * cos(t * 4.0 + fragCoord.y * 0.1);
    float stability = 1.0 - nearCritical * 0.5;
    col *= 1.0 - smoothstep(0.7, 0.3, stability) * abs(flickerPattern) * 0.12 * flicker;
    
    // Domain walls
    float wallGlow = mix(0.0, 1.0, h);
    float gx = fbm(driftedP * 3.0 + vec2(0.02, 0.0), t * 0.5) - fbm(driftedP * 3.0 - vec2(0.02, 0.0), t * 0.5);
    float gy = fbm(driftedP * 3.0 + vec2(0.0, 0.02), t * 0.5) - fbm(driftedP * 3.0 - vec2(0.0, 0.02), t * 0.5);
    float wall = length(vec2(gx, gy)) * 8.0;
    col += vec3(0.12, 0.15, 0.25) * smoothstep(0.02, 0.15, wall) * wallGlow * val;
    
    // Vignette
    vec2 vc = uv * 2.0 - 1.0;
    col *= 1.0 - dot(vc, vc) * 0.15;
    
    fragColor = vec4(col, 1.0);
}
