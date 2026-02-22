// Shader 17: OMNIBUS - Ultimate generative shader
// Particles, flocking, magnetism, fluid, smoke, magnification + all noise types
//
// a = PATTERN (particles/flocking/fluid/smoke/noise blend) 
// b = SCALE + MAGNIFICATION (lens distortion at high values)
// c = SPEED + DIRECTION
// d = COMPLEXITY (particle count / octaves)
// e = FORCES (attraction/repulsion/magnetism/turbulence)
// f = STRUCTURE (cells/veins/bands/trails)
// g = HUE + COLOR MODE
// h = OUTPUT (contrast/threshold/invert/glow)
//
// Good defaults: a=0.57 b=0.41 c=0.35 d=0.42 e=0.64 f=0.47 g=0.28 h=0.45

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
    vec3 p3 = fract(vec3(p.xyx) * 0.13);
    p3 += dot(p3, p3.yzx + 3.333);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

vec3 hsv2rgb(float hue, float sat, float val) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 px = abs(fract(vec3(hue) + K.xyz) * 6.0 - K.www);
    return val * mix(K.xxx, clamp(px - K.xxx, 0.0, 1.0), sat);
}

float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    fp = fp * fp * (3.0 - 2.0 * fp);
    float n00 = hash(ip);
    float n10 = hash(ip + vec2(1.0, 0.0));
    float n01 = hash(ip + vec2(0.0, 1.0));
    float n11 = hash(ip + vec2(1.0, 1.0));
    return mix(mix(n00, n10, fp.x), mix(n01, n11, fp.x), fp.y);
}

// ============================================================================
// NOISE TYPES
// ============================================================================

float fbmNoise(vec2 p, float oct) {
    float v = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.877, 0.479, -0.479, 0.877);
    for (int i = 0; i < 8; i++) {
        if (float(i) >= oct) break;
        v += amp * noise(p);
        p = rot * p * 2.0 + 100.0;
        amp *= 0.5;
    }
    return v;
}

float ridgedNoise(vec2 p, float oct) {
    float v = 0.0;
    float amp = 0.5;
    float prev = 1.0;
    mat2 rot = mat2(0.877, 0.479, -0.479, 0.877);
    for (int i = 0; i < 8; i++) {
        if (float(i) >= oct) break;
        float n = 1.0 - abs(noise(p) * 2.0 - 1.0);
        n = n * n;
        v += n * amp * prev;
        prev = n;
        p = rot * p * 2.0;
        amp *= 0.5;
    }
    return v;
}

float turbNoise(vec2 p, float oct) {
    float v = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.877, 0.479, -0.479, 0.877);
    for (int i = 0; i < 8; i++) {
        if (float(i) >= oct) break;
        v += amp * abs(noise(p) * 2.0 - 1.0);
        p = rot * p * 2.0 + 100.0;
        amp *= 0.5;
    }
    return v;
}

// ============================================================================
// PATTERNS & FORCES
// ============================================================================

vec2 voronoiDist(vec2 p) {
    vec2 n = floor(p);
    vec2 fp = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 gg = vec2(float(i), float(j));
            vec2 o = hash2(n + gg);
            vec2 r = gg + o - fp;
            float dist = dot(r, r);
            if (dist < d1) { d2 = d1; d1 = dist; }
            else if (dist < d2) { d2 = dist; }
        }
    }
    return vec2(sqrt(d1), sqrt(d2));
}

vec2 curl(vec2 p, float t) {
    float eps = 0.01;
    float n1 = noise(p + vec2(eps, 0.0) + t);
    float n2 = noise(p - vec2(eps, 0.0) + t);
    float n3 = noise(p + vec2(0.0, eps) + t);
    float n4 = noise(p - vec2(0.0, eps) + t);
    return vec2((n3 - n4), -(n1 - n2)) / (2.0 * eps);
}

// Magnetic field lines
vec2 magneticField(vec2 p, float t, float strength) {
    vec2 pole1 = vec2(sin(t * 0.3) * 0.5, cos(t * 0.4) * 0.3);
    vec2 pole2 = vec2(-sin(t * 0.35) * 0.4, -cos(t * 0.45) * 0.4);
    
    vec2 d1 = p - pole1;
    vec2 d2 = p - pole2;
    float r1 = length(d1) + 0.01;
    float r2 = length(d2) + 0.01;
    
    // Field from positive pole, toward negative
    vec2 field = d1 / (r1 * r1) - d2 / (r2 * r2);
    return field * strength;
}

// Attraction/repulsion force
vec2 attractionForce(vec2 p, float t, float strength) {
    vec2 center = vec2(sin(t * 0.2) * 0.3, cos(t * 0.25) * 0.3);
    vec2 toCenter = center - p;
    float dist = length(toCenter) + 0.1;
    return normalize(toCenter) * strength / dist;
}

// Flocking behavior simulation
float flockingPattern(vec2 p, float t, float count, float forces) {
    float v = 0.0;
    
    for (float i = 0.0; i < 30.0; i++) {
        if (i >= count) break;
        
        // Each "bird" has a base position from hash
        vec2 basePos = hash2(vec2(i * 7.3, i * 11.7)) * 2.0 - 1.0;
        
        // Movement influenced by curl noise (flocking behavior)
        vec2 vel = curl(basePos * 2.0 + t * 0.3, t * 0.5);
        
        // Add attraction toward center (cohesion)
        vec2 toCenter = -basePos;
        vel += toCenter * forces * 0.3;
        
        // Current position
        vec2 pos = basePos + vel * sin(t * 0.5 + i) * 0.5;
        pos += vec2(sin(t * 0.7 + i * 0.5), cos(t * 0.6 + i * 0.7)) * 0.3;
        
        // Distance to this bird
        float dist = length(p - pos);
        
        // Bird as a soft point with trail
        float bird = exp(-dist * 20.0);
        
        // Trail behind bird
        vec2 trailDir = normalize(vel + 0.001);
        float trailDist = dot(p - pos, -trailDir);
        if (trailDist > 0.0) {
            float trailWidth = exp(-abs(dot(p - pos, vec2(-trailDir.y, trailDir.x))) * 30.0);
            bird += trailWidth * exp(-trailDist * 10.0) * 0.3;
        }
        
        v += bird;
    }
    return v;
}

// Particle system
float particleSystem(vec2 p, float t, float count, float forces) {
    float v = 0.0;
    
    for (float i = 0.0; i < 50.0; i++) {
        if (i >= count) break;
        
        vec2 seed = vec2(i * 13.7, i * 17.3);
        vec2 pos = hash2(seed) * 2.0 - 1.0;
        
        // Apply forces
        vec2 vel = curl(pos * 3.0, t) * forces;
        vel += magneticField(pos, t, forces * 0.5);
        vel += attractionForce(pos, t, forces * 0.3);
        
        // Animate
        pos += vel * 0.3;
        pos += vec2(sin(t + i), cos(t * 1.1 + i * 0.7)) * 0.2;
        
        // Wrap
        pos = mod(pos + 1.0, 2.0) - 1.0;
        
        float dist = length(p - pos);
        v += exp(-dist * 30.0);
    }
    return v;
}

// Smoke/fluid simulation
float smokeFluid(vec2 p, float t, float oct, float forces) {
    // Domain warp for fluid motion
    vec2 q = p;
    
    // Apply curl flow
    vec2 c1 = curl(q * 0.5, t * 0.3);
    vec2 c2 = curl(q + c1 * forces, t * 0.5);
    q += c2 * forces * 0.5;
    
    // Magnetic distortion
    q += magneticField(p, t, forces * 0.2);
    
    // Multi-layer FBM
    float smoke = fbmNoise(q * 2.0 + t * 0.2, oct);
    float detail = fbmNoise(q * 4.0 - t * 0.15, max(oct - 2.0, 2.0));
    
    // Rising smoke effect
    float rise = fbmNoise(vec2(q.x * 3.0, q.y * 2.0 - t * 0.5), oct);
    
    return smoke * 0.5 + detail * 0.3 + rise * 0.2;
}

// ============================================================================
// MAIN
// ============================================================================

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // ========== PARAMETERS ==========
    float patternType = a * 5.0;
    float scaleBase = mix(0.5, 8.0, b);
    float magStrength = smoothstep(0.7, 1.0, b) * 2.0; // magnification at high b
    float speed = mix(-0.3, 0.3, c);
    float complexity = mix(5.0, 30.0, d); // particle count
    float oct = mix(3.0, 7.0, d); // octaves for noise
    float forces = mix(0.0, 2.0, e);
    float structAmt = f;
    float hueBase = g;
    float outputMode = h;
    
    float t = iTime * speed;
    
    // ========== MAGNIFICATION / LENS ==========
    vec2 p = uv;
    if (magStrength > 0.01) {
        float dist = length(uv);
        float mag = 1.0 + magStrength * exp(-dist * 3.0);
        p = uv * mag;
        
        // Barrel/pincushion distortion
        float r2 = dot(uv, uv);
        p += uv * r2 * magStrength * 0.5;
    }
    p *= scaleBase;
    
    // ========== FORCE FIELD DISTORTION ==========
    if (forces > 0.1) {
        // Curl flow
        vec2 c1 = curl(p * 0.3, t * 0.5);
        p += c1 * forces * 0.3;
        
        // Magnetic field
        p += magneticField(p * 0.5, t, forces * 0.2);
        
        // Attraction
        p += attractionForce(p * 0.3, t, forces * 0.15);
        
        // Swirl
        float dist = length(p);
        float swirl = forces * 2.0 * exp(-dist * 0.3);
        float cs = cos(swirl);
        float ss = sin(swirl);
        p = vec2(p.x * cs - p.y * ss, p.x * ss + p.y * cs);
    }
    
    // ========== BASE PATTERN ==========
    float v = 0.0;
    float v2 = 0.0;
    vec2 pNorm = p / scaleBase; // normalized for particles
    
    if (patternType < 1.0) {
        // Particles
        v = particleSystem(pNorm, t, complexity, forces);
        v2 = fbmNoise(p * 0.5, 4.0);
    }
    else if (patternType < 2.0) {
        // Flocking birds
        v = flockingPattern(pNorm, t, complexity * 0.5, forces);
        v2 = ridgedNoise(p * 0.3, 4.0);
    }
    else if (patternType < 3.0) {
        // Smoke/fluid
        v = smokeFluid(pNorm, t, oct, forces);
        v2 = turbNoise(p * 0.5, 4.0);
    }
    else if (patternType < 4.0) {
        // Voronoi cells with magnetism
        vec2 vor = voronoiDist(p * mix(2.0, 6.0, fract(patternType)));
        v = vor.x;
        v2 = vor.y - vor.x;
        // Add magnetic field lines
        vec2 mag = magneticField(pNorm, t, 1.0);
        v += length(mag) * 0.2;
    }
    else {
        // Noise blend (fbm/ridged/turb)
        float blend = fract(patternType);
        v = mix(fbmNoise(p + t * 0.1, oct), ridgedNoise(p + t * 0.1, oct), blend);
        v2 = turbNoise(p * 1.5 - t * 0.1, oct);
    }
    
    // Blend between pattern types
    float blend = fract(patternType);
    if (blend > 0.1 && patternType >= 1.0 && patternType < 4.0) {
        float vNext = 0.0;
        if (patternType < 2.0) vNext = flockingPattern(pNorm, t, complexity * 0.5, forces);
        else if (patternType < 3.0) vNext = smokeFluid(pNorm, t, oct, forces);
        else { vec2 vor = voronoiDist(p * 4.0); vNext = vor.x; }
        v = mix(v, vNext, blend * 0.5);
    }
    
    // ========== STRUCTURE ==========
    if (structAmt > 0.02) {
        float structType = structAmt * 4.0;
        vec2 vor = voronoiDist(p * mix(2.0, 8.0, structAmt));
        float edge = vor.y - vor.x;
        float veins = smoothstep(mix(0.15, 0.01, structAmt), 0.0, edge);
        float bands = fract(v * mix(2.0, 10.0, structAmt));
        
        // Trails from magnetic field
        vec2 mag = magneticField(pNorm, t, 1.0);
        float fieldLines = abs(sin(atan(mag.y, mag.x) * 8.0 + length(mag) * 10.0));
        
        if (structType < 1.0) {
            v = mix(v, v * (1.0 - vor.x * 0.4), structType);
        }
        else if (structType < 2.0) {
            v = mix(v, v + veins * 0.3, structType - 1.0);
        }
        else if (structType < 3.0) {
            v = mix(v, v + fieldLines * 0.2, structType - 2.0);
        }
        else {
            v = mix(v, bands, (structType - 3.0) * 0.6);
        }
    }
    
    // ========== COLOR ==========
    v = clamp(v, 0.0, 1.0);
    v2 = clamp(v2, 0.0, 1.0);
    
    float colorMode = hueBase * 4.0;
    vec3 col;
    
    if (colorMode < 1.0) {
        // Monochrome with subtle tint
        float hue = fract(hueBase * 4.0);
        col = hsv2rgb(hue, colorMode * 0.4, v);
    }
    else if (colorMode < 2.0) {
        // Gradient based on value
        float hue = hueBase + v * 0.25;
        col = hsv2rgb(hue, 0.5, v * 0.85 + 0.15);
    }
    else if (colorMode < 3.0) {
        // Two-tone complementary
        float hue1 = hueBase;
        float hue2 = hueBase + 0.5;
        vec3 col1 = hsv2rgb(hue1, 0.65, 0.9);
        vec3 col2 = hsv2rgb(hue2, 0.5, 0.25);
        col = mix(col2, col1, v);
    }
    else {
        // Rainbow spectrum
        float hue = hueBase + v * 0.4 + v2 * 0.15;
        col = hsv2rgb(hue, 0.6, v * 0.75 + 0.25);
    }
    
    // ========== OUTPUT TRANSFORM ==========
    float outType = outputMode * 4.0;
    
    if (outType < 1.0) {
        // Contrast
        float gamma = mix(0.5, 2.0, outType);
        col = pow(col, vec3(gamma));
    }
    else if (outType < 2.0) {
        // Threshold
        float thresh = (outType - 1.0) * 0.6;
        float mask = smoothstep(thresh, thresh + 0.08, v);
        col = col * mask;
    }
    else if (outType < 3.0) {
        // Glow
        float glowAmt = outType - 2.0;
        col += col * col * glowAmt * 2.0;
        col += vec3(1.0) * pow(v, 4.0) * glowAmt;
    }
    else {
        // Invert + desaturate
        float amt = outType - 3.0;
        col = mix(col, 1.0 - col, amt * 0.5);
        float grey = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(grey), amt * 0.5);
    }
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
