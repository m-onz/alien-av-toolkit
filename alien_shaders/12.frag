// Shader 12: Wireframe Primitives Spawner
// Bang-triggered shader - 8 CENTERED wireframe primitives that grow outward
//
// ALL 8 PARAMS (a-h) WORK THE SAME WAY:
// - Send envelope 0->1 to make primitive grow from small to large
// - Each param controls ONE primitive
// - Each primitive has its own random: rotation, type, color
//
// a = primitive 1 envelope (0->1 grows)
// b = primitive 2 envelope
// c = primitive 3 envelope
// d = primitive 4 envelope
// e = primitive 5 envelope
// f = primitive 6 envelope
// g = primitive 7 envelope
// h = primitive 8 envelope

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

vec3 hash3(float p) {
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

vec3 hsv2rgb(float h, float s, float v) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(vec3(h) + K.xyz) * 6.0 - K.www);
    return v * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), s);
}

// ============================================================================
// 3D TRANSFORMS
// ============================================================================

mat3 rotMat(vec3 angles) {
    float cx = cos(angles.x), sx = sin(angles.x);
    float cy = cos(angles.y), sy = sin(angles.y);
    float cz = cos(angles.z), sz = sin(angles.z);
    return mat3(
        cy*cz, sx*sy*cz - cx*sz, cx*sy*cz + sx*sz,
        cy*sz, sx*sy*sz + cx*cz, cx*sy*sz - sx*cz,
        -sy, sx*cy, cx*cy
    );
}

// ============================================================================
// WIREFRAME SDF PRIMITIVES
// ============================================================================

float sdSegment(vec3 p, vec3 a, vec3 b) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

float sdWireCube(vec3 p, float s) {
    float d = 1e10;
    d = min(d, sdSegment(p, vec3(-s,-s,-s), vec3(s,-s,-s)));
    d = min(d, sdSegment(p, vec3(s,-s,-s), vec3(s,-s,s)));
    d = min(d, sdSegment(p, vec3(s,-s,s), vec3(-s,-s,s)));
    d = min(d, sdSegment(p, vec3(-s,-s,s), vec3(-s,-s,-s)));
    d = min(d, sdSegment(p, vec3(-s,s,-s), vec3(s,s,-s)));
    d = min(d, sdSegment(p, vec3(s,s,-s), vec3(s,s,s)));
    d = min(d, sdSegment(p, vec3(s,s,s), vec3(-s,s,s)));
    d = min(d, sdSegment(p, vec3(-s,s,s), vec3(-s,s,-s)));
    d = min(d, sdSegment(p, vec3(-s,-s,-s), vec3(-s,s,-s)));
    d = min(d, sdSegment(p, vec3(s,-s,-s), vec3(s,s,-s)));
    d = min(d, sdSegment(p, vec3(s,-s,s), vec3(s,s,s)));
    d = min(d, sdSegment(p, vec3(-s,-s,s), vec3(-s,s,s)));
    return d;
}

float sdWireTetra(vec3 p, float s) {
    vec3 v0 = vec3(s,s,s), v1 = vec3(s,-s,-s), v2 = vec3(-s,s,-s), v3 = vec3(-s,-s,s);
    float d = sdSegment(p, v0, v1);
    d = min(d, sdSegment(p, v0, v2));
    d = min(d, sdSegment(p, v0, v3));
    d = min(d, sdSegment(p, v1, v2));
    d = min(d, sdSegment(p, v1, v3));
    d = min(d, sdSegment(p, v2, v3));
    return d;
}

float sdWireOcta(vec3 p, float s) {
    vec3 t = vec3(0,s,0), b = vec3(0,-s,0);
    vec3 f = vec3(0,0,s), k = vec3(0,0,-s);
    vec3 r = vec3(s,0,0), l = vec3(-s,0,0);
    float d = sdSegment(p, t, f);
    d = min(d, sdSegment(p, t, k));
    d = min(d, sdSegment(p, t, r));
    d = min(d, sdSegment(p, t, l));
    d = min(d, sdSegment(p, b, f));
    d = min(d, sdSegment(p, b, k));
    d = min(d, sdSegment(p, b, r));
    d = min(d, sdSegment(p, b, l));
    d = min(d, sdSegment(p, f, r));
    d = min(d, sdSegment(p, r, k));
    d = min(d, sdSegment(p, k, l));
    d = min(d, sdSegment(p, l, f));
    return d;
}

float sdWireSphere(vec3 p, float s) {
    float d = 1e10;
    for (float i = 0.0; i < 3.0; i++) {
        float lat = PI * (i + 1.0) / 4.0 - PI * 0.5;
        float r = cos(lat) * s, y = sin(lat) * s;
        for (float j = 0.0; j < 8.0; j++) {
            float a1 = j * TAU / 8.0, a2 = (j + 1.0) * TAU / 8.0;
            d = min(d, sdSegment(p, vec3(cos(a1)*r, y, sin(a1)*r), vec3(cos(a2)*r, y, sin(a2)*r)));
        }
    }
    for (float i = 0.0; i < 4.0; i++) {
        float lon = i * TAU / 4.0;
        for (float j = 0.0; j < 4.0; j++) {
            float lat1 = PI * j / 4.0 - PI * 0.5, lat2 = PI * (j + 1.0) / 4.0 - PI * 0.5;
            d = min(d, sdSegment(p, vec3(cos(lon)*cos(lat1)*s, sin(lat1)*s, sin(lon)*cos(lat1)*s),
                                    vec3(cos(lon)*cos(lat2)*s, sin(lat2)*s, sin(lon)*cos(lat2)*s)));
        }
    }
    return d;
}

// ============================================================================
// MAIN
// ============================================================================

vec3 renderPrimitive(vec2 uv, float env, float chId, float time) {
    // Skip if envelope is too low OR too high (destroy after full size)
    if (env < 0.001 || env > 0.95) return vec3(0.0);
    
    vec3 ro = vec3(0.0, 0.0, -4.0);
    vec3 rd = normalize(vec3(uv, 1.0));
    
    // Random seed per channel (FIXED - no time dependency for stability)
    vec3 rnd = hash3(chId * 137.0 + 42.0);
    
    // Fixed random rotation per channel + slow continuous rotation
    vec3 baseAngles = rnd * TAU;
    vec3 angles = baseAngles + vec3(time * 0.2, time * 0.15, time * 0.1);
    mat3 rot = rotMat(angles);
    
    // Primitive type based on channel (fixed per channel)
    int primType = int(mod(floor(rnd.x * 4.0), 4.0));
    
    // Size grows with envelope - BIGGER max size to go off screen
    float size = 0.05 + env * 5.0;
    float thickness = 0.02;
    
    // Raymarch with smaller steps for solid lines
    float t = 0.0;
    for (int i = 0; i < 48; i++) {
        vec3 p = ro + rd * t;
        vec3 lp = rot * p;
        
        float dist;
        if (primType == 0) dist = sdWireCube(lp, size);
        else if (primType == 1) dist = sdWireTetra(lp, size);
        else if (primType == 2) dist = sdWireOcta(lp, size);
        else dist = sdWireSphere(lp, size);
        
        if (dist < thickness) {
            float hue = rnd.y;
            return hsv2rgb(hue, 0.5, 0.9);
        }
        
        // Smaller steps for solid continuous lines
        t += max(dist * 0.5, 0.02);
        if (t > 12.0) break;
    }
    return vec3(0.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    vec3 col = vec3(0.0);
    col += renderPrimitive(uv, a, 0.0, t);
    col += renderPrimitive(uv, b, 1.0, t);
    col += renderPrimitive(uv, c, 2.0, t);
    col += renderPrimitive(uv, d, 3.0, t);
    col += renderPrimitive(uv, e, 4.0, t);
    col += renderPrimitive(uv, f, 5.0, t);
    col += renderPrimitive(uv, g, 6.0, t);
    col += renderPrimitive(uv, h, 7.0, t);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
