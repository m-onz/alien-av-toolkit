// Shader 14: Metallic Liquid Chaos
// Swirling liquid metal with iridescent reflections
// a-d = chaos intensity, e-g = flow speed, h = metallic sheen

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

float hash2_f(vec2 pp) { return fract(sin(dot(pp, vec2(127.1, 311.7))) * 43758.5453); }

float noise_f(vec2 pp) {
    vec2 ii = floor(pp);
    vec2 ff = fract(pp);
    ff = ff * ff * (3.0 - 2.0 * ff);
    return mix(mix(hash2_f(ii), hash2_f(ii + vec2(1.0, 0.0)), ff.x),
               mix(hash2_f(ii + vec2(0.0, 1.0)), hash2_f(ii + vec2(1.0, 1.0)), ff.x), ff.y);
}

float fbm_f(vec2 pp, int octaves) {
    float vv = 0.0, amp = 0.5;
    for (int ii = 0; ii < 6; ii++) {
        if (ii >= octaves) break;
        vv += amp * noise_f(pp);
        pp *= 2.0;
        amp *= 0.5;
    }
    return vv;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float tt = iTime;
    
    float chaos = 0.5 + (a + b + c + d) * 0.5;
    float speed = 0.3 + (e + f + g) * 0.5;
    float metallic = 0.5 + h * 0.5;
    
    // Domain warping for liquid chaos
    vec2 warp1 = vec2(
        fbm_f(uv * 3.0 + vec2(tt * speed * 0.3), 4),
        fbm_f(uv * 3.0 + vec2(5.0, tt * speed * 0.25), 4)
    ) - 0.5;
    
    vec2 warp2 = vec2(
        fbm_f(uv * 2.0 + warp1 * chaos + vec2(tt * speed * 0.2), 4),
        fbm_f(uv * 2.0 + warp1 * chaos + vec2(3.0, -tt * speed * 0.15), 4)
    ) - 0.5;
    
    vec2 wuv = uv + warp1 * 0.3 * chaos + warp2 * 0.2 * chaos;
    
    // Multi-layer liquid noise
    float n1 = fbm_f(wuv * 4.0 + vec2(tt * speed * 0.1), 5);
    float n2 = fbm_f(wuv * 8.0 - vec2(tt * speed * 0.15), 4);
    float n3 = fbm_f(wuv * 2.0 + vec2(tt * speed * 0.08, -tt * speed * 0.05), 5);
    
    // Combine for liquid surface
    float liquid = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
    
    // Create metallic bands
    float bands = sin(liquid * 20.0 + tt * speed) * 0.5 + 0.5;
    bands = pow(bands, 0.5);
    
    // Fake normal from noise gradient
    float eps = 0.01;
    float nx = fbm_f(wuv * 4.0 + vec2(eps, 0.0) + vec2(tt * speed * 0.1), 4) - 
               fbm_f(wuv * 4.0 - vec2(eps, 0.0) + vec2(tt * speed * 0.1), 4);
    float ny = fbm_f(wuv * 4.0 + vec2(0.0, eps) + vec2(tt * speed * 0.1), 4) - 
               fbm_f(wuv * 4.0 - vec2(0.0, eps) + vec2(tt * speed * 0.1), 4);
    vec3 nn = normalize(vec3(nx * 3.0, ny * 3.0, 1.0));
    
    // Metallic base colors
    vec3 darkMetal = vec3(0.15, 0.12, 0.18);
    vec3 midMetal = vec3(0.4, 0.35, 0.45);
    vec3 lightMetal = vec3(0.8, 0.75, 0.85);
    
    // Build base color
    vec3 col = mix(darkMetal, midMetal, liquid);
    col = mix(col, lightMetal, bands * metallic);
    
    // Specular highlights
    vec3 lightDir = normalize(vec3(0.5, 0.6, 0.8));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(0.0, dot(nn, halfDir)), 32.0);
    col += vec3(1.0, 0.95, 0.9) * spec * metallic * 0.8;
    
    // Iridescent color shift
    float iridAngle = dot(nn, viewDir);
    vec3 irid = 0.5 + 0.5 * cos(TAU * (iridAngle * 2.0 + liquid + tt * 0.05 + vec3(0.0, 0.33, 0.67)));
    col = mix(col, col * irid, 0.4 * metallic);
    
    // Fresnel rim
    float fresnel = pow(1.0 - max(0.0, dot(nn, viewDir)), 3.0);
    col += lightMetal * fresnel * 0.3;
    
    // Swirling highlights
    float swirl = sin(atan(warp2.y, warp2.x) * 5.0 + tt * speed * 2.0) * 0.5 + 0.5;
    col += lightMetal * swirl * fresnel * 0.2;
    
    // Energy boost
    float totalEnergy = a + b + c + d + e + f + g;
    col *= 0.8 + totalEnergy * 0.4;
    
    // Tone mapping
    col = col / (1.0 + col * 0.3);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
