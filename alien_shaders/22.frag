// Shader 22: Wobbly 3D Tubes
// Raymarched flexible tubes twisting through space
// a-d = wobble intensity, e-g = animation speed, h = tube count

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
#define MAX_STEPS 60
#define MAX_DIST 12.0
#define SURF_DIST 0.01

float hash_f(float nn) { return fract(sin(nn) * 43758.5453); }

// Tube path - wobbly curve through space
vec3 tubePath(float tubeIdx, float zz, float tt, float wobble) {
    float phase = tubeIdx * 2.3;
    float freq = 0.8 + hash_f(tubeIdx * 7.0) * 0.4;
    return vec3(
        sin(zz * freq + tt + phase) * (0.8 + wobble * 0.5),
        cos(zz * freq * 0.7 + tt * 0.8 + phase * 1.3) * (0.6 + wobble * 0.4),
        zz
    );
}

// Distance to a single tube
float tubeSDF(vec3 pp, float tubeIdx, float tt, float wobble, float radius) {
    float minDist = 1e10;
    
    // Sample along tube path
    for (int ii = 0; ii < 8; ii++) {
        float zz = pp.z + float(ii) * 0.3 - 1.2;
        vec3 tubePos = tubePath(tubeIdx, zz, tt, wobble);
        
        // Distance to tube segment
        vec3 diff = pp - tubePos;
        diff.z = 0.0; // Only XY distance
        float dd = length(diff) - radius;
        minDist = min(minDist, dd);
    }
    
    return minDist;
}

// Scene SDF - multiple tubes
float sceneSDF(vec3 pp, float tt, float wobble, int numTubes) {
    float dd = 1e10;
    float radius = 0.12;
    
    for (int ii = 0; ii < 6; ii++) {
        if (ii >= numTubes) break;
        float tubeIdx = float(ii);
        dd = min(dd, tubeSDF(pp, tubeIdx, tt, wobble, radius));
    }
    
    return dd;
}

// Get tube index at hit point
float getTubeIdx(vec3 pp, float tt, float wobble, int numTubes) {
    float minDist = 1e10;
    float hitIdx = 0.0;
    float radius = 0.12;
    
    for (int ii = 0; ii < 6; ii++) {
        if (ii >= numTubes) break;
        float tubeIdx = float(ii);
        float dd = tubeSDF(pp, tubeIdx, tt, wobble, radius);
        if (dd < minDist) {
            minDist = dd;
            hitIdx = tubeIdx;
        }
    }
    
    return hitIdx;
}

vec3 getNormal(vec3 pp, float tt, float wobble, int numTubes) {
    float eps = 0.01;
    float dd = sceneSDF(pp, tt, wobble, numTubes);
    return normalize(vec3(
        sceneSDF(pp + vec3(eps, 0.0, 0.0), tt, wobble, numTubes) - dd,
        sceneSDF(pp + vec3(0.0, eps, 0.0), tt, wobble, numTubes) - dd,
        sceneSDF(pp + vec3(0.0, 0.0, eps), tt, wobble, numTubes) - dd
    ));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float tt = iTime;
    
    float wobble = 0.5 + (a + b + c + d) * 0.8;
    float speed = 0.5 + (e + f + g) * 0.8;
    int numTubes = 3 + int(h * 3.0);
    
    // Camera setup - moving through tubes
    float camZ = tt * speed * 2.0;
    vec3 ro = vec3(0.0, 0.0, camZ);
    vec3 rd = normalize(vec3(uv, 1.0));
    
    // Raymarch
    float totalDist = 0.0;
    float dd = 0.0;
    vec3 pp = ro;
    
    for (int ii = 0; ii < MAX_STEPS; ii++) {
        pp = ro + rd * totalDist;
        dd = sceneSDF(pp, tt, wobble, numTubes);
        totalDist += dd * 0.8;
        if (dd < SURF_DIST || totalDist > MAX_DIST) break;
    }
    
    vec3 col = vec3(0.02, 0.01, 0.03);
    
    if (dd < SURF_DIST) {
        vec3 nn = getNormal(pp, tt, wobble, numTubes);
        float tubeIdx = getTubeIdx(pp, tt, wobble, numTubes);
        
        // Tube color based on index
        float hue = hash_f(tubeIdx * 13.0) + tt * 0.05;
        vec3 tubeCol = 0.5 + 0.5 * cos(TAU * (hue + vec3(0.0, 0.33, 0.67)));
        
        // Lighting
        vec3 lightDir = normalize(vec3(0.5, 0.8, -0.3));
        float diff = max(0.0, dot(nn, lightDir)) * 0.6 + 0.4;
        
        // Specular
        vec3 viewDir = -rd;
        vec3 halfDir = normalize(lightDir + viewDir);
        float spec = pow(max(0.0, dot(nn, halfDir)), 32.0);
        
        // Fresnel rim
        float fresnel = pow(1.0 - max(0.0, dot(nn, viewDir)), 3.0);
        
        col = tubeCol * diff;
        col += vec3(1.0, 0.95, 0.9) * spec * 0.5;
        col += tubeCol * fresnel * 0.3;
        
        // Depth fade
        float depth = 1.0 - totalDist / MAX_DIST;
        col *= depth;
    }
    
    // Glow from tubes
    float glow = 1.0 / (1.0 + totalDist * 0.5);
    col += vec3(0.1, 0.05, 0.15) * glow * 0.3;
    
    // Energy boost
    float totalEnergy = a + b + c + d + e + f + g;
    col *= 0.8 + totalEnergy * 0.4;
    
    // Tone mapping
    col = col / (1.0 + col * 0.4);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
