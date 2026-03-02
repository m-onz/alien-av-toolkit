// Shader 35: Voronoi Crystal
// Ported from openended/shaders/09-voronoi-crystal.html
// Growing crystal structures with voronoi cells
// a-d = crystal count, e-g = growth speed, h = stripe density

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

#define PI 3.14159265
#define NUM_SEEDS 24

float hash(float n) { return fract(sin(n) * 43758.5453); }
vec2 hash2(float n) { return vec2(hash(n), hash(n + 137.1)); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord.xy / iResolution.xy;
    float aspect = iResolution.x / iResolution.y;
    vec2 p = uv;
    p.x *= aspect;
    
    float t = iTime;
    float growthSpeed = 0.06 + (e + f + g) * 0.04;
    float stripeDensity = 120.0 + h * 100.0;
    int numSeeds = 12 + int((a + b + c + d) * 6.0);
    
    float minDist = 1e6, minDist2 = 1e6;
    int minIdx = 0;
    vec2 minSeed = vec2(0.0);
    
    for (int i = 0; i < NUM_SEEDS; i++) {
        if (i >= numSeeds) break;
        float fi = float(i);
        vec2 base = hash2(fi * 17.31);
        
        float angle = t * 0.15 * (0.3 + hash(fi * 3.7) * 0.5) + fi * 2.39996;
        float radius = 0.02 + 0.03 * hash(fi * 9.1);
        vec2 offset = vec2(cos(angle), sin(angle)) * radius;
        vec2 seed = base * vec2(aspect, 1.0) + offset;
        
        float d = length(p - seed);
        
        if (d < minDist) {
            minDist2 = minDist;
            minDist = d;
            minIdx = i;
            minSeed = seed;
        } else if (d < minDist2) {
            minDist2 = d;
        }
    }
    
    float boundary = minDist2 - minDist;
    float boundaryLine = smoothstep(0.004, 0.0, boundary);
    
    float fi = float(minIdx);
    float orientation = hash(fi * 47.3) * PI;
    
    vec2 rel = p - minSeed;
    float rotX = rel.x * cos(orientation) - rel.y * sin(orientation);
    float rotY = rel.x * sin(orientation) + rel.y * cos(orientation);
    
    float stripe1 = sin(rotX * stripeDensity + t * 0.5) * 0.5 + 0.5;
    float stripe2 = sin((rotX * 0.866 + rotY * 0.5) * stripeDensity - t * 0.3) * 0.5 + 0.5;
    float stripe3 = sin((rotX * 0.866 - rotY * 0.5) * stripeDensity + t * 0.7) * 0.5 + 0.5;
    float crystal = (stripe1 + stripe2 + stripe3) / 3.0;
    crystal = smoothstep(0.3, 0.7, crystal);
    
    float birthTime = fi * 0.3 + hash(fi * 5.3) * 2.0;
    float maxRadius = growthSpeed * max(0.0, t - birthTime);
    float growthFront = smoothstep(maxRadius, maxRadius - 0.02, minDist);
    float frontGlow = smoothstep(maxRadius - 0.005, maxRadius, minDist) * growthFront;
    
    float intensity = (0.4 + 0.4 * crystal) * growthFront;
    intensity += frontGlow * 1.5;
    intensity += boundaryLine * 1.2 * growthFront;
    
    float pulse = sin(boundary * 400.0 - t * 4.0) * 0.5 + 0.5;
    intensity += boundaryLine * pulse * 0.3;
    
    float seedGlow = exp(-minDist * minDist * 6000.0);
    intensity += seedGlow * (0.5 + 0.5 * sin(t * 5.0 + fi));
    
    float totalEnergy = a + b + c + d + e + f + g;
    intensity *= 0.5 + totalEnergy * 0.5;
    
    float vig = 1.0 - 0.3 * length(uv - 0.5);
    intensity *= vig;
    
    vec3 col = vec3(intensity);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
