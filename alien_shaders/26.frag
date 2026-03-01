// Shader 26: Smoke Burst
// Bang-triggered smoke/vapor that billows outward
// a-g = smoke envelopes (0->1 smoke expands)
// h = turbulence (0 = smooth, 1 = chaotic)

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

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec3 hash3(float p) {
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p, float turb) {
    float f = 0.0;
    float amp = 0.5;
    int octaves = 3 + int(turb * 2.0);
    for (int i = 0; i < 5; i++) {
        if (i >= octaves) break;
        f += amp * noise(p);
        p *= 2.0;
        amp *= 0.5;
    }
    return f;
}

float renderSmoke(vec2 uv, float env, float chId, float time, float turb) {
    if (env < 0.001 || env > 0.99) return 0.0;
    
    vec3 rnd = hash3(chId * 137.0 + 42.0);
    vec2 center = (rnd.xy - 0.5) * 0.25;
    vec2 p = uv - center;
    
    float scale = 0.4 + env * 1.8;
    p /= scale;
    p.y += env * 0.25;
    
    float smoke = fbm(p * 2.5 + time * 0.4 + chId * 8.0, turb);
    smoke *= fbm(p * 4.0 - time * 0.25 + chId * 15.0, turb);
    
    float r = length(p);
    smoke *= smoothstep(0.7, 0.0, r);
    smoke *= 1.0 - env;
    
    return smoke;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float intensity = 0.0;
    intensity += renderSmoke(uv, a, 0.0, t, h);
    intensity += renderSmoke(uv, b, 1.0, t, h);
    intensity += renderSmoke(uv, c, 2.0, t, h);
    intensity += renderSmoke(uv, d, 3.0, t, h);
    intensity += renderSmoke(uv, e, 4.0, t, h);
    intensity += renderSmoke(uv, f, 5.0, t, h);
    intensity += renderSmoke(uv, g, 6.0, t, h);
    
    vec3 col = vec3(intensity);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
