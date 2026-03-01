// Shader 21: Grid Pulse
// Bang-triggered grid of lines that pulse and breathe
// a-d = grid spacing triggers, e-g = thickness triggers
// h = grid density (0 = sparse, 1 = dense)

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

float grid(vec2 uv, float spacing, float thickness) {
    vec2 g = abs(fract(uv / spacing - 0.5) - 0.5) * spacing;
    float d = min(g.x, g.y);
    return smoothstep(thickness, 0.0, d);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float spacing = 0.2 - h * 0.12;
    spacing -= (a + b + c + d) * 0.02;
    spacing = max(spacing, 0.04);
    
    float thickness = 0.003;
    thickness += (e + f + g) * 0.008;
    
    float distort = (a + b) * 0.08;
    vec2 duv = uv;
    duv.x += sin(uv.y * 8.0 + t * 1.5) * distort;
    duv.y += cos(uv.x * 8.0 + t * 1.5) * distort;
    
    float g1 = grid(duv, spacing, thickness);
    
    float angle = PI * 0.25;
    vec2 ruv = vec2(
        duv.x * cos(angle) - duv.y * sin(angle),
        duv.x * sin(angle) + duv.y * cos(angle)
    );
    float g2 = grid(ruv, spacing * 1.1, thickness * 0.8);
    
    float totalEnergy = a + b + c + d + e + f + g;
    float intensity = max(g1, g2 * 0.6) * (0.5 + totalEnergy * 0.5);
    
    vec3 col = vec3(intensity);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
