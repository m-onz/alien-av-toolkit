// Shader 17: Particle Burst
// Bang-triggered particles that explode outward
// a-g = burst envelopes (0->1 particles expand)
// h = particle size (0 = small dots, 1 = larger)

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

#define TAU 6.28318530718
#define NUM_PARTICLES 20

vec3 hash3(float p) {
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

float renderBurst(vec2 uv, float env, float chId, float baseSize) {
    if (env < 0.001 || env > 0.98) return 0.0;
    
    float intensity = 0.0;
    float fade = 1.0 - env;
    
    for (int i = 0; i < NUM_PARTICLES; i++) {
        vec3 prnd = hash3(chId * 100.0 + float(i) * 7.3);
        
        float angle = prnd.x * TAU;
        float speed = 0.4 + prnd.y * 1.2;
        vec2 pos = vec2(cos(angle), sin(angle)) * env * speed;
        
        float d = length(uv - pos);
        float size = (0.01 + baseSize * 0.02) * (1.0 - env * 0.5);
        
        intensity += smoothstep(size, 0.0, d) * fade;
    }
    
    return intensity;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    float intensity = 0.0;
    intensity += renderBurst(uv, a, 0.0, h);
    intensity += renderBurst(uv, b, 1.0, h);
    intensity += renderBurst(uv, c, 2.0, h);
    intensity += renderBurst(uv, d, 3.0, h);
    intensity += renderBurst(uv, e, 4.0, h);
    intensity += renderBurst(uv, f, 5.0, h);
    intensity += renderBurst(uv, g, 6.0, h);
    
    vec3 col = vec3(intensity);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
