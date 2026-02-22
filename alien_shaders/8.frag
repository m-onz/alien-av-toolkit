// Shader 23: Behavioral Flow Fields
// Curl noise velocity with distinct behavioral zones
// Based on C7 behavioral diversity experiment
//
// a = flow intensity
// b = vortex strength
// c = behavior zones
// d = speed streaks
// e = scale
// f = animation speed
// g = color by velocity
// h = turbulence layers

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

// Curl noise for divergence-free flow
vec2 curl(vec2 p, float t) {
    float eps = 0.01;
    float n = noise(p + t * 0.1);
    float nx = noise(p + vec2(eps, 0.0) + t * 0.1);
    float ny = noise(p + vec2(0.0, eps) + t * 0.1);
    return vec2(ny - n, -(nx - n)) / eps;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    float speed = mix(0.3, 2.0, f);
    float t = iTime * speed;
    
    float scale = mix(3.0, 12.0, e);
    vec2 q = p * scale;
    
    // Multi-layer curl noise flow
    float flowIntensity = mix(0.2, 1.5, a);
    float turbLayers = mix(1.0, 4.0, h);
    
    vec2 velocity = vec2(0.0);
    float amp = 1.0;
    vec2 pos = q;
    
    for (int i = 0; i < 4; i++) {
        if (float(i) >= turbLayers) break;
        velocity += curl(pos, t * (1.0 + float(i) * 0.3)) * amp;
        pos *= 2.0;
        amp *= 0.5;
    }
    velocity *= flowIntensity;
    
    // Add vortices
    float vortexStrength = mix(0.0, 2.0, b);
    for (int i = 0; i < 5; i++) {
        vec2 vortexCenter = vec2(
            sin(float(i) * 2.1 + t * 0.2) * 0.4,
            cos(float(i) * 1.7 + t * 0.15) * 0.4
        );
        vec2 toVortex = p - vortexCenter;
        float dist = length(toVortex);
        float vortex = exp(-dist * dist * 8.0);
        // Perpendicular rotation
        velocity += vec2(-toVortex.y, toVortex.x) * vortex * vortexStrength * (mod(float(i), 2.0) * 2.0 - 1.0);
    }
    
    float spd = length(velocity);
    float angle = atan(velocity.y, velocity.x);
    
    // Behavioral zones based on speed
    float zoneStrength = mix(0.0, 1.0, c);
    int behavior = 0;
    if (spd < 0.15) behavior = 0;      // stationary (dormant)
    else if (spd < 0.4) behavior = 1;  // wanderer
    else if (spd < 0.8) behavior = 2;  // cruiser
    else behavior = 3;                  // dasher
    
    // Behavior-specific hues
    float behaviorHues[4];
    behaviorHues[0] = 0.6;   // stationary: blue
    behaviorHues[1] = 0.35;  // wanderer: green
    behaviorHues[2] = 0.15;  // cruiser: orange
    behaviorHues[3] = 0.0;   // dasher: red
    
    float baseHue = behaviorHues[behavior];
    
    // Genome from position
    float genome = noise(p * 3.0 + t * 0.05);
    
    // Activity from flow convergence
    float activity = 0.3 + spd * 0.7;
    activity += noise(q + t * 0.5) * 0.3;
    activity = clamp(activity, 0.0, 1.0);
    
    // Color
    float hue = mix(genome, baseHue, zoneStrength);
    
    // Velocity-based color shift
    float velColor = mix(0.0, 0.3, g);
    hue += (angle / PI) * 0.1 * velColor;
    
    float sat = 0.6 + 0.3 * activity;
    float val = 0.05 + 0.85 * activity;
    
    vec3 col = hsv2rgb(vec3(fract(hue), sat, val));
    
    // Speed streaks
    float streaks = mix(0.0, 1.0, d);
    if (spd > 0.3) {
        float streak = sin(angle * 8.0 + spd * 20.0 - t * 5.0) * 0.5 + 0.5;
        col += vec3(streak * 0.2 * streaks * spd);
    }
    
    // Velocity direction visualization
    vec3 velVis = vec3(
        cos(angle) * 0.5 + 0.5,
        sin(angle) * 0.5 + 0.5,
        cos(angle + 2.094) * 0.5 + 0.5
    );
    col = mix(col, velVis, spd * 0.15 * velColor);
    
    // Flow lines (advected particles)
    vec2 advected = p;
    for (int i = 0; i < 3; i++) {
        vec2 v = curl(advected * scale, t) * 0.02;
        advected += v;
    }
    float flowLine = sin(advected.x * 50.0 + advected.y * 50.0) * 0.5 + 0.5;
    col += vec3(0.1, 0.12, 0.15) * flowLine * 0.15 * activity;
    
    // Dark background
    col = mix(vec3(0.01, 0.015, 0.02), col, smoothstep(0.0, 0.2, activity));
    
    fragColor = vec4(col, 1.0);
}
