// Shader 31: Reaction Diffusion Pattern
// Inspired by openended/shaders/reaction-diffusion.html
// Fake Gray-Scott style patterns using procedural noise
// a-d = pattern scale, e-g = animation speed, h = pattern type

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

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
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

float fbm(vec2 p, int octaves) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

float rdPattern(vec2 p, float t, float patternType) {
    float scale = 8.0;
    float speed = 0.3;
    
    float n1 = fbm(p * scale + t * speed, 5);
    float n2 = fbm(p * scale * 1.5 - t * speed * 0.7, 5);
    float n3 = fbm(p * scale * 0.5 + vec2(t * speed * 0.5, -t * speed * 0.3), 4);
    
    float pattern;
    if (patternType < 0.33) {
        pattern = smoothstep(0.4, 0.6, n1) * smoothstep(0.3, 0.5, n2);
    } else if (patternType < 0.66) {
        float spots = smoothstep(0.55, 0.6, n1);
        float veins = smoothstep(0.45, 0.5, abs(n2 - 0.5) * 2.0);
        pattern = max(spots, veins * 0.7);
    } else {
        float stripes = sin(n1 * 20.0 + n3 * 10.0) * 0.5 + 0.5;
        pattern = smoothstep(0.3, 0.7, stripes);
    }
    
    return pattern;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float scale = 1.0 + (a + b + c + d) * 0.5;
    float speed = 1.0 + (e + f + g) * 2.0;
    
    vec2 p = uv * scale;
    
    float pattern = rdPattern(p, t * speed * 0.1, h);
    
    vec2 dx = vec2(0.01, 0.0);
    vec2 dy = vec2(0.0, 0.01);
    float gx = rdPattern(p + dx, t * speed * 0.1, h) - rdPattern(p - dx, t * speed * 0.1, h);
    float gy = rdPattern(p + dy, t * speed * 0.1, h) - rdPattern(p - dy, t * speed * 0.1, h);
    float edge = length(vec2(gx, gy)) * 10.0;
    
    float intensity = pattern * 0.8 + edge * 0.3;
    
    float totalEnergy = a + b + c + d + e + f + g;
    intensity *= 0.5 + totalEnergy * 0.5;
    
    // Color gradient based on pattern and position
    float colorPhase = pattern * 0.6 + uv.x * 0.2 + uv.y * 0.15 + t * 0.02;
    vec3 warmCol = vec3(1.0, 0.35, 0.15);
    vec3 midCol = vec3(0.7, 0.15, 0.5);
    vec3 coolCol = vec3(0.15, 0.4, 0.85);
    
    float blend3 = sin(colorPhase * 3.0) * 0.5 + 0.5;
    vec3 baseCol;
    if (blend3 < 0.5) {
        baseCol = mix(warmCol, midCol, blend3 * 2.0);
    } else {
        baseCol = mix(midCol, coolCol, (blend3 - 0.5) * 2.0);
    }
    
    // Edge highlighting with contrasting color
    vec3 edgeCol = mix(coolCol, warmCol, pattern);
    baseCol = mix(baseCol, edgeCol, edge * 0.5);
    
    // Fake 3D shading from gradient
    vec3 fakeNormal = normalize(vec3(gx * 5.0, gy * 5.0, 1.0));
    vec3 light = normalize(vec3(0.5, 0.8, 1.0));
    float diff = max(0.0, dot(fakeNormal, light));
    float spec = pow(max(0.0, dot(reflect(-light, fakeNormal), vec3(0.0, 0.0, 1.0))), 16.0);
    
    // Iridescent sheen
    float iridPhase = dot(fakeNormal.xy, uv) * 3.0 + t * 0.1;
    vec3 irid = 0.5 + 0.5 * cos(6.28318 * (iridPhase + vec3(0.0, 0.33, 0.67)));
    
    vec3 col = baseCol * (diff * 0.5 + 0.4) * intensity * 1.5;
    col += vec3(1.0, 0.95, 0.9) * spec * 0.4 * pattern;
    col = mix(col, col * irid, 0.25);
    
    // Pulsing glow in pattern areas
    float pulse = sin(t * 2.0 + pattern * 5.0) * 0.5 + 0.5;
    col += baseCol * pulse * pattern * 0.15;
    
    // Tone mapping
    col = col / (1.0 + col * 0.5);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
