// Shader 14: Ripple Rings
// Bang-triggered concentric rings that expand outward
// a = ring 1 envelope, b = ring 2, c = ring 3, d = ring 4
// e = ring 5, f = ring 6, g = ring 7, h = base hue (0-1)

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

float ring(vec2 uv, float radius, float thickness) {
    float d = abs(length(uv) - radius);
    return smoothstep(thickness, 0.0, d);
}

vec3 renderRing(vec2 uv, float env, float baseHue) {
    if (env < 0.001 || env > 0.98) return vec3(0.0);
    
    float radius = env * 2.5;
    float thickness = 0.02 + (1.0 - env) * 0.03;
    
    float r = ring(uv, radius, thickness);
    r += ring(uv, radius * 0.6, thickness * 0.6) * 0.4;
    
    float fade = 1.0 - env;
    float intensity = r * fade;
    
    return vec3(intensity);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    float intensity = 0.0;
    intensity += renderRing(uv, a, h).r;
    intensity += renderRing(uv, b, h).r;
    intensity += renderRing(uv, c, h).r;
    intensity += renderRing(uv, d, h).r;
    intensity += renderRing(uv, e, h).r;
    intensity += renderRing(uv, f, h).r;
    intensity += renderRing(uv, g, h).r;
    
    vec3 col = vec3(intensity) * mix(vec3(1.0), vec3(0.8, 0.8, 0.85), h);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
