// Shader 22: Tunnel Rush
// Bang-triggered infinite tunnel flying forward
// a-g = speed boost envelopes (higher = faster)
// h = tunnel segments (0 = 4, 1 = 12)

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

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float speed = 1.0;
    speed += a * 2.5 + b * 2.0 + c * 1.5 + d * 1.5;
    speed += e * 2.5 + f * 2.0 + g * 1.5;
    
    float r = length(uv);
    float angle = atan(uv.y, uv.x);
    float z = 0.4 / (r + 0.08);
    z += t * speed;
    
    float segments = 4.0 + h * 8.0;
    
    float rings = fract(z * 0.4);
    rings = smoothstep(0.35, 0.5, rings) * smoothstep(0.65, 0.5, rings);
    
    float lines = abs(fract(angle / TAU * segments) - 0.5) * 2.0;
    lines = smoothstep(0.08, 0.0, lines);
    
    float pattern = max(rings, lines * 0.4);
    
    float totalEnergy = a + b + c + d + e + f + g;
    float intensity = pattern * (0.4 + totalEnergy * 0.6);
    intensity += smoothstep(0.25, 0.0, r) * 0.3;
    intensity *= smoothstep(1.0, 0.2, r);
    
    vec3 col = vec3(intensity);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
