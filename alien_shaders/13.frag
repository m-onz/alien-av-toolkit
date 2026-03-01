// Shader 13: Metallic Blob Wobbler
// Bang-triggered fluid metallic blob that wobbles and compounds effects
// Designed for drum triggers - bangs accumulate wobble/displacement energy
//
// a = bang envelope 1 (main wobble trigger)
// b = bang envelope 2 (expansion trigger)
// c = bang envelope 3 (texture displacement trigger)
// d = blob smoothness / metaball blend
// e = metallic reflectivity
// f = wobble decay rate
// g = base color hue
// h = environment rotation speed

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

// ============================================================================
// UTILITIES
// ============================================================================

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float hash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

vec3 hsv2rgb(float h, float s, float v) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(vec3(h) + K.xyz) * 6.0 - K.www);
    return v * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), s);
}

// ============================================================================
// NOISE
// ============================================================================

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float n = i.x + i.y * 57.0 + 113.0 * i.z;
    return mix(
        mix(mix(hash(vec3(n, 0.0, 0.0)), hash(vec3(n + 1.0, 0.0, 0.0)), f.x),
            mix(hash(vec3(n + 57.0, 0.0, 0.0)), hash(vec3(n + 58.0, 0.0, 0.0)), f.x), f.y),
        mix(mix(hash(vec3(n + 113.0, 0.0, 0.0)), hash(vec3(n + 114.0, 0.0, 0.0)), f.x),
            mix(hash(vec3(n + 170.0, 0.0, 0.0)), hash(vec3(n + 171.0, 0.0, 0.0)), f.x), f.y),
        f.z
    );
}

float fbm(vec3 p, int octaves) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        v += a * noise(p);
        p = p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

// ============================================================================
// SDF PRIMITIVES
// ============================================================================

float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdEllipsoid(vec3 p, vec3 r) {
    float k0 = length(p / r);
    float k1 = length(p / (r * r));
    return k0 * (k0 - 1.0) / k1;
}

// Smooth minimum for metaball blending
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// ============================================================================
// ENERGY ACCUMULATOR
// Simulates compounding effect of rapid bangs
// ============================================================================

float accumulateEnergy(float bang, float t, float decayRate) {
    // Energy builds up with bangs and decays over time
    // Multiple rapid bangs compound the effect
    float energy = bang;
    
    // Add resonance - energy "rings" after bang
    float resonance = bang * sin(t * 15.0) * exp(-t * decayRate * 0.5);
    energy += abs(resonance) * 0.3;
    
    return energy;
}

// ============================================================================
// METALLIC BLOB SDF
// ============================================================================

float mapBlob(vec3 p, float wobbleEnergy, float expandEnergy, float dispEnergy, float smoothness, float t) {
    // Base blob - multiple metaballs
    float d = 1e10;
    
    // Center blob
    float baseSize = 0.5 + expandEnergy * 0.3;
    
    // Wobble displacement
    vec3 wobble = vec3(0.0);
    if (wobbleEnergy > 0.01) {
        float wobbleFreq = 3.0 + wobbleEnergy * 5.0;
        float wobbleAmp = wobbleEnergy * 0.2;
        wobble.x = sin(p.y * wobbleFreq + t * 8.0) * wobbleAmp;
        wobble.y = sin(p.z * wobbleFreq + t * 7.0) * wobbleAmp;
        wobble.z = sin(p.x * wobbleFreq + t * 9.0) * wobbleAmp;
    }
    
    // Texture displacement using noise
    vec3 disp = vec3(0.0);
    if (dispEnergy > 0.01) {
        float noiseScale = 2.0 + dispEnergy * 3.0;
        float noiseAmp = dispEnergy * 0.15;
        disp = vec3(
            fbm(p * noiseScale + t * 0.5, 3) - 0.5,
            fbm(p * noiseScale + 100.0 + t * 0.5, 3) - 0.5,
            fbm(p * noiseScale + 200.0 + t * 0.5, 3) - 0.5
        ) * noiseAmp;
    }
    
    vec3 pDisp = p + wobble + disp;
    
    // Main center blob
    d = sdSphere(pDisp, baseSize);
    
    // Orbiting smaller blobs
    float blobSmooth = mix(0.1, 0.4, smoothness);
    
    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float angle = fi * TAU / 5.0 + t * 0.5;
        float radius = 0.4 + sin(t * 2.0 + fi) * 0.1;
        radius += expandEnergy * 0.2;
        
        vec3 blobPos = vec3(
            cos(angle) * radius,
            sin(angle * 0.7 + t) * 0.2,
            sin(angle) * radius
        );
        
        float blobSize = 0.15 + sin(t * 3.0 + fi * 2.0) * 0.05;
        blobSize += wobbleEnergy * 0.1;
        
        d = smin(d, sdSphere(pDisp - blobPos, blobSize), blobSmooth);
    }
    
    // Top and bottom accent blobs
    float topSize = 0.2 + wobbleEnergy * 0.15;
    d = smin(d, sdSphere(pDisp - vec3(0.0, baseSize * 0.8, 0.0), topSize), blobSmooth);
    d = smin(d, sdSphere(pDisp - vec3(0.0, -baseSize * 0.8, 0.0), topSize), blobSmooth);
    
    return d;
}

// Calculate normal
vec3 calcNormal(vec3 p, float wobbleEnergy, float expandEnergy, float dispEnergy, float smoothness, float t) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        mapBlob(p + e.xyy, wobbleEnergy, expandEnergy, dispEnergy, smoothness, t) - 
        mapBlob(p - e.xyy, wobbleEnergy, expandEnergy, dispEnergy, smoothness, t),
        mapBlob(p + e.yxy, wobbleEnergy, expandEnergy, dispEnergy, smoothness, t) - 
        mapBlob(p - e.yxy, wobbleEnergy, expandEnergy, dispEnergy, smoothness, t),
        mapBlob(p + e.yyx, wobbleEnergy, expandEnergy, dispEnergy, smoothness, t) - 
        mapBlob(p - e.yyx, wobbleEnergy, expandEnergy, dispEnergy, smoothness, t)
    ));
}

// ============================================================================
// ENVIRONMENT / REFLECTION
// ============================================================================

vec3 envMap(vec3 rd, float t, float hue, float envSpeed) {
    // Rotating environment for metallic reflections
    float angle = t * envSpeed;
    float c = cos(angle), s = sin(angle);
    rd.xz = vec2(rd.x * c - rd.z * s, rd.x * s + rd.z * c);
    
    // Gradient sky
    vec3 col = vec3(0.0);
    
    // Horizon gradient
    float horizon = smoothstep(-0.2, 0.5, rd.y);
    vec3 skyColor = hsv2rgb(hue, 0.3, 0.8);
    vec3 groundColor = hsv2rgb(hue + 0.5, 0.4, 0.1);
    col = mix(groundColor, skyColor, horizon);
    
    // Bright bands for interesting reflections
    float bands = sin(rd.y * 10.0 + rd.x * 5.0) * 0.5 + 0.5;
    bands = pow(bands, 4.0);
    col += vec3(1.0) * bands * 0.3;
    
    // Accent lights
    float light1 = pow(max(dot(rd, normalize(vec3(1.0, 0.5, 0.5))), 0.0), 32.0);
    float light2 = pow(max(dot(rd, normalize(vec3(-0.5, 0.3, -1.0))), 0.0), 16.0);
    col += hsv2rgb(hue + 0.1, 0.5, 1.0) * light1;
    col += hsv2rgb(hue + 0.6, 0.6, 0.8) * light2;
    
    return col;
}

// ============================================================================
// MAIN
// ============================================================================

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Parameters
    float bang1 = a;  // Wobble trigger
    float bang2 = b;  // Expansion trigger
    float bang3 = c;  // Displacement trigger
    float smoothness = d;
    float metallic = mix(0.3, 1.0, e);
    float decayRate = mix(1.0, 8.0, f);
    float hue = g;
    float envSpeed = mix(0.1, 1.0, h);
    
    float t = iTime;
    
    // Accumulate energies from bangs
    float wobbleEnergy = accumulateEnergy(bang1, t, decayRate);
    float expandEnergy = accumulateEnergy(bang2, t, decayRate * 0.7);
    float dispEnergy = accumulateEnergy(bang3, t, decayRate * 0.5);
    
    // Total energy for compound effects
    float totalEnergy = wobbleEnergy + expandEnergy + dispEnergy;
    
    // Camera setup
    vec3 ro = vec3(0.0, 0.0, -2.5);
    vec3 rd = normalize(vec3(uv, 1.0));
    
    // Slight camera shake on high energy
    if (totalEnergy > 0.5) {
        float shake = (totalEnergy - 0.5) * 0.02;
        ro.xy += vec2(sin(t * 50.0), cos(t * 47.0)) * shake;
    }
    
    // Raymarching
    float totalDist = 0.0;
    float minDist = 1e10;
    vec3 col = vec3(0.0);
    bool hit = false;
    vec3 hitPos;
    
    for (int i = 0; i < 96; i++) {
        vec3 p = ro + rd * totalDist;
        float d = mapBlob(p, wobbleEnergy, expandEnergy, dispEnergy, smoothness, t);
        
        minDist = min(minDist, d);
        
        if (d < 0.001) {
            hit = true;
            hitPos = p;
            break;
        }
        
        totalDist += d * 0.8;
        if (totalDist > 10.0) break;
    }
    
    if (hit) {
        // Calculate normal
        vec3 n = calcNormal(hitPos, wobbleEnergy, expandEnergy, dispEnergy, smoothness, t);
        
        // View direction
        vec3 v = normalize(ro - hitPos);
        
        // Reflection
        vec3 r = reflect(-v, n);
        
        // Fresnel
        float fresnel = pow(1.0 - max(dot(n, v), 0.0), 5.0);
        fresnel = mix(0.04, 1.0, fresnel);
        
        // Base color
        vec3 baseColor = hsv2rgb(hue, 0.6, 0.3);
        
        // Environment reflection
        vec3 envColor = envMap(r, t, hue, envSpeed);
        
        // Metallic blend
        col = mix(baseColor, envColor, metallic * fresnel);
        
        // Specular highlights
        vec3 lightDir = normalize(vec3(1.0, 1.0, -0.5));
        float spec = pow(max(dot(r, lightDir), 0.0), 64.0);
        col += vec3(1.0) * spec * metallic;
        
        // Secondary light
        vec3 lightDir2 = normalize(vec3(-0.5, 0.5, -1.0));
        float spec2 = pow(max(dot(r, lightDir2), 0.0), 32.0);
        col += hsv2rgb(hue + 0.3, 0.5, 1.0) * spec2 * 0.5;
        
        // Rim light
        float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        col += hsv2rgb(hue + 0.5, 0.7, 1.0) * rim * 0.3;
        
        // Energy glow
        col += hsv2rgb(hue, 0.8, 1.0) * totalEnergy * 0.2;
        
    } else {
        // Background with glow from blob proximity
        float glow = exp(-minDist * 3.0);
        col = hsv2rgb(hue, 0.5, 0.05);
        col += hsv2rgb(hue, 0.7, 0.5) * glow * 0.3;
    }
    
    // Flash on bang
    col += vec3(0.2, 0.25, 0.3) * bang1 * 0.4;
    col += vec3(0.25, 0.2, 0.2) * bang2 * 0.3;
    col += vec3(0.2, 0.2, 0.25) * bang3 * 0.2;
    
    // Vignette
    vec2 vc = fragCoord / iResolution.xy * 2.0 - 1.0;
    col *= 1.0 - dot(vc, vc) * 0.25;
    
    // Tone mapping
    col = col / (col + 1.0);
    col = pow(col, vec3(0.9));
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
