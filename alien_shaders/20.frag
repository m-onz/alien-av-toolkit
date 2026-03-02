// Shader 20: Shiny Displaced Sphere
// Raymarched sphere with vertex displacement and metallic shading
// a-d = displacement intensity, e-g = rotation speed
// h = surface roughness (0 = mirror, 1 = matte)

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

float displacedSphere(vec3 p, float t, float dispAmt) {
    float r = length(p);
    vec3 n = p / max(r, 0.001);
    float disp = fbm(n * 3.0 + t * 0.3) * dispAmt;
    disp += sin(n.x * 8.0 + t) * sin(n.y * 7.0 - t * 0.7) * sin(n.z * 9.0 + t * 0.5) * dispAmt * 0.3;
    return r - 0.8 - disp;
}

vec3 calcNormal(vec3 p, float t, float dispAmt) {
    vec2 e = vec2(0.002, 0.0);
    return normalize(vec3(
        displacedSphere(p + e.xyy, t, dispAmt) - displacedSphere(p - e.xyy, t, dispAmt),
        displacedSphere(p + e.yxy, t, dispAmt) - displacedSphere(p - e.yxy, t, dispAmt),
        displacedSphere(p + e.yyx, t, dispAmt) - displacedSphere(p - e.yyx, t, dispAmt)
    ));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float dispAmt = 0.1 + (a + b + c + d) * 0.15;
    float rotSpeed = 0.2 + (e + f + g) * 0.3;
    float roughness = 0.1 + h * 0.5;
    
    float camAngle = t * rotSpeed;
    vec3 ro = vec3(sin(camAngle) * 2.5, 0.5 * sin(t * 0.15), cos(camAngle) * 2.5);
    vec3 ta = vec3(0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.5 * ww);
    
    float totalDist = 0.0;
    bool hit = false;
    vec3 p;
    
    for (int i = 0; i < 60; i++) {
        p = ro + rd * totalDist;
        float dist = displacedSphere(p, t, dispAmt);
        if (dist < 0.002) { hit = true; break; }
        if (totalDist > 10.0) break;
        totalDist += dist * 0.7;
    }
    
    vec3 col = vec3(0.0);
    
    if (hit) {
        vec3 n = calcNormal(p, t, dispAmt);
        vec3 light1 = normalize(vec3(1.0, 2.0, 1.5));
        vec3 light2 = normalize(vec3(-1.0, 0.5, -0.5));
        
        float diff1 = max(0.0, dot(n, light1));
        float diff2 = max(0.0, dot(n, light2)) * 0.3;
        
        vec3 refl = reflect(rd, n);
        float spec1 = pow(max(0.0, dot(refl, light1)), 32.0 / (roughness + 0.1));
        float spec2 = pow(max(0.0, dot(refl, light2)), 16.0 / (roughness + 0.1)) * 0.5;
        
        float fresnel = pow(1.0 - max(0.0, dot(-rd, n)), 3.0);
        
        float envRefl = fbm(refl * 2.0 + t * 0.1) * 0.5 + 0.5;
        
        // Iridescent color based on view angle and surface normal
        float iridAngle = dot(n, -rd);
        vec3 iridescence = 0.5 + 0.5 * cos(6.28318 * (iridAngle * 2.0 + vec3(0.0, 0.33, 0.67) + t * 0.1));
        
        // Metallic base color shifting with position
        vec3 metalColor = 0.5 + 0.5 * cos(6.28318 * (p.x * 0.5 + p.y * 0.3 + vec3(0.0, 0.1, 0.2) + t * 0.05));
        
        // Warm/cool gradient based on surface orientation
        vec3 warmCol = vec3(1.0, 0.4, 0.2);
        vec3 coolCol = vec3(0.2, 0.5, 0.9);
        vec3 gradientCol = mix(coolCol, warmCol, n.y * 0.5 + 0.5);
        
        // Blend metallic colors
        vec3 baseCol = mix(metalColor, gradientCol, 0.4);
        baseCol = mix(baseCol, iridescence, fresnel * 0.6);
        
        // Lighting
        col = baseCol * (diff1 * 0.5 + diff2 * 0.2 + 0.15);
        
        // Specular highlights (white-ish for metallic look)
        vec3 specCol = mix(baseCol, vec3(1.0), 0.7);
        col += specCol * (spec1 + spec2) * (1.0 - roughness) * 0.5;
        
        // Fresnel rim with color
        col += iridescence * fresnel * envRefl * (1.0 - roughness) * 0.3;
    }
    
    float totalEnergy = a + b + c + d + e + f + g;
    col *= 0.7 + totalEnergy * 0.3;
    
    // Tone mapping
    col = col / (1.0 + col);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
