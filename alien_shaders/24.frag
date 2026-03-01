// Shader 24: Lightning Strike
// Bang-triggered electric bolts from top to bottom
// a-g = lightning envelopes (1 = flash, decays to 0)
// h = bolt complexity (0 = simple, 1 = branching)

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

float hash(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

vec3 hash3(float p) {
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

float lightning(vec2 uv, float seed, float time, float complexity) {
    float bolt = 0.0;
    float x = 0.0;
    int segments = 16 + int(complexity * 8.0);
    
    for (int i = 0; i < 24; i++) {
        if (i >= segments) break;
        float fi = float(i);
        float y = 0.5 - fi / float(segments);
        float nextY = 0.5 - (fi + 1.0) / float(segments);
        
        float dx = (hash(seed + fi * 7.3 + floor(time * 15.0)) - 0.5) * 0.12;
        float nextX = x + dx;
        
        vec2 pa = uv - vec2(x, y);
        vec2 ba = vec2(nextX, nextY) - vec2(x, y);
        float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        float d = length(pa - ba * t);
        
        bolt += smoothstep(0.015, 0.0, d);
        x = nextX;
    }
    
    return bolt;
}

float renderLightning(vec2 uv, float env, float chId, float time, float complexity) {
    if (env < 0.01) return 0.0;
    
    vec3 rnd = hash3(chId * 137.0 + 42.0);
    vec2 p = uv;
    p.x -= (rnd.x - 0.5) * 1.0;
    
    float bolt = lightning(p, chId * 100.0 + rnd.y * 50.0, time, complexity);
    return bolt * env * env;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float intensity = 0.0;
    intensity += renderLightning(uv, a, 0.0, t, h);
    intensity += renderLightning(uv, b, 1.0, t, h);
    intensity += renderLightning(uv, c, 2.0, t, h);
    intensity += renderLightning(uv, d, 3.0, t, h);
    intensity += renderLightning(uv, e, 4.0, t, h);
    intensity += renderLightning(uv, f, 5.0, t, h);
    intensity += renderLightning(uv, g, 6.0, t, h);
    
    float totalEnv = a + b + c + d + e + f + g;
    intensity += totalEnv * totalEnv * 0.15;
    
    vec3 col = vec3(intensity);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
