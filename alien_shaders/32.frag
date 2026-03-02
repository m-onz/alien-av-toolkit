// Shader 32: Electric Network
// Inspired by openended/shaders/electric-growth.html
// Procedural lightning/electric network patterns
// a-d = branch density, e-g = pulse speed, h = network complexity

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

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

float electricLine(vec2 uv, vec2 start, vec2 end, float seed, float t) {
    vec2 dir = end - start;
    float len = length(dir);
    dir /= len;
    
    vec2 toP = uv - start;
    float proj = dot(toP, dir);
    proj = clamp(proj, 0.0, len);
    
    vec2 closest = start + dir * proj;
    float dist = length(uv - closest);
    
    float jitter = (noise(vec2(proj * 20.0 + seed, t * 5.0)) - 0.5) * 0.03;
    dist += abs(jitter);
    
    return smoothstep(0.015, 0.0, dist);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float density = 1.0 + (a + b + c + d) * 2.0;
    float pulseSpeed = 1.0 + (e + f + g) * 3.0;
    float complexity = 3.0 + h * 5.0;
    
    float intensity = 0.0;
    
    int numBranches = int(density * 4.0);
    for (int i = 0; i < 16; i++) {
        if (i >= numBranches) break;
        float fi = float(i);
        
        float angle1 = fi * 0.7 + t * 0.1;
        float angle2 = fi * 1.3 + t * 0.15;
        
        vec2 start = vec2(
            0.3 * cos(angle1),
            0.3 * sin(angle1)
        );
        vec2 end = vec2(
            0.6 * cos(angle2 + 1.0),
            0.6 * sin(angle2 + 1.0)
        );
        
        float line = electricLine(uv, start, end, fi * 17.0, t);
        
        float pulse = sin(t * pulseSpeed + fi * 0.5) * 0.5 + 0.5;
        intensity += line * (0.5 + pulse * 0.5);
        
        for (int j = 0; j < 3; j++) {
            if (float(j) >= complexity * 0.5) break;
            float fj = float(j);
            vec2 mid = mix(start, end, 0.3 + fj * 0.2);
            float branchAngle = angle1 + fj * 0.8 + hash(vec2(fi, fj)) * 2.0;
            vec2 branchEnd = mid + vec2(cos(branchAngle), sin(branchAngle)) * 0.15;
            
            float branch = electricLine(uv, mid, branchEnd, fi * 31.0 + fj * 7.0, t);
            intensity += branch * 0.5 * pulse;
        }
    }
    
    float glow = fbm(uv * 3.0 + t * 0.2) * 0.15;
    intensity += glow * (a + b + c + d);
    
    float totalEnergy = a + b + c + d + e + f + g;
    intensity *= 0.5 + totalEnergy * 0.5;
    
    // Electric color based on intensity and position
    float colorPhase = intensity * 0.5 + length(uv) * 0.3 + t * 0.05;
    vec3 coreCol = vec3(1.0, 0.95, 0.9);
    vec3 hotCol = vec3(1.0, 0.5, 0.3);
    vec3 midCol = vec3(0.7, 0.2, 0.6);
    vec3 coolCol = vec3(0.3, 0.4, 1.0);
    
    // Hot core fading to cooler edges
    vec3 baseCol = mix(coolCol, midCol, smoothstep(0.0, 0.3, intensity));
    baseCol = mix(baseCol, hotCol, smoothstep(0.3, 0.7, intensity));
    baseCol = mix(baseCol, coreCol, smoothstep(0.7, 1.0, intensity));
    
    // Add plasma glow variation
    float plasmaPhase = fbm(uv * 5.0 + t * 0.3) + t * 0.1;
    vec3 plasmaCol = 0.5 + 0.5 * cos(6.28318 * (plasmaPhase + vec3(0.0, 0.33, 0.67)));
    baseCol = mix(baseCol, plasmaCol, glow * 2.0);
    
    // Flickering brightness
    float flicker = 0.8 + 0.2 * sin(t * 15.0 + intensity * 10.0);
    
    vec3 col = baseCol * intensity * flicker * 1.5;
    
    // Add bloom/glow
    col += baseCol * smoothstep(0.2, 0.0, length(uv)) * 0.2;
    
    // Tone mapping
    col = col / (1.0 + col * 0.5);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
