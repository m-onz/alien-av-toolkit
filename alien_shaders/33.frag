// Shader 33: Spiral Vortex Field
// Inspired by openended/shaders/pulse-spiral-vortex.html
// Procedural spiral vortex patterns without simulation
// a-d = vortex count, e-g = rotation speed, h = spiral tightness

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
#define TAU 6.28318530

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    int numVortices = 3 + int((a + b + c + d) * 3.0);
    float rotSpeed = 0.3 + (e + f + g) * 0.5;
    float tightness = 3.0 + h * 8.0;
    
    float intensity = 0.0;
    
    for (int i = 0; i < 12; i++) {
        if (i >= numVortices) break;
        float fi = float(i);
        
        vec2 center = vec2(
            (hash(vec2(fi, 0.0)) - 0.5) * 1.2,
            (hash(vec2(0.0, fi)) - 0.5) * 1.2
        );
        center.x += sin(t * 0.2 + fi) * 0.1;
        center.y += cos(t * 0.15 + fi * 1.3) * 0.1;
        
        vec2 p = uv - center;
        float r = length(p);
        float angle = atan(p.y, p.x);
        
        float charge = hash(vec2(fi, fi)) > 0.5 ? 1.0 : -1.0;
        float spiral = angle * charge + r * tightness - t * rotSpeed * charge;
        
        float wave = sin(spiral * 3.0) * 0.5 + 0.5;
        float falloff = exp(-r * r * 4.0);
        
        intensity += wave * falloff * 0.4;
    }
    
    float phase = intensity * TAU;
    float pattern = sin(phase) * 0.5 + 0.5;
    
    float totalEnergy = a + b + c + d + e + f + g;
    pattern *= 0.5 + totalEnergy * 0.5;
    
    // Vibrant color based on spiral phase and position
    float colorPhase = intensity * 2.0 + atan(uv.y, uv.x) * 0.3 + t * 0.05;
    vec3 warmCol = vec3(1.0, 0.4, 0.2);
    vec3 midCol = vec3(0.8, 0.15, 0.6);
    vec3 coolCol = vec3(0.2, 0.5, 1.0);
    
    float blend3 = sin(colorPhase * 2.0) * 0.5 + 0.5;
    vec3 baseCol;
    if (blend3 < 0.5) {
        baseCol = mix(warmCol, midCol, blend3 * 2.0);
    } else {
        baseCol = mix(midCol, coolCol, (blend3 - 0.5) * 2.0);
    }
    
    // Vortex center glow
    float centerGlow = exp(-length(uv) * 3.0);
    vec3 glowCol = mix(midCol, warmCol, centerGlow);
    baseCol = mix(baseCol, glowCol, centerGlow * 0.5);
    
    // Spiral arm highlighting
    float armHighlight = sin(phase * 3.0) * 0.5 + 0.5;
    vec3 armCol = mix(coolCol, vec3(1.0, 0.9, 0.8), armHighlight);
    baseCol = mix(baseCol, armCol, armHighlight * pattern * 0.4);
    
    // Iridescent shimmer
    vec3 irid = 0.5 + 0.5 * cos(TAU * (intensity + t * 0.1 + vec3(0.0, 0.33, 0.67)));
    baseCol = mix(baseCol, irid, 0.2);
    
    vec3 col = baseCol * pattern * 1.8;
    
    // Add bloom
    col += glowCol * centerGlow * 0.3;
    
    // Tone mapping
    col = col / (1.0 + col * 0.4);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
