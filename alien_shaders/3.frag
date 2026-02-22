// Shader 14: Interference - Moire and wave interference patterns
// Creates hypnotic overlapping wave patterns
// Black and white with fine detail
//
// a = wave speed
// b = wave count
// c = wave spacing
// d = rotation
// e = distortion
// f = contrast
// g = center offset
// h = secondary waves

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
#define TAU 6.28318530718

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.13);
    p3 += dot(p3, p3.yzx + 3.333);
    return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Concentric rings from a point
float rings(vec2 p, vec2 center, float freq, float t) {
    float d = length(p - center);
    return sin(d * freq - t);
}

// Parallel lines at an angle
float lines(vec2 p, float angle, float freq, float t) {
    float c = cos(angle), s = sin(angle);
    float d = p.x * c + p.y * s;
    return sin(d * freq - t);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Parameters
    float speed = mix(0.2, 2.0, a);
    float waveCount = mix(2.0, 8.0, b);
    float freq = mix(10.0, 60.0, c);
    float rotation = mix(0.0, TAU, d);
    float distort = mix(0.0, 0.3, e);
    float contrast = mix(1.0, 4.0, f);
    float offset = mix(0.0, 0.5, g);
    float secondary = mix(0.0, 1.0, h);
    
    float t = iTime * speed;
    
    // Apply distortion
    vec2 p = uv;
    if (distort > 0.01) {
        p += distort * vec2(
            noise(uv * 5.0 + t * 0.3),
            noise(uv * 5.0 + 100.0 + t * 0.3)
        );
    }
    
    float v = 0.0;
    
    // Generate multiple wave sources
    for (float i = 0.0; i < 8.0; i++) {
        if (i >= waveCount) break;
        
        float angle = rotation + i * TAU / waveCount;
        vec2 center = vec2(cos(angle), sin(angle)) * offset;
        
        // Add time-based movement to centers
        center += vec2(
            sin(t * 0.3 + i * 1.3) * 0.1,
            cos(t * 0.4 + i * 1.7) * 0.1
        );
        
        // Concentric rings from this center
        float wave = rings(p, center, freq, t + i * 0.5);
        v += wave;
    }
    
    // Add secondary interference pattern
    if (secondary > 0.01) {
        float lines1 = lines(p, t * 0.1, freq * 0.7, t);
        float lines2 = lines(p, t * 0.1 + PI * 0.5, freq * 0.7, -t);
        v += (lines1 + lines2) * secondary * 0.5;
    }
    
    // Normalize
    v /= waveCount;
    
    // Apply contrast and convert to 0-1
    v = pow(abs(v), 1.0 / contrast);
    v = v * 0.5 + 0.5;
    
    fragColor = vec4(vec3(v), 1.0);
}
