// Shader 69: Electric Growth (from electric-growth.html)
// DLA-inspired branching electric network with potential field
// a=branch density b=growth speed c=pulse speed d=scale e=hue f=tip glow g=bg potential h=bright

/////////////////////////start Pd Header
uniform vec3 iResolution;
uniform float iTime;
uniform float iGlobalTime;
uniform vec4 iMouse;
uniform float a, b, c, d, e, f, g, h;
void mainImage(out vec4 fragColor, in vec2 fragCoord);
void main() { mainImage(gl_FragColor, gl_FragCoord.xy); }
/////////////////////////end Pd Header

#define PI 3.14159265
float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash(float n) { return fract(sin(n) * 43758.5453); }
vec2 hash2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash2(i) - 0.5, f), dot(hash2(i + vec2(1, 0)) - 0.5, f - vec2(1, 0)), u.x),
               mix(dot(hash2(i + vec2(0, 1)) - 0.5, f - vec2(0, 1)), dot(hash2(i + vec2(1, 1)) - 0.5, f - vec2(1, 1)), u.x), u.y) + 0.5;
}
vec3 hsv2rgb(vec3 c) { vec4 K = vec4(1, 2. / 3., 1. / 3., 3); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0., 1.), c.y); }

// Branching fractal: angular fbm with radial growth
float branch(vec2 p, vec2 root, float t, float density) {
    vec2 d = p - root;
    float r = length(d);
    float ang = atan(d.y, d.x);
    // Growth radius expands with time
    float growRadius = mod(t * 0.3, 3.0) + 0.5;
    if (r > growRadius) return 0.0;
    // Angular branching: higher frequencies at larger radius
    float branchFreq = 2.0 + floor(r * density * 3.0);
    float angPattern = 0.0;
    float amp = 1.0;
    float totalAmp = 0.0;
    for (float i = 0.0; i < 5.0; i++) {
        float freq = branchFreq * (1.0 + i);
        float noiseOff = noise(vec2(r * 3.0 + i * 7.0, ang * 0.5 + i * 3.0)) * 0.5;
        angPattern += amp * (0.5 + 0.5 * cos(ang * freq + noiseOff * 6.0 + i * 1.3));
        totalAmp += amp;
        amp *= 0.5;
    }
    angPattern /= totalAmp;
    // Thin branches
    angPattern = pow(angPattern, 3.0 + r * 2.0);
    // Radial decay
    float radial = exp(-r * 0.5) * (1.0 - smoothstep(growRadius - 0.3, growRadius, r));
    return angPattern * radial;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (uv - 0.5) * vec2(iResolution.x / iResolution.y, 1.0);
    float density = param(a, 0.3, 1.0);
    float growSpd = param(b, 0.3, 2.0);
    float pulseSpd = param(c, 0.5, 3.0);
    float scale = param(d, 1.0, 4.0);
    float hueOff = param(e, 0.0, 1.0);
    float tipGlow = param(f, 0.5, 3.0);
    float bgPot = param(g, 0.0, 0.5);
    float bright = param(h, 0.5, 1.5);
    float t = iTime * growSpd;
    p *= scale;
    vec3 col = vec3(0.0);
    // Multiple seed points
    for (float i = 0.0; i < 5.0; i++) {
        vec2 root = vec2(
            (hash(i * 7.13) - 0.5) * 1.5,
            (hash(i * 13.71) - 0.5) * 1.5
        );
        float network = branch(p, root, t + i * 2.0, density);
        if (network > 0.01) {
            float r = length(p - root);
            float growRadius = mod((t + i * 2.0) * 0.3, 3.0) + 0.5;
            // Age: distance from growth front
            float age = (growRadius - r) / growRadius;
            age = clamp(age, 0.0, 1.0);
            float energy = (1.0 - age) * 0.5 + 0.5;
            // Network color: electric blue to purple with age
            float hue = fract(0.6 + hueOff + age * 0.05 + sin(t * 0.5) * 0.05);
            float brightness = 0.3 + energy * 0.7;
            vec3 branchCol = hsv2rgb(vec3(hue, 0.6 - energy * 0.3, brightness * network));
            // Growth tip glow
            float tipDist = abs(r - growRadius);
            float tip = exp(-tipDist * tipDist * 20.0) * network;
            branchCol += vec3(0.5, 0.4, 0.6) * tip * tipGlow;
            // Energy pulses
            float pulse = sin(age * 20.0 - iTime * pulseSpd * 5.0) * 0.5 + 0.5;
            branchCol += vec3(0.1, 0.15, 0.3) * pulse * network * 0.5;
            col += branchCol;
        }
    }
    // Background potential field
    float potential = noise(p * 0.5 + t * 0.1) * bgPot;
    col += vec3(0.02, 0.0, 0.04) * potential;
    // Glow around network
    float glow = 0.0;
    for (float i = 0.0; i < 5.0; i++) {
        vec2 root = vec2((hash(i * 7.13) - 0.5) * 1.5, (hash(i * 13.71) - 0.5) * 1.5);
        float r = length(p - root);
        float growRadius = mod((t + i * 2.0) * 0.3, 3.0) + 0.5;
        if (r < growRadius) {
            glow += exp(-r * 0.5) * 0.1;
        }
    }
    col += vec3(0.1, 0.05, 0.2) * glow;
    // Moving source points
    for (float i = 0.0; i < 3.0; i++) {
        vec2 src = vec2(
            sin(t * 0.3 + i * 2.094) * 1.5,
            cos(t * 0.25 + i * 2.094) * 1.5
        );
        float sd = length(p - src);
        col += vec3(0.5, 0.1, 0.0) * exp(-sd * sd * 5.0) * 0.3;
    }
    col *= bright;
    col = 1.0 - exp(-col * 2.0);
    fragColor = vec4(col, 1.0);
}
