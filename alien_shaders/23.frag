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
    // Sin-based displacement — no noise lookups, still organic-looking
    vec3 disp = vec3(
        sin(p.y * 2.3 + p.z * 1.7 + t * 0.5) + sin(p.z * 4.1 + t * 0.3) * 0.3,
        sin(p.z * 2.1 + p.x * 1.9 + t * 0.4) + sin(p.x * 3.7 + t * 0.35) * 0.3,
        sin(p.x * 2.5 + p.y * 1.3 + t * 0.6) + sin(p.y * 3.3 + t * 0.25) * 0.3
    ) * deform * 0.4;
    return gridSDF(p + disp, spacing, 0.02);
}

vec3 calcNormal(vec3 p, float t, float spacing, float deform) {
    float ep = 0.006;
    vec3 n = vec3(0.0);
    vec3 e;
    e = vec3( 1, -1, -1); n += e * scene(p + e * ep, t, spacing, deform);
    e = vec3(-1, -1,  1); n += e * scene(p + e * ep, t, spacing, deform);
    e = vec3(-1,  1, -1); n += e * scene(p + e * ep, t, spacing, deform);
    e = vec3( 1,  1,  1); n += e * scene(p + e * ep, t, spacing, deform);
    return normalize(n);
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
    
    for (int i = 0; i < 40; i++) {
        p = ro + rd * totalDist;
        float dist = scene(p, t, spacing, deform);
        if (dist < 0.005) { hit = true; break; }
        if (totalDist > 6.0) break;
        totalDist += dist;
    }
    
    vec3 col = vec3(0.0);
    
    if (hit) {
        vec3 n = calcNormal(p, t, spacing, deform);
        vec3 light1 = vec3(0.37139, 0.74278, 0.55709); // precomputed normalize(1,2,1.5)

        float diff = max(0.0, dot(n, light1));

        vec3 refl = reflect(rd, n);
        float spec = pow(max(0.0, dot(refl, light1)), 48.0);

        float fresnel = pow(1.0 - max(0.0, dot(-rd, n)), 3.0);

        // Iridescent color based on position and normal
        vec3 iridescence = 0.5 + 0.5 * cos(6.28318 * (dot(n, p) * 2.0 + t * 0.1 + vec3(0.0, 0.33, 0.67)));

        // Metallic base shifting with position
        float posPhase = dot(p, vec3(0.3, 0.2, 0.1)) + t * 0.03;
        vec3 metalColor = 0.5 + 0.5 * cos(6.28318 * (posPhase + vec3(0.0, 0.15, 0.3)));

        vec3 gradientCol = mix(vec3(0.25, 0.5, 1.0), vec3(1.0, 0.45, 0.25), n.y * 0.5 + 0.5);

        vec3 baseCol = mix(metalColor, gradientCol, 0.35);
        baseCol = mix(baseCol, iridescence, fresnel * 0.5);

        col = baseCol * (diff * 0.6 + 0.15);
        col += mix(baseCol, vec3(1.0), 0.6) * spec * 0.5;
        col += iridescence * fresnel * 0.25;

        // Depth fog
        col *= exp(-totalDist * 0.2);
    }
    
    // Background gradient
    vec3 bgCol = mix(vec3(0.02, 0.01, 0.04), vec3(0.04, 0.02, 0.06), uv.y * 0.5 + 0.5);
    col = mix(bgCol, col, hit ? 1.0 : 0.0);
    
    float totalEnergy = a + b + c + d + e + f + g;
    col *= 0.7 + totalEnergy * 0.3;
    
    col = col / (1.0 + col);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
