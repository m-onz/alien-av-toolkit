// Shader 36: Tube Network System
// Tiny flowing tubes with color and visual feedback trails
// a-d = tube density, e-g = flow speed, h = tube thickness

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

float noise_f(vec2 pp) {
    vec2 ii = floor(pp);
    vec2 ff = fract(pp);
    ff = ff * ff * (3.0 - 2.0 * ff);
    return mix(mix(hash2_f(ii), hash2_f(ii + vec2(1.0, 0.0)), ff.x),
               mix(hash2_f(ii + vec2(0.0, 1.0)), hash2_f(ii + vec2(1.0, 1.0)), ff.x), ff.y);
}

vec2 getTubePoint(float fi, float pathT, float tt) {
    float phase1 = fi * 1.7 + pathT * TAU + tt * 0.8;
    float phase2 = fi * 2.3 + pathT * TAU * 0.7 + tt * 0.6;
    return vec2(
        sin(phase1) * (0.3 + pathT * 0.4) + sin(phase2 * 2.0) * 0.1,
        cos(phase1 * 0.8 + fi) * (0.3 + pathT * 0.35) + cos(phase2 * 1.5) * 0.1
    );
}

float tubeDist(vec2 uv, float fi, float tt, float thickness) {
    float minDist = 1e10;
    
    for (int seg = 0; seg < 8; seg++) {
        float t1 = float(seg) / 8.0;
        float t2 = float(seg + 1) / 8.0;
        
        vec2 p1 = getTubePoint(fi, t1, tt);
        vec2 p2 = getTubePoint(fi, t2, tt);
        
        vec2 pa = uv - p1;
        vec2 ba = p2 - p1;
        float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        float dd = length(pa - ba * hh);
        
        minDist = min(minDist, dd);
    }
    
    return minDist - thickness;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float tt = iTime;
    
    float density = a + b + c + d;
    float flowSpeed = 0.5 + (e + f + g) * 0.8;
    float thickness = 0.008 + h * 0.015;
    
    int numTubes = 8 + int(density * 8.0);
    
    vec3 col = vec3(0.0);
    float totalTube = 0.0;
    vec3 tubeColorAccum = vec3(0.0);
    float trailAccum = 0.0;
    vec3 trailColorAccum = vec3(0.0);
    
    for (int ii = 0; ii < 12; ii++) {
        if (ii >= numTubes) break;
        float fi = float(ii);
        
        // Current tube
        float dist = tubeDist(uv, fi, tt, thickness);
        float tube = smoothstep(0.004, 0.0, dist);
        
        // Flow pulse along tube
        float flowPhase = tt * flowSpeed * 2.0 + fi * 0.5;
        float pulse = sin(flowPhase * 5.0) * 0.3 + 0.7;
        vec3 tubeCol = vec3(pulse);
        
        totalTube += tube;
        tubeColorAccum += tubeCol * tube;
        
        // Trail/feedback - render past positions (fewer trails)
        for (int trail = 1; trail < 4; trail++) {
            float trailT = float(trail) * 0.1;
            float pastTime = tt - trailT;
            float fade = 1.0 - trailT / 0.4;
            fade = fade * fade;
            
            float trailDist = tubeDist(uv, fi, pastTime, thickness * 0.6 * fade);
            float trailTube = smoothstep(0.002, 0.0, trailDist) * fade;
            
            vec3 trailCol = tubeCol * fade * 0.5;
            trailAccum += trailTube;
            trailColorAccum += trailCol * trailTube;
        }
    }
    
    // Combine tubes
    if (totalTube > 0.01) {
        vec3 avgTubeCol = tubeColorAccum / totalTube;
        col += avgTubeCol * min(totalTube, 1.0) * 1.2;
    }
    
    // Combine trails
    if (trailAccum > 0.01) {
        vec3 avgTrailCol = trailColorAccum / trailAccum;
        col += avgTrailCol * min(trailAccum, 1.0) * 0.5;
    }
    
    // === GLITCH EFFECTS ===
    float glitchTime = floor(tt * 4.0);
    float corruption = density * 0.3;
    
    // Horizontal tear
    float tearY = hash_f(glitchTime * 7.0) * 2.0 - 1.0;
    float inTear = smoothstep(0.1, 0.0, abs(uv.y - tearY)) * corruption;
    col += inTear * 0.2;
    
    // Scan lines
    float scanLine = sin(fragCoord.y * 2.0) * 0.5 + 0.5;
    col *= 0.85 + scanLine * 0.15;
    
    // Block glitch
    vec2 blockUV = floor(uv * 10.0);
    float blockGlitch = step(0.92 - corruption * 0.2, hash2_f(blockUV + vec2(glitchTime)));
    col *= 1.0 + blockGlitch * 0.4;
    
    // Noise grain
    float grain = hash2_f(fragCoord.xy + vec2(tt * 100.0)) * 0.1;
    col += grain * corruption;
    
    // Flicker
    float flicker = 0.92 + 0.08 * sin(tt * 25.0 + hash_f(glitchTime) * 50.0);
    col *= flicker;
    
    
    // Energy boost
    float totalEnergy = a + b + c + d + e + f + g;
    col *= 0.6 + totalEnergy * 0.4;
    
    // Bit crush
    float bitDepth = 12.0 - corruption * 6.0;
    col = floor(col * bitDepth) / bitDepth;
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
