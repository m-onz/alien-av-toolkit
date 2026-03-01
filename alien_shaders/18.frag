// Shader 18: Glitch Blocks
// Bang-triggered random rectangular glitch artifacts
// a-g = glitch envelopes (higher = more intense)
// h = scanline intensity (0 = none, 1 = heavy)

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

vec3 hash3(float p) {
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

float renderGlitch(vec2 uv, float env, float chId, float time) {
    if (env < 0.01) return 0.0;
    
    float intensity = 0.0;
    int numBlocks = int(env * 6.0) + 1;
    
    for (int i = 0; i < 6; i++) {
        if (i >= numBlocks) break;
        
        float seed = chId * 100.0 + float(i) * 17.3 + floor(time * 12.0);
        vec3 brnd = hash3(seed);
        vec3 brnd2 = hash3(seed + 100.0);
        
        vec2 blockPos = brnd.xy * 2.0 - 1.0;
        vec2 blockSize = vec2(0.04 + brnd2.x * 0.25, 0.015 + brnd2.y * 0.08);
        
        vec2 d = abs(uv - blockPos) - blockSize;
        float inside = step(max(d.x, d.y), 0.0);
        
        float blockVal = brnd.z < 0.5 ? 1.0 : 0.0;
        intensity = mix(intensity, blockVal, inside * env);
    }
    
    return intensity;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float intensity = 0.0;
    intensity = max(intensity, renderGlitch(uv, a, 0.0, t) * a);
    intensity = max(intensity, renderGlitch(uv, b, 1.0, t) * b);
    intensity = max(intensity, renderGlitch(uv, c, 2.0, t) * c);
    intensity = max(intensity, renderGlitch(uv, d, 3.0, t) * d);
    intensity = max(intensity, renderGlitch(uv, e, 4.0, t) * e);
    intensity = max(intensity, renderGlitch(uv, f, 5.0, t) * f);
    intensity = max(intensity, renderGlitch(uv, g, 6.0, t) * g);
    
    float totalGlitch = a + b + c + d + e + f + g;
    float scanline = sin(uv.y * 400.0 + t * 30.0) * 0.5 + 0.5;
    intensity *= 1.0 - scanline * h * 0.3 * totalGlitch;
    
    vec3 col = vec3(intensity);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
