// Shader 25: Heartbeat Pulse
// Bang-triggered pulsing organic shape
// a-g = pulse envelopes (1 = thump peak, decays to 0)
// h = pulse size (0 = small, 1 = large)

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

#define PI 3.14159265359

float heart(vec2 uv) {
    uv.y -= 0.08;
    uv.x = abs(uv.x);
    float a = atan(uv.x, uv.y) / PI;
    float r = length(uv);
    float hh = abs(a);
    float d = (13.0 * hh - 22.0 * hh * hh + 10.0 * hh * hh * hh) / (6.0 - 5.0 * hh);
    return smoothstep(d * 0.28, d * 0.28 - 0.015, r);
}

float renderPulse(vec2 uv, float env, float baseSize) {
    if (env < 0.001) return 0.0;
    
    float scale = 0.8 + baseSize * 0.4 + env * 0.4;
    vec2 p = uv / scale;
    
    float h = heart(p);
    float glow = smoothstep(0.4, 0.0, length(uv)) * env * 0.5;
    
    return (h + glow) * env;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    float intensity = 0.0;
    intensity += renderPulse(uv, a, h);
    intensity += renderPulse(uv, b, h);
    intensity += renderPulse(uv, c, h);
    intensity += renderPulse(uv, d, h);
    intensity += renderPulse(uv, e, h);
    intensity += renderPulse(uv, f, h);
    intensity += renderPulse(uv, g, h);
    
    float totalEnv = a + b + c + d + e + f + g;
    intensity += totalEnv * 0.08;
    
    vec3 col = vec3(intensity);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
