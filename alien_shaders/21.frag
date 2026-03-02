// Shader 21: Metallic 3D Grid
// Raymarched rotating grid structure with metallic shading
// a-d = grid deformation, e-g = rotation speed
// h = grid density (0 = sparse, 1 = dense)

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
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, -s, 0, s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, s, 0, 1, 0, -s, 0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, -s, 0, s, c, 0, 0, 0, 1); }

float gridSDF(vec3 p, float spacing, float thickness) {
    vec3 q = mod(p + spacing * 0.5, spacing) - spacing * 0.5;
    float dx = length(q.yz) - thickness;
    float dy = length(q.xz) - thickness;
    float dz = length(q.xy) - thickness;
    return min(min(dx, dy), dz);
}

float scene(vec3 p, float t, float spacing, float deform) {
    // Noise-based deformation
    vec3 disp = vec3(
        fbm(p * 1.5 + t * 0.2) - 0.5,
        fbm(p * 1.5 + vec3(10.0) + t * 0.15) - 0.5,
        fbm(p * 1.5 + vec3(20.0) + t * 0.18) - 0.5
    ) * deform;
    
    return gridSDF(p + disp, spacing, 0.02);
}

vec3 calcNormal(vec3 p, float t, float spacing, float deform) {
    vec2 e = vec2(0.002, 0.0);
    return normalize(vec3(
        scene(p + e.xyy, t, spacing, deform) - scene(p - e.xyy, t, spacing, deform),
        scene(p + e.yxy, t, spacing, deform) - scene(p - e.yxy, t, spacing, deform),
        scene(p + e.yyx, t, spacing, deform) - scene(p - e.yyx, t, spacing, deform)
    ));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float spacing = 0.5 - h * 0.3;
    float deform = 0.1 + (a + b + c + d) * 0.15;
    float rotSpeed = 0.2 + (e + f + g) * 0.3;
    
    // 3D rotation
    mat3 rot = rotY(t * rotSpeed) * rotX(t * rotSpeed * 0.7) * rotZ(t * rotSpeed * 0.3);
    
    vec3 ro = vec3(0.0, 0.0, 3.0);
    vec3 rd = normalize(vec3(uv, -1.5));
    rd = rot * rd;
    ro = rot * ro;
    
    float totalDist = 0.0;
    bool hit = false;
    vec3 p;
    
    for (int i = 0; i < 80; i++) {
        p = ro + rd * totalDist;
        float dist = scene(p, t, spacing, deform);
        if (dist < 0.001) { hit = true; break; }
        if (totalDist > 8.0) break;
        totalDist += dist * 0.8;
    }
    
    vec3 col = vec3(0.0);
    
    if (hit) {
        vec3 n = calcNormal(p, t, spacing, deform);
        vec3 light1 = normalize(vec3(1.0, 2.0, 1.5));
        vec3 light2 = normalize(vec3(-1.0, 0.5, -0.5));
        
        float diff1 = max(0.0, dot(n, light1));
        float diff2 = max(0.0, dot(n, light2)) * 0.3;
        
        vec3 refl = reflect(rd, n);
        float spec1 = pow(max(0.0, dot(refl, light1)), 64.0);
        float spec2 = pow(max(0.0, dot(refl, light2)), 32.0) * 0.5;
        
        float fresnel = pow(1.0 - max(0.0, dot(-rd, n)), 3.0);
        
        // Iridescent color based on position and normal
        vec3 iridescence = 0.5 + 0.5 * cos(6.28318 * (dot(n, p) * 2.0 + t * 0.1 + vec3(0.0, 0.33, 0.67)));
        
        // Metallic base shifting with position
        vec3 metalColor = 0.5 + 0.5 * cos(6.28318 * (p.x * 0.3 + p.y * 0.2 + p.z * 0.1 + vec3(0.0, 0.15, 0.3) + t * 0.03));
        
        // Warm/cool gradient
        vec3 warmCol = vec3(1.0, 0.45, 0.25);
        vec3 coolCol = vec3(0.25, 0.5, 1.0);
        vec3 gradientCol = mix(coolCol, warmCol, n.y * 0.5 + 0.5);
        
        vec3 baseCol = mix(metalColor, gradientCol, 0.35);
        baseCol = mix(baseCol, iridescence, fresnel * 0.5);
        
        col = baseCol * (diff1 * 0.5 + diff2 * 0.2 + 0.15);
        
        vec3 specCol = mix(baseCol, vec3(1.0), 0.6);
        col += specCol * (spec1 + spec2) * 0.5;
        col += iridescence * fresnel * 0.25;
        
        // Depth fog
        float fog = exp(-totalDist * 0.15);
        col *= fog;
    }
    
    // Background gradient
    vec3 bgCol = mix(vec3(0.02, 0.01, 0.04), vec3(0.04, 0.02, 0.06), uv.y * 0.5 + 0.5);
    col = mix(bgCol, col, hit ? 1.0 : 0.0);
    
    float totalEnergy = a + b + c + d + e + f + g;
    col *= 0.7 + totalEnergy * 0.3;
    
    col = col / (1.0 + col);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
