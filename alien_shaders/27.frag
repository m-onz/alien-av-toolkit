// Shader 27: Domain Warp Fluid
// Ported from openended/shaders/domain-warp-fluid.html
// Triple domain warping creates hypnotic fluid motion
// a-d = warp intensity, e-g = rotation/flow speed, h = scale

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

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 perm(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }

float noise(vec3 p) {
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);
    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);
    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);
    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));
    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);
    return o4.y * d.y + o4.x * (1.0 - d.y);
}

float fbm(vec3 p) {
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 6; i++) {
        v += amp * noise(p);
        p = p * 2.0 + vec3(100.0);
        amp *= 0.5;
    }
    return v;
}

float warpedFbm(vec3 p, float t, float warpAmt) {
    vec3 q = vec3(
        fbm(p + vec3(0.0, 0.0, t * 0.1)),
        fbm(p + vec3(5.2, 1.3, t * 0.12)),
        fbm(p + vec3(2.1, 7.8, t * 0.08))
    );
    vec3 r = vec3(
        fbm(p + warpAmt * q + vec3(1.7, 9.2, t * 0.15)),
        fbm(p + warpAmt * q + vec3(8.3, 2.8, t * 0.13)),
        fbm(p + warpAmt * q + vec3(3.1, 5.7, t * 0.11))
    );
    return fbm(p + warpAmt * r + vec3(t * 0.05));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float warpIntensity = 3.0 + (a + b + c + d) * 2.0;
    float rotSpeed = 0.05 + (e + f + g) * 0.1;
    float scale = 2.0 + h * 3.0;
    
    float angle = t * rotSpeed;
    float cs = cos(angle), sn = sin(angle);
    uv = vec2(uv.x * cs - uv.y * sn, uv.x * sn + uv.y * cs);
    
    vec3 p = vec3(uv * scale, 0.0);
    
    float f1 = warpedFbm(p, t, warpIntensity);
    float f2 = warpedFbm(p + vec3(3.3, 7.7, 1.1), t * 1.1 + 10.0, warpIntensity);
    
    float blend = smoothstep(0.3, 0.7, f1);
    float pattern = mix(f1, f2, blend);
    
    float dx = warpedFbm(p + vec3(0.01, 0.0, 0.0), t, warpIntensity) - 
               warpedFbm(p - vec3(0.01, 0.0, 0.0), t, warpIntensity);
    float dy = warpedFbm(p + vec3(0.0, 0.01, 0.0), t, warpIntensity) - 
               warpedFbm(p - vec3(0.0, 0.01, 0.0), t, warpIntensity);
    float gradient = length(vec2(dx, dy)) * 25.0;
    
    float intensity = pattern * 0.8 + smoothstep(0.4, 1.2, gradient) * 0.3;
    intensity *= 0.5 + 0.5 * f1;
    
    float totalEnergy = a + b + c + d + e + f + g;
    intensity *= 0.6 + totalEnergy * 0.4;
    
    // Linear gradient from warm to cool based on pattern + position
    float gradientPos = uv.y * 0.3 + pattern * 0.7 + t * 0.02;
    vec3 warmCol = vec3(1.0, 0.4, 0.15);
    vec3 midCol = vec3(0.7, 0.2, 0.5);
    vec3 coolCol = vec3(0.15, 0.4, 0.85);
    
    float blend3 = sin(gradientPos * 2.0) * 0.5 + 0.5;
    vec3 gradCol;
    if (blend3 < 0.5) {
        gradCol = mix(warmCol, midCol, blend3 * 2.0);
    } else {
        gradCol = mix(midCol, coolCol, (blend3 - 0.5) * 2.0);
    }
    
    // Add texture variation from the fluid pattern
    vec3 texCol = gradCol * (0.7 + pattern * 0.5);
    
    // Highlight edges with brighter tones
    texCol += gradCol * gradient * 0.3;
    
    vec3 col = texCol * intensity * 1.5;
    
    // Tone mapping
    col = col / (1.0 + col);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
