// Shader 25: Liquid Metal Swarm
// Fast 2D metaballs with heavy displacement and metallic shading
// a-d = swarm energy, e-g = chaos, h = blob count

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

#define TAU 6.28318530

float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x),
               mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float energy = (a + b + c + d) * 0.5;
    float chaos = 0.5 + (e + f + g) * 0.5;
    int numBlobs = 12 + int(h * 12.0);
    
    // Domain warp for organic feel
    vec2 warp = vec2(
        noise(uv * 3.0 + t * 0.3) - 0.5,
        noise(uv * 3.0 + vec2(5.0) + t * 0.25) - 0.5
    ) * chaos * 0.3;
    vec2 wuv = uv + warp;
    
    float field = 0.0;
    vec2 gradient = vec2(0.0);
    vec3 colorAccum = vec3(0.0);
    float colorWeight = 0.0;
    float explosionGlow = 0.0;
    
    for (int i = 0; i < 24; i++) {
        if (i >= numBlobs) break;
        float fi = float(i);
        
        // Swirling blob positions
        float phase1 = fi * 1.3 + t * 0.5 * (1.0 + energy);
        float phase2 = fi * 2.1 + t * 0.4;
        float orbit = 0.3 + hash(fi * 7.0) * 0.25;
        
        vec2 center = vec2(
            sin(phase1) * orbit + sin(phase2 * 0.7) * orbit * 0.4,
            cos(phase1 * 0.9 + fi) * orbit + cos(phase2 * 0.6) * orbit * 0.3
        );
        
        // Displacement on blob position
        center += vec2(
            sin(t * 2.0 + fi * 3.0) * 0.05,
            cos(t * 1.8 + fi * 2.5) * 0.05
        ) * chaos;
        
        vec2 diff = wuv - center;
        float r = length(diff);
        
        // Blob radius with pulsing
        float blobR = 0.06 + hash(fi * 13.0) * 0.04 + sin(t * 3.0 + fi * 2.0) * 0.015;
        blobR *= 1.0 + energy * 0.3;
        
        // Metaball field
        float blob = blobR * blobR / (r * r + 0.0001);
        field += blob;
        
        // Gradient for fake normal
        gradient += diff * blob / (r + 0.001);
        
        // Per-blob color
        vec3 blobCol = 0.5 + 0.5 * cos(TAU * (hash(fi * 17.0) + t * 0.05 + vec3(0.0, 0.33, 0.67)));
        colorAccum += blobCol * blob;
        colorWeight += blob;
        
        // Check collision with nearby blobs for explosion
        for (int j = 0; j < 4; j++) {
            if (j >= i) break;
            float fj = float(j);
            float p1j = fj * 1.3 + t * 0.5 * (1.0 + energy);
            float p2j = fj * 2.1 + t * 0.4;
            float orbitJ = 0.3 + hash(fj * 7.0) * 0.25;
            vec2 centerJ = vec2(sin(p1j) * orbitJ, cos(p1j * 0.9 + fj) * orbitJ);
            float dist = length(center - centerJ);
            if (dist < 0.15) {
                explosionGlow += (0.15 - dist) * 5.0 * blob;
            }
        }
    }
    
    // Surface threshold
    float surface = smoothstep(0.6, 1.2, field);
    float core = smoothstep(1.5, 4.0, field);
    float edge = smoothstep(0.4, 0.7, field) * (1.0 - surface * 0.5);
    
    // Fake 3D normal from gradient
    vec2 n2d = normalize(gradient + 0.001);
    vec3 normal = normalize(vec3(n2d * 0.8, 1.0));
    
    // Lighting
    vec3 light = normalize(vec3(0.5, 0.8, 1.0));
    float diff = max(0.0, dot(normal, light));
    float spec = pow(max(0.0, dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0))), 32.0);
    float fresnel = pow(1.0 - abs(normal.z), 2.5);
    
    // Base color
    vec3 baseCol = colorWeight > 0.01 ? colorAccum / colorWeight : vec3(0.5);
    
    // Iridescence
    float iridAngle = atan(n2d.y, n2d.x) + field * 0.5 + t * 0.15;
    vec3 irid = 0.5 + 0.5 * cos(TAU * (iridAngle * 0.3 + vec3(0.0, 0.33, 0.67)));
    
    // Warm/cool shift
    vec3 warmCol = vec3(1.0, 0.5, 0.3);
    vec3 coolCol = vec3(0.3, 0.5, 1.0);
    baseCol = mix(baseCol, mix(coolCol, warmCol, core), 0.3);
    
    // Build color
    vec3 col = baseCol * (diff * 0.5 + 0.35);
    col += vec3(1.0, 0.95, 0.9) * spec * 0.6;
    col = mix(col, irid, fresnel * 0.5);
    col += irid * fresnel * 0.2;
    col = mix(col, baseCol * 1.3, core * 0.4);
    
    // Apply surface
    col *= surface;
    
    // Edge glow
    col += irid * edge * 0.3;
    
    // Explosion glow
    col += vec3(1.0, 0.6, 0.3) * explosionGlow * chaos * 0.15;
    
    // Energy boost
    col *= 0.6 + energy * 0.4;
    
    // Tone mapping
    col = col / (1.0 + col);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
