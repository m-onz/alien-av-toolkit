// Shader 24: Alien Plasma Tendrils
// Bang-triggered organic plasma tendrils that writhe and pulse
// a-g = tendril envelopes (1 = spawn, decays to 0)
// h = chaos level (0 = smooth, 1 = chaotic)

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

float hash(float n) { return fract(sin(n) * 43758.5453); }

float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = dot(i, vec3(1.0, 57.0, 113.0));
    return mix(mix(mix(hash(n), hash(n + 1.0), f.x),
                   mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
               mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                   mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
}

float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float tendrilField(vec2 uv, float t, float chaos, float totalEnv) {
    float field = 0.0;
    
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        float phase = fi * 1.7 + t * 0.3;
        float phase2 = fi * 2.3 + t * 0.2;
        
        // Organic center motion
        vec2 center = vec2(
            sin(phase) * 0.3 + sin(phase2 * 1.3) * 0.15,
            cos(phase * 0.8) * 0.3 + cos(phase2 * 0.9) * 0.15
        );
        
        // Noise-based distortion
        vec2 distort = vec2(
            fbm(vec3(uv * 3.0 + fi, t * 0.5)) - 0.5,
            fbm(vec3(uv * 3.0 + fi + 10.0, t * 0.4)) - 0.5
        ) * chaos * 0.4;
        
        vec2 p = uv - center + distort;
        float r = length(p);
        
        // Blobby tendril shape
        float angle = atan(p.y, p.x);
        float wobble = fbm(vec3(angle * 2.0 + fi * 5.0, r * 4.0, t * 0.8)) * 0.3;
        float tendrilR = 0.08 + wobble * (1.0 + chaos);
        tendrilR *= 0.5 + totalEnv * 0.5;
        
        float blob = tendrilR / (r + 0.01);
        field += blob;
    }
    
    return field;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float totalEnv = a + b + c + d + e + f + g;
    float chaos = 0.3 + h * 0.7;
    
    // Warp UV based on envelopes
    vec2 warp = vec2(
        fbm(vec3(uv * 2.0, t * 0.3)) - 0.5,
        fbm(vec3(uv * 2.0 + 5.0, t * 0.25)) - 0.5
    ) * totalEnv * 0.15;
    vec2 wuv = uv + warp;
    
    float field = tendrilField(wuv, t, chaos, totalEnv);
    
    // Threshold for blobby surface
    float surface = smoothstep(0.8, 1.5, field);
    float core = smoothstep(2.0, 4.0, field);
    float edge = smoothstep(0.6, 0.9, field) * (1.0 - surface);
    
    // Fake normal from field gradient
    float eps = 0.01;
    float fx = tendrilField(wuv + vec2(eps, 0.0), t, chaos, totalEnv);
    float fy = tendrilField(wuv + vec2(0.0, eps), t, chaos, totalEnv);
    vec2 grad = vec2(fx - field, fy - field) / eps;
    vec3 normal = normalize(vec3(-grad * 0.5, 1.0));
    
    // Lighting
    vec3 light = normalize(vec3(0.5, 0.8, 1.0));
    float diff = max(0.0, dot(normal, light));
    float spec = pow(max(0.0, dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0))), 32.0);
    float fresnel = pow(1.0 - abs(normal.z), 3.0);
    
    // Alien color palette
    vec3 deepCol = vec3(0.1, 0.02, 0.15);
    vec3 midCol = vec3(0.4, 0.1, 0.5);
    vec3 hotCol = vec3(1.0, 0.3, 0.5);
    vec3 coreCol = vec3(1.0, 0.8, 0.9);
    
    // Iridescent shifting
    vec3 irid = 0.5 + 0.5 * cos(6.28318 * (field * 0.3 + t * 0.1 + vec3(0.0, 0.33, 0.67)));
    
    // Build color
    vec3 col = deepCol;
    col = mix(col, midCol, edge);
    col = mix(col, hotCol, surface * 0.7);
    col = mix(col, coreCol, core);
    col = mix(col, irid, fresnel * 0.5);
    
    // Apply lighting
    col *= diff * 0.6 + 0.4;
    col += vec3(1.0, 0.9, 0.95) * spec * 0.5;
    col += irid * fresnel * 0.3;
    
    // Pulsing glow
    float pulse = sin(t * 3.0 + field * 2.0) * 0.5 + 0.5;
    col += hotCol * pulse * surface * 0.2;
    
    // Energy boost
    col *= 0.6 + totalEnv * 0.4;
    
    // Tone mapping
    col = col / (1.0 + col);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
