// Shader 68: Reaction-Diffusion (from reaction-diffusion.html)
// Procedural Gray-Scott patterns — spots, stripes, worms, mitosis
// a=feed rate b=kill rate c=speed d=scale e=hue f=edge glow g=pattern mix h=bright

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
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash2(i) - 0.5, f), dot(hash2(i + vec2(1, 0)) - 0.5, f - vec2(1, 0)), u.x),
               mix(dot(hash2(i + vec2(0, 1)) - 0.5, f - vec2(0, 1)), dot(hash2(i + vec2(1, 1)) - 0.5, f - vec2(1, 1)), u.x), u.y) + 0.5;
}

// Procedural Turing pattern approximation
float turingPattern(vec2 p, float feed, float kill) {
    // Layer multiple standing waves with RD-like wavelength selection
    float pattern = 0.0;
    float wavelength = mix(5.0, 15.0, feed);
    // Primary pattern
    float n1 = sin(p.x * wavelength + noise(p * 0.5) * 4.0) *
               sin(p.y * wavelength + noise(p * 0.5 + 10.0) * 4.0);
    // Secondary modulation
    float n2 = noise(p * wavelength * 0.3);
    float n3 = noise(p * wavelength * 0.15 + 20.0);
    // Mix between spots and stripes based on kill rate
    float spots = n1 * n2;
    float stripes = sin(p.x * wavelength * 0.7 + p.y * wavelength * 0.3 +
                        noise(p * 2.0) * 3.0);
    pattern = mix(spots, stripes * 0.5, kill);
    // Add fine detail
    pattern += noise(p * wavelength * 1.5) * 0.2;
    return pattern;
}

vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (uv - 0.5) * vec2(iResolution.x / iResolution.y, 1.0);
    float feed = param(a, 0.0, 1.0);
    float kill = param(b, 0.0, 1.0);
    float speed = param(c, 0.1, 1.0);
    float scale = param(d, 3.0, 12.0);
    float hueOff = param(e, 0.0, 1.0);
    float edgeGlow = param(f, 0.5, 3.0);
    float patMix = param(g, 0.0, 1.0);
    float bright = param(h, 0.5, 2.0);
    float t = iTime * speed;

    vec2 sp = p * scale;

    // Slowly evolving feed/kill like the original
    float dynFeed = feed + sin(t * 0.2 + p.x * 3.0) * 0.15 + sin(t * 0.15) * 0.1;
    float dynKill = kill + cos(t * 0.17 + p.y * 2.5) * 0.1 + cos(t * 0.13) * 0.08;

    // Domain warping for organic movement
    float w1 = noise(sp * 0.3 + t * 0.1) * 2.0;
    float w2 = noise(sp * 0.3 + t * 0.08 + 5.0) * 2.0;
    vec2 warpedP = sp + vec2(w1, w2);

    // Multi-scale Turing patterns
    float pattern1 = turingPattern(warpedP, dynFeed, dynKill);
    float pattern2 = turingPattern(warpedP * 1.5 + t * 0.1, dynFeed * 1.2, dynKill * 0.8);
    float pattern = mix(pattern1, pattern2, patMix);

    // Chemical B concentration (the interesting pattern)
    float chemB = smoothstep(-0.2, 0.5, pattern);

    // Edge detection for glow
    float eps = 0.01;
    float px = turingPattern(warpedP + vec2(eps, 0), dynFeed, dynKill);
    float py = turingPattern(warpedP + vec2(0, eps), dynFeed, dynKill);
    float edge = length(vec2(px - pattern, py - pattern)) / eps;
    edge = min(edge * 0.5, 1.0);

    // Slowly rotating color palette
    float v = chemB * 3.0;
    vec3 col = palette(v + hueOff + t * 0.03,
        vec3(0.5, 0.5, 0.5),
        vec3(0.5, 0.5, 0.5),
        vec3(1.0, 0.7, 0.4),
        vec3(0.0, 0.15, 0.2)
    );

    // Boost contrast
    col = pow(max(col, 0.0), vec3(0.8)) * 1.4;

    // Edge glow
    col += vec3(0.4, 0.1, 0.6) * edge * edgeGlow;

    col *= bright;
    fragColor = vec4(max(col, 0.0), 1.0);
}
