// Shader 21: Quantum Gray-Scott Morphogenesis
// Reaction-diffusion with entanglement and domain walls
// Based on quantum-oea-v3 experiment
//
// a = feed rate (f parameter)
// b = kill rate (k parameter)
// c = pattern scale
// d = entanglement glow
// e = domain wall visibility
// f = animation speed
// g = phase shimmer
// h = color diversity

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

// Simplex-ish noise for organic patterns
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = i.x + i.y * 57.0;
    return mix(
        mix(hash(vec3(n, 0.0, 0.0)), hash(vec3(n + 1.0, 0.0, 0.0)), f.x),
        mix(hash(vec3(n + 57.0, 0.0, 0.0)), hash(vec3(n + 58.0, 0.0, 0.0)), f.x),
        f.y
    );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    float speed = mix(0.2, 1.5, f);
    float t = iTime * speed;
    
    // Gray-Scott parameters mapped from a,b
    float feed = mix(0.01, 0.08, a);
    float kill = mix(0.045, 0.07, b);
    float scale = mix(5.0, 25.0, c);
    
    // Create reaction-diffusion-like pattern using layered noise
    vec2 q = p * scale;
    
    // Warped coordinates for organic look
    float warp = noise(q * 0.5 + t * 0.3) * 2.0;
    q += vec2(sin(warp), cos(warp)) * 0.5;
    
    // Multiple frequency layers (like Gray-Scott spots/stripes)
    float pattern = 0.0;
    pattern += sin(q.x * 2.0 + t) * cos(q.y * 2.0 - t * 0.7) * 0.5;
    pattern += sin(q.x * 4.0 - t * 0.5 + q.y * 3.0) * 0.25;
    pattern += noise(q * 2.0 + t * 0.2) * 0.5;
    
    // Spots pattern (Gray-Scott B chemical)
    float spots = 0.0;
    for (int i = 0; i < 8; i++) {
        vec2 center = vec2(
            sin(float(i) * 1.7 + t * 0.3) * 0.4,
            cos(float(i) * 2.3 + t * 0.25) * 0.4
        );
        float d = length(p - center);
        float spot = exp(-d * d * (15.0 + sin(t + float(i)) * 5.0));
        spots += spot;
    }
    spots = clamp(spots, 0.0, 1.0);
    
    // Combine into A and B chemicals
    float A = 0.5 + pattern * 0.3;
    float B = spots * 0.8 + pattern * 0.2;
    
    // Apply Gray-Scott-like reaction
    float ABB = A * B * B;
    A = clamp(A - ABB + feed * (1.0 - A), 0.0, 1.0);
    B = clamp(B + ABB - (kill + feed) * B, 0.0, 1.0);
    
    // Genome from pattern
    float genome = fract(noise(p * 3.0) + t * 0.02);
    genome = mix(genome, fract(genome + pattern * 0.1), mix(0.3, 1.0, h));
    
    // Phase oscillators
    float phase1 = fract(t * 0.15 + genome * 0.5);
    float phase2 = fract(t * 0.12 + B * 0.3);
    float shimmer = mix(0.0, 1.0, g) * sin(phase1 * TAU) * sin(phase2 * TAU);
    
    // Color based on genome and activity
    float activity = B;
    float hue = genome * 0.9 + 0.08 * (A / (activity + 0.001) - 0.5);
    float sat = smoothstep(0.0, 0.2, activity) * 0.85;
    float val = 0.012 + smoothstep(0.0, 0.3, activity) * 0.9;
    val *= 0.87 + 0.13 * shimmer;
    
    vec3 col = hsv2rgb(vec3(fract(hue), sat, val));
    
    // Entanglement glow (bright areas where B is high)
    float entangle = mix(0.0, 0.4, d);
    col += vec3(0.1, 0.15, 0.3) * entangle * smoothstep(0.3, 0.8, B);
    
    // Domain walls - detect genome gradients
    float gx = noise(p * 3.0 + vec2(0.01, 0.0)) - noise(p * 3.0 - vec2(0.01, 0.0));
    float gy = noise(p * 3.0 + vec2(0.0, 0.01)) - noise(p * 3.0 - vec2(0.0, 0.01));
    float wall = length(vec2(gx, gy)) * 10.0;
    float wallVis = mix(0.0, 1.0, e);
    col += vec3(0.12, 0.15, 0.25) * smoothstep(0.02, 0.15, wall) * wallVis * val;
    
    // Substrate glow in empty areas
    col += vec3(0.008, 0.02, 0.035) * smoothstep(0.8, 1.0, A) * smoothstep(0.1, 0.0, activity);
    
    // Vignette
    vec2 vc = uv * 2.0 - 1.0;
    col *= 1.0 - dot(vc, vc) * 0.12;
    
    fragColor = vec4(col, 1.0);
}
