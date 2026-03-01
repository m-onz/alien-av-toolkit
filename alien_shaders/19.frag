// Shader 19: Spiral Zoom
// Bang-triggered spiraling pattern that zooms
// a-g = spiral zoom envelopes (0->1 triggers zoom)
// h = spiral arms (0 = few, 1 = many)

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
#define TAU 6.28318530718

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float totalZoom = 1.0;
    totalZoom += a * 1.5 + b * 1.5 + c * 1.5 + d * 1.5;
    totalZoom += e * 1.5 + f * 1.5 + g * 1.5;
    
    vec2 zuv = uv / totalZoom;
    float r = length(zuv);
    float angle = atan(zuv.y, zuv.x);
    
    float arms = 4.0 + h * 8.0;
    float spiral = sin(angle * arms - r * 15.0 + t * 1.5);
    spiral = smoothstep(-0.2, 0.2, spiral);
    
    float totalEnergy = a + b + c + d + e + f + g;
    float intensity = spiral * (0.4 + totalEnergy * 0.6);
    intensity *= smoothstep(1.2, 0.3, r * totalZoom);
    
    vec3 col = vec3(intensity);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
