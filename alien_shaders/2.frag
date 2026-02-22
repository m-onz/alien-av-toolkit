// Shader 12: Veins/Cellular - Organic vein and cell patterns
// Creates branching, network-like structures
// Black and white with fine organic detail
//
// a = animation speed
// b = cell scale
// c = vein thickness
// d = branching complexity
// e = contrast
// f = edge glow
// g = invert
// h = pulse/throb

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

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.13);
    p3 += dot(p3, p3.yzx + 3.333);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

// Voronoi with distance to edge
vec3 voronoi(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    
    float d1 = 8.0;  // Distance to closest
    float d2 = 8.0;  // Distance to second closest
    vec2 closest;
    
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash2(n + g);
            vec2 r = g + o - f;
            float d = dot(r, r);
            
            if (d < d1) {
                d2 = d1;
                d1 = d;
                closest = n + g + o;
            } else if (d < d2) {
                d2 = d;
            }
        }
    }
    
    return vec3(sqrt(d1), sqrt(d2), hash(closest));
}

// Worley noise for cellular look
float worley(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    float minDist = 1.0;
    
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash2(n + g);
            vec2 r = g + o - f;
            minDist = min(minDist, dot(r, r));
        }
    }
    return sqrt(minDist);
}

// Value noise for organic variation
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

float fbm(vec2 p, int octaves) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 6; ++i) {
        if (i >= octaves) break;
        v += a * noise(p);
        p = rot * p * 2.0 + vec2(100.0);
        a *= 0.5;
    }
    return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Parameters
    float speed = mix(0.05, 0.5, a);
    float cellScale = mix(3.0, 15.0, b);
    float thickness = mix(0.02, 0.2, c);
    float complexity = mix(1.0, 4.0, d);
    float contrast = mix(1.0, 3.0, e);
    float glowAmt = mix(0.0, 1.0, f);
    float invert = step(0.5, g);
    float pulse = mix(0.0, 1.0, h);
    
    float t = iTime * speed;
    
    // Add organic distortion
    vec2 p = uv;
    p += 0.1 * vec2(fbm(uv * 3.0 + t, 4), fbm(uv * 3.0 + 100.0 + t, 4));
    
    // Multi-scale voronoi for veins
    vec3 v1 = voronoi(p * cellScale);
    vec3 v2 = voronoi(p * cellScale * 2.0 + t * 0.5);
    vec3 v3 = voronoi(p * cellScale * 0.5 - t * 0.3);
    
    // Edge detection (veins are at cell boundaries)
    float edge1 = v1.y - v1.x;
    float edge2 = v2.y - v2.x;
    float edge3 = v3.y - v3.x;
    
    // Combine edges at different scales
    float veins = 0.0;
    veins += smoothstep(thickness, 0.0, edge1) * 1.0;
    veins += smoothstep(thickness * 0.7, 0.0, edge2) * 0.5 * complexity / 4.0;
    veins += smoothstep(thickness * 1.5, 0.0, edge3) * 0.3 * complexity / 4.0;
    
    // Add glow around veins
    float glow = 0.0;
    if (glowAmt > 0.01) {
        glow = exp(-edge1 * 5.0) * glowAmt;
        glow += exp(-edge2 * 8.0) * glowAmt * 0.5;
    }
    
    // Pulse effect
    if (pulse > 0.01) {
        float pulseWave = sin(t * 5.0 - v1.x * 10.0) * 0.5 + 0.5;
        veins *= 0.7 + pulseWave * 0.3 * pulse;
    }
    
    // Combine
    float v = veins + glow;
    
    // Apply contrast
    v = pow(v, 1.0 / contrast);
    
    // Invert
    v = mix(v, 1.0 - v, invert);
    
    v = clamp(v, 0.0, 1.0);
    
    fragColor = vec4(vec3(v), 1.0);
}
