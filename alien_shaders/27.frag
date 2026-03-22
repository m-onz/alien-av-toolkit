// Shader 29: Wave Interference
// Ported from openended/shaders/15-wave-interference.html
// Multiple wave sources creating interference patterns
// a-d = source positions, e-g = wave frequency, h = source count

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

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float baseFreq = 15.0 + (e + f + g) * 10.0;
    int numSources = 4 + int(h * 4.0);
    
    float psi = 0.0;
    float psiAbs = 0.0;
    
    for (int i = 0; i < 8; i++) {
        if (i >= numSources) break;
        float fi = float(i);
        
        float a1 = t * (0.15 + fi * 0.03) + fi * PI * 2.0 / 8.0;
        float a2 = t * (0.08 + fi * 0.02) + fi * 1.3;
        float radius = 0.35 + 0.2 * sin(t * 0.1 + fi * 0.7);
        radius += (a + b) * 0.2;
        
        vec2 source = vec2(
            radius * cos(a1) + 0.12 * sin(a2),
            radius * sin(a1) + 0.12 * cos(a2)
        );
        source.x += (c - 0.5) * 0.3;
        source.y += (d - 0.5) * 0.3;
        
        float freq = baseFreq + 5.0 * sin(t * 0.07 + fi * 2.1);
        float phase = t * (1.5 + fi * 0.3) + fi * 0.8;
        float amp = 0.8 + 0.2 * sin(t * 0.2 + fi);
        
        float r = length(uv - source);
        float falloff = 1.0 / (1.0 + r * 3.0);
        float wave = amp * sin(freq * r - phase) * falloff;
        psi += wave;
        psiAbs += abs(wave);
    }
    
    float field = psi / 8.0 * 3.0;
    float envelope = psiAbs / 8.0 * 2.5;
    
    float pos = max(field, 0.0);
    float neg = max(-field, 0.0);
    float intensity = pos + neg;
    
    float fringe = abs(sin(field * PI * 2.0));
    intensity = mix(intensity, intensity * 1.3, fringe * 0.3);
    
    float totalEnergy = a + b + c + d + e + f + g;
    intensity *= 0.6 + totalEnergy * 0.4;
    
    
    // Color based on wave phase and position
    float colorPhase = field * 0.5 + t * 0.03 + uv.x * 0.2;
    vec3 warmCol = vec3(1.0, 0.4, 0.2);
    vec3 midCol = vec3(0.6, 0.2, 0.55);
    vec3 coolCol = vec3(0.2, 0.4, 0.9);
    
    float blend3 = sin(colorPhase * 2.0) * 0.5 + 0.5;
    vec3 baseCol;
    if (blend3 < 0.5) {
        baseCol = mix(warmCol, midCol, blend3 * 2.0);
    } else {
        baseCol = mix(midCol, coolCol, (blend3 - 0.5) * 2.0);
    }
    
    // Positive waves warm, negative waves cool
    vec3 waveCol = mix(coolCol, warmCol, pos / (pos + neg + 0.01));
    baseCol = mix(baseCol, waveCol, 0.4);
    
    // Fringe iridescence
    vec3 fringeCol = 0.5 + 0.5 * cos(6.28318 * (fringe * 0.5 + t * 0.05 + vec3(0.0, 0.33, 0.67)));
    baseCol = mix(baseCol, fringeCol, fringe * 0.3);
    
    vec3 col = baseCol * intensity * 2.5;
    
    // Add glow
    col += baseCol * envelope * 0.3;
    
    // Tone mapping
    col = col / (1.0 + col * 0.5);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
