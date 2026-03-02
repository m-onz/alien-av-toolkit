// Shader 16: Glitch Tubes
// Neon tubes with glitch corruption and scan lines
// a-d = glitch intensity, e-g = speed, h = tube count

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

float hash_f(float nn) { return fract(sin(nn) * 43758.5453); }
float hash2_f(vec2 pp) { return fract(sin(dot(pp, vec2(127.1, 311.7))) * 43758.5453); }

// Tube path
vec2 tubePath(float idx, float zz, float tt) {
    float phase = idx * 1.7;
    float freq = 0.6 + hash_f(idx * 5.0) * 0.3;
    return vec2(
        sin(zz * freq + tt + phase) * 0.6,
        cos(zz * freq * 0.8 + tt * 0.7 + phase) * 0.4
    );
}

// Distance to tube at depth z
float tubeDist(vec2 uv, float idx, float zz, float tt, float radius) {
    vec2 tubePos = tubePath(idx, zz, tt);
    return length(uv - tubePos) - radius;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float tt = iTime;
    
    float glitch = 0.3 + (a + b + c + d) * 0.4;
    float speed = 0.5 + (e + f + g) * 0.6;
    int numTubes = 4 + int(h * 6.0);
    
    // Glitch time
    float glitchTime = floor(tt * 4.0);
    
    // Horizontal glitch displacement
    float lineGlitch = hash_f(floor(uv.y * 25.0) + glitchTime);
    vec2 glitchUV = uv;
    glitchUV.x += (lineGlitch - 0.5) * 0.15 * glitch * step(0.8, lineGlitch);
    
    // Block glitch
    vec2 blockUV = floor(glitchUV * 10.0);
    float blockTrigger = step(0.88 - glitch * 0.1, hash2_f(blockUV + vec2(glitchTime)));
    glitchUV += vec2(hash2_f(blockUV) - 0.5, hash2_f(blockUV + vec2(1.0)) - 0.5) * 0.08 * blockTrigger;
    
    vec3 col = vec3(0.02, 0.01, 0.04);
    
    // Render tubes at multiple depths
    for (int layer = 0; layer < 4; layer++) {
        float depth = 1.0 + float(layer) * 0.5;
        float layerFade = 1.0 - float(layer) * 0.2;
        
        for (int ii = 0; ii < 10; ii++) {
            if (ii >= numTubes) break;
            float idx = float(ii);
            
            float radius = 0.04 + hash_f(idx * 3.0) * 0.03;
            float dd = tubeDist(glitchUV, idx, depth, tt * speed, radius / depth);
            
            // Tube glow
            float glow = 0.015 / (dd + 0.01);
            glow *= layerFade;
            
            // Tube color
            float hue = hash_f(idx * 13.0) + tt * 0.03;
            vec3 tubeCol = 0.5 + 0.5 * cos(TAU * (hue + vec3(0.0, 0.33, 0.67)));
            
            // Pulse along tube
            float pulse = sin(tt * speed * 3.0 + idx * 2.0) * 0.3 + 0.7;
            tubeCol *= pulse;
            
            col += tubeCol * glow * 0.15;
            
            // Core
            float core = smoothstep(radius * 0.3, 0.0, dd);
            col += tubeCol * core * layerFade * 0.8;
        }
    }
    
    // Chromatic aberration
    float chromaAmt = glitch * 0.015;
    col.r += hash2_f(glitchUV * 50.0 + vec2(chromaAmt, 0.0)) * glitch * 0.1;
    col.b += hash2_f(glitchUV * 50.0 - vec2(chromaAmt, 0.0)) * glitch * 0.1;
    
    // Scan lines
    float scanLine = sin(fragCoord.y * 2.0) * 0.5 + 0.5;
    col *= 0.85 + scanLine * 0.15;
    
    // VHS tracking
    float trackingY = mod(uv.y + tt * 0.08, 0.25) / 0.25;
    float tracking = smoothstep(0.0, 0.03, trackingY) * smoothstep(0.1, 0.07, trackingY);
    col = mix(col, col * 0.4, tracking * glitch * 0.5);
    
    // Block color swap
    col = mix(col, col.gbr, blockTrigger * 0.5);
    
    // Noise grain
    float grain = hash2_f(fragCoord.xy + vec2(tt * 50.0));
    col += (grain - 0.5) * 0.06;
    
    // Flicker
    float flicker = 0.92 + 0.08 * sin(tt * 25.0 + hash_f(glitchTime) * 40.0);
    col *= flicker;
    
    // Vignette
    float vig = 1.0 - length(uv) * 0.5;
    col *= max(0.0, vig);
    
    // Energy boost
    float totalEnergy = a + b + c + d + e + f + g;
    col *= 1.0 + totalEnergy * 0.4;
    
    // Bit crush
    float bitDepth = 16.0 - glitch * 8.0;
    col = floor(col * bitDepth) / bitDepth;
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
