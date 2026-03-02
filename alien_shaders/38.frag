// Shader 38: Noise Corruption
// Layered noise with glitch artifacts and dark aesthetic
// a-d = corruption, e-g = speed, h = noise scale

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

float hash_f(float nn) { return fract(sin(nn) * 43758.5453); }
float hash2_f(vec2 pp) { return fract(sin(dot(pp, vec2(127.1, 311.7))) * 43758.5453); }

float noise_f(vec2 pp) {
    vec2 ii = floor(pp);
    vec2 ff = fract(pp);
    ff = ff * ff * (3.0 - 2.0 * ff);
    return mix(mix(hash2_f(ii), hash2_f(ii + vec2(1.0, 0.0)), ff.x),
               mix(hash2_f(ii + vec2(0.0, 1.0)), hash2_f(ii + vec2(1.0, 1.0)), ff.x), ff.y);
}

float fbm_f(vec2 pp, int octaves) {
    float vv = 0.0, amp = 0.5;
    for (int ii = 0; ii < 6; ii++) {
        if (ii >= octaves) break;
        vv += amp * noise_f(pp);
        pp *= 2.0;
        amp *= 0.5;
    }
    return vv;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float tt = iTime;
    
    float corruption = 0.5 + (a + b + c + d) * 0.3;
    float speed = 0.3 + (e + f + g) * 0.5;
    float noiseScale = 3.0 + h * 8.0;
    
    // Glitch time
    float glitchTime = floor(tt * 3.0);
    
    // Domain warp
    vec2 warp = vec2(
        fbm_f(uv * 2.0 + vec2(tt * speed * 0.3), 4) - 0.5,
        fbm_f(uv * 2.0 + vec2(5.0, tt * speed * 0.25), 4) - 0.5
    ) * corruption * 0.4;
    vec2 wuv = uv + warp;
    
    // Horizontal glitch displacement
    float lineGlitch = hash_f(floor(uv.y * 30.0) + glitchTime);
    wuv.x += (lineGlitch - 0.5) * 0.1 * corruption * step(0.85, lineGlitch);
    
    // Multi-layer noise
    float n1 = fbm_f(wuv * noiseScale + vec2(tt * speed * 0.2), 5);
    float n2 = fbm_f(wuv * noiseScale * 0.5 - vec2(tt * speed * 0.15), 4);
    float n3 = fbm_f(wuv * noiseScale * 2.0 + vec2(tt * speed * 0.1, -tt * speed * 0.08), 3);
    
    // Combine noise layers
    float pattern = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
    
    // Create contrast bands
    float bands = sin(pattern * 15.0 + tt * speed) * 0.5 + 0.5;
    bands = smoothstep(0.3, 0.7, bands);
    
    // Color palette - visible base
    vec3 darkCol = vec3(0.12, 0.06, 0.14);
    vec3 midCol = vec3(0.35, 0.18, 0.28);
    vec3 lightCol = vec3(0.6, 0.35, 0.45);
    vec3 accentCol = vec3(0.0, 0.5, 0.4);
    
    // Build base color
    vec3 col = mix(darkCol, midCol, pattern);
    col = mix(col, lightCol, bands * 0.4);
    
    // Block glitch
    vec2 blockUV = floor(wuv * 12.0);
    float blockTrigger = step(0.9 - corruption * 0.15, hash2_f(blockUV + vec2(glitchTime)));
    col = mix(col, col.brg, blockTrigger * 0.6);
    
    // Noise grain overlay
    float grain = hash2_f(fragCoord.xy + vec2(tt * 60.0));
    col += (grain - 0.5) * 0.08;
    
    // Scan lines
    float scanLine = sin(fragCoord.y * 2.5) * 0.5 + 0.5;
    col *= 0.85 + scanLine * 0.15;
    
    // Chromatic split on edges
    float edgeNoise = abs(n1 - n2);
    col.r += edgeNoise * corruption * 0.15;
    col.b -= edgeNoise * corruption * 0.1;
    
    // Accent color in high noise areas
    float accent = smoothstep(0.6, 0.8, n3);
    col = mix(col, accentCol * 0.4, accent * corruption * 0.5);
    
    // Flicker
    float flicker = 0.92 + 0.08 * sin(tt * 20.0 + hash_f(glitchTime) * 30.0);
    col *= flicker;
    
    // Vignette
    float vig = 1.0 - length(uv) * 0.7;
    col *= max(0.0, vig);
    
    // Energy boost - visible by default
    float totalEnergy = a + b + c + d + e + f + g;
    col *= 1.8 + totalEnergy * 0.4;
    
    // Bit crush
    float bitDepth = 16.0 - corruption * 10.0;
    col = floor(col * bitDepth) / bitDepth;
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
