// Shader 34: Morphogenetic Mesh
// Ported from openended/shaders/morpho-mesh.html
// Raymarched organic organism with branching tentacles
// a-d = branch count, e-g = breathing/pulse, h = complexity

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
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.03;
        a *= 0.48;
    }
    return v;
}

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float organism(vec3 p, float t, float branchCount, float breathAmt, float complexity) {
    float breath = 1.0 + breathAmt * sin(t * 0.5);
    
    float body = length(p) - 0.7 * breath;
    body += fbm(p * 2.0 + t * 0.1) * 0.15 * complexity;
    
    float branches = 1e10;
    int numBranches = int(branchCount);
    for (int i = 0; i < 8; i++) {
        if (i >= numBranches) break;
        float fi = float(i);
        float a1 = fi * 1.047 + t * 0.15;
        float a2 = sin(t * 0.2 + fi * 1.5) * 0.4;
        vec3 dir = vec3(cos(a1) * cos(a2), sin(a2), sin(a1) * cos(a2));
        
        float growth = 0.5 + 0.5 * sin(t * 0.3 + fi);
        for (float seg = 0.0; seg < 3.0; seg++) {
            float segT = seg / 3.0 * growth * 1.8;
            vec3 segCenter = dir * segT;
            segCenter += vec3(
                sin(segT * 3.0 + t * 0.5 + fi) * 0.12,
                cos(segT * 2.5 + t * 0.4 + fi) * 0.1,
                sin(segT * 2.0 + t * 0.3) * 0.08
            );
            float radius = 0.12 * (1.0 - segT * 0.3) * breath;
            radius += sin(segT * 8.0 - t * 2.0) * 0.02;
            float seg_d = length(p - segCenter) - max(radius, 0.02);
            branches = smin(branches, seg_d, 0.15);
        }
    }
    
    return smin(body, branches, 0.25);
}

vec3 calcNormal(vec3 p, float t, float bc, float ba, float cx) {
    vec2 e = vec2(0.002, 0.0);
    return normalize(vec3(
        organism(p + e.xyy, t, bc, ba, cx) - organism(p - e.xyy, t, bc, ba, cx),
        organism(p + e.yxy, t, bc, ba, cx) - organism(p - e.yxy, t, bc, ba, cx),
        organism(p + e.yyx, t, bc, ba, cx) - organism(p - e.yyx, t, bc, ba, cx)
    ));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float branchCount = 4.0 + (a + b + c + d) * 2.0;
    float breathAmt = 0.1 + (e + f + g) * 0.15;
    float complexity = 0.5 + h * 1.0;
    
    float ca = t * 0.2;
    float cb = sin(t * 0.15) * 0.25;
    vec3 ro = vec3(sin(ca) * cos(cb), sin(cb), cos(ca) * cos(cb)) * 3.2;
    vec3 ta = vec3(0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.5 * ww);
    
    float totalDist = 0.0;
    bool hit = false;
    vec3 p;
    
    for (int i = 0; i < 70; i++) {
        p = ro + rd * totalDist;
        float dist = organism(p, t, branchCount, breathAmt, complexity);
        if (dist < 0.002) { hit = true; break; }
        if (totalDist > 12.0) break;
        totalDist += dist * 0.8;
    }
    
    float intensity = 0.0;
    
    if (hit) {
        vec3 n = calcNormal(p, t, branchCount, breathAmt, complexity);
        vec3 light = normalize(vec3(1.0, 2.0, 1.0));
        float diff = max(0.0, dot(n, light));
        float fresnel = pow(1.0 - abs(dot(-rd, n)), 3.0);
        float spec = pow(max(0.0, dot(reflect(rd, n), light)), 32.0);
        
        intensity = diff * 0.6 + spec * 0.3 + fresnel * 0.2 + 0.15;
        
        float pulse = sin(length(p) * 6.0 - t * 2.5) * 0.5 + 0.5;
        intensity += pulse * 0.1;
    }
    
    float glow = exp(-organism(ro + rd * min(totalDist, 4.0), t, branchCount, breathAmt, complexity) * 3.0) * 0.1;
    intensity += glow;
    
    float totalEnergy = a + b + c + d + e + f + g;
    intensity *= 0.6 + totalEnergy * 0.4;
    
    vec3 col = vec3(intensity);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
