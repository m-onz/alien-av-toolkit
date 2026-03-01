// Shader 23: Ink Splash
// Bang-triggered ink splatter that spreads outward
// a-g = splash envelopes (0->1 spreads ink)
// h = texture detail (0 = smooth, 1 = rough)

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

float fbm(vec2 p, float detail) {
    float f = 0.0;
    float amp = 0.5;
    int octaves = 2 + int(detail * 3.0);
    for (int i = 0; i < 5; i++) {
        if (i >= octaves) break;
        f += amp * noise(p);
        p *= 2.0;
        amp *= 0.5;
    }
    return f;
}

float renderSplash(vec2 uv, float env, float chId, float detail) {
    if (env < 0.001 || env > 0.98) return 0.0;
    
    vec3 rnd = hash3(chId * 137.0 + 42.0);
    vec2 center = (rnd.xy - 0.5) * 0.4;
    vec2 p = uv - center;
    
    float angle = atan(p.y, p.x);
    float r = length(p);
    
    float edge = fbm(vec2(angle * 2.5, chId * 8.0), detail) * 0.5 + 0.5;
    float splashRadius = env * 0.7 * (0.6 + edge * 0.5);
    
    float splash = smoothstep(splashRadius, splashRadius - 0.08, r);
    float texture = fbm(p * 6.0 + chId * 8.0, detail);
    splash *= 0.8 + texture * 0.2;
    
    float fade = 1.0 - env * 0.4;
    return splash * fade;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    float intensity = 0.0;
    intensity += renderSplash(uv, a, 0.0, h);
    intensity += renderSplash(uv, b, 1.0, h);
    intensity += renderSplash(uv, c, 2.0, h);
    intensity += renderSplash(uv, d, 3.0, h);
    intensity += renderSplash(uv, e, 4.0, h);
    intensity += renderSplash(uv, f, 5.0, h);
    intensity += renderSplash(uv, g, 6.0, h);
    
    vec3 col = vec3(intensity);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
