// Shader 19: Metaball Pulse
// Bang-triggered pulsing metaballs
// a-g = blob pulse envelopes (0->1 triggers pulse)
// h = blob count (0 = few, 1 = many)

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

float metaball(vec2 p, vec2 center, float radius) {
    float d = length(p - center);
    return radius * radius / (d * d + 0.001);
}

vec2 metaballGrad(vec2 p, vec2 center, float radius) {
    vec2 diff = p - center;
    float d2 = dot(diff, diff) + 0.001;
    return -2.0 * radius * radius * diff / (d2 * d2);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float totalEnergy = a + b + c + d + e + f + g;
    int numBlobs = 4 + int(h * 6.0);
    
    float field = 0.0;
    vec2 gradient = vec2(0.0);
    vec3 blobColorMix = vec3(0.0);
    float colorWeight = 0.0;
    
    for (int i = 0; i < 10; i++) {
        if (i >= numBlobs) break;
        float fi = float(i);
        
        float angle = fi * 0.7 + t * 0.3 * (1.0 + fi * 0.1);
        float radius = 0.25 + 0.15 * sin(t * 0.5 + fi * 1.3);
        
        vec2 center = vec2(
            cos(angle) * radius,
            sin(angle * 1.3 + fi) * radius
        );
        
        float pulseIdx = mod(fi, 7.0);
        float pulse = 1.0;
        if (pulseIdx < 1.0) pulse += a * 0.5;
        else if (pulseIdx < 2.0) pulse += b * 0.5;
        else if (pulseIdx < 3.0) pulse += c * 0.5;
        else if (pulseIdx < 4.0) pulse += d * 0.5;
        else if (pulseIdx < 5.0) pulse += e * 0.5;
        else if (pulseIdx < 6.0) pulse += f * 0.5;
        else pulse += g * 0.5;
        
        float blobSize = (0.08 + 0.03 * sin(t + fi * 2.0)) * pulse;
        float contribution = metaball(uv, center, blobSize);
        field += contribution;
        gradient += metaballGrad(uv, center, blobSize);
        
        // Each blob has its own shifting color
        vec3 blobCol = 0.5 + 0.5 * cos(6.28318 * (fi * 0.1 + t * 0.05 + vec3(0.0, 0.33, 0.67)));
        blobColorMix += blobCol * contribution;
        colorWeight += contribution;
    }
    
    float threshold = 1.0;
    float edge = smoothstep(threshold - 0.3, threshold + 0.1, field);
    float core = smoothstep(threshold + 0.5, threshold + 2.0, field);
    float surface = smoothstep(threshold - 0.1, threshold + 0.3, field);
    
    // Normalize gradient for fake normal
    vec2 n2d = normalize(gradient + 0.001);
    vec3 normal = normalize(vec3(n2d.x, n2d.y, 0.5));
    
    // Fake 3D lighting
    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    float diff = max(0.0, dot(normal, lightDir));
    
    // Specular
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 reflDir = reflect(-lightDir, normal);
    float spec = pow(max(0.0, dot(reflDir, viewDir)), 32.0);
    
    // Fresnel-like rim
    float rim = 1.0 - abs(normal.z);
    rim = pow(rim, 2.0);
    
    // Iridescent color based on gradient angle
    float iridAngle = atan(n2d.y, n2d.x) + t * 0.2;
    vec3 iridescence = 0.5 + 0.5 * cos(6.28318 * (iridAngle * 0.5 + vec3(0.0, 0.33, 0.67)));
    
    // Base color from blob mix
    vec3 baseCol = colorWeight > 0.01 ? blobColorMix / colorWeight : vec3(0.5);
    
    // Warm/cool shift based on field intensity
    vec3 warmCol = vec3(1.0, 0.5, 0.3);
    vec3 coolCol = vec3(0.3, 0.5, 1.0);
    baseCol = mix(baseCol, mix(coolCol, warmCol, core), 0.3);
    
    // Combine colors
    vec3 col = baseCol * (diff * 0.6 + 0.25);
    col += vec3(1.0, 0.95, 0.9) * spec * 0.7;
    col += iridescence * rim * 0.4;
    col = mix(col, iridescence, rim * 0.3);
    
    // Apply surface mask
    col *= surface;
    
    // Edge glow
    float edgeGlow = smoothstep(threshold + 0.1, threshold - 0.2, field) * edge;
    col += iridescence * edgeGlow * 0.5;
    
    col *= 0.7 + totalEnergy * 0.3;
    
    // Tone mapping
    col = col / (1.0 + col);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
