// Shader 15: Ridged Terrain - Mountain/terrain-like ridged noise
// Creates sharp ridges and valleys like topographic maps
// Black and white with dramatic contrast
//
// a = animation speed
// b = scale
// c = ridge sharpness
// d = octaves/detail
// e = contrast
// f = erosion effect
// g = lighting angle
// h = height exaggeration

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

// Ridged noise - absolute value creates sharp ridges
float ridgedNoise(vec2 p) {
    return 1.0 - abs(noise(p) * 2.0 - 1.0);
}

// Ridged FBM
float ridgedFBM(vec2 p, int octaves, float sharpness) {
    float v = 0.0;
    float a = 0.5;
    float freq = 1.0;
    float prev = 1.0;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        float n = ridgedNoise(p * freq);
        n = pow(n, sharpness);
        v += n * a * prev;
        prev = n;
        freq *= 2.0;
        a *= 0.5;
        p = rot * p;
    }
    return v;
}

// Regular FBM for comparison/mixing
float fbm(vec2 p, int octaves) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        v += a * noise(p);
        p = rot * p * 2.0 + vec2(100.0);
        a *= 0.5;
    }
    return v;
}

// Calculate normal for lighting
vec3 calcNormal(vec2 p, int octaves, float sharpness, float heightScale) {
    float eps = 0.01;
    float h0 = ridgedFBM(p, octaves, sharpness) * heightScale;
    float hx = ridgedFBM(p + vec2(eps, 0.0), octaves, sharpness) * heightScale;
    float hy = ridgedFBM(p + vec2(0.0, eps), octaves, sharpness) * heightScale;
    return normalize(vec3(h0 - hx, h0 - hy, eps));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Parameters
    float speed = mix(0.02, 0.2, a);
    float scale = mix(2.0, 10.0, b);
    float sharpness = mix(0.5, 3.0, c);
    int octaves = int(mix(3.0, 8.0, d));
    float contrast = mix(0.5, 2.0, e);
    float erosion = mix(0.0, 1.0, f);
    float lightAngle = mix(0.0, TAU, g);
    float heightScale = mix(0.5, 3.0, h);
    
    float t = iTime * speed;
    
    vec2 p = uv * scale;
    
    // Slow drift
    p += vec2(t * 0.5, t * 0.3);
    
    // Generate ridged terrain
    float terrain = ridgedFBM(p, octaves, sharpness);
    
    // Add erosion effect (mix with regular fbm)
    if (erosion > 0.01) {
        float eroded = fbm(p * 2.0, octaves);
        terrain = mix(terrain, terrain * eroded, erosion);
    }
    
    // Calculate lighting
    vec3 normal = calcNormal(p, octaves, sharpness, heightScale);
    vec3 lightDir = normalize(vec3(cos(lightAngle), sin(lightAngle), 0.5));
    float lighting = dot(normal, lightDir) * 0.5 + 0.5;
    
    // Combine height and lighting
    float v = terrain * lighting;
    
    // Apply contrast
    v = pow(v, contrast);
    
    v = clamp(v, 0.0, 1.0);
    
    fragColor = vec4(vec3(v), 1.0);
}
