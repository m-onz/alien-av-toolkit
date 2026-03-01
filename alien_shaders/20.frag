// Shader 20: Kaleidoscope Burst
// Bang-triggered mirrored geometric patterns
// a-d = symmetry triggers, e-g = rotation triggers
// h = base symmetry (0 = 4-fold, 1 = 12-fold)

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

vec2 kaleidoscope(vec2 uv, float segments) {
    float angle = atan(uv.y, uv.x);
    float r = length(uv);
    float segAngle = TAU / segments;
    angle = mod(angle, segAngle);
    angle = abs(angle - segAngle * 0.5);
    return vec2(cos(angle), sin(angle)) * r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float symmetry = 4.0 + h * 8.0;
    symmetry += a * 4.0 + b * 3.0 + c * 2.0 + d * 2.0;
    
    float rotation = t * 0.2;
    rotation += e * 1.5 + f * 2.0 + g * 2.5;
    
    float cs = cos(rotation), sn = sin(rotation);
    uv = vec2(uv.x * cs - uv.y * sn, uv.x * sn + uv.y * cs);
    
    vec2 kuv = kaleidoscope(uv, symmetry);
    
    float pattern = sin(kuv.x * 12.0 + t * 0.8) * 0.5;
    pattern += sin(kuv.y * 16.0 - t) * 0.3;
    pattern += sin((kuv.x + kuv.y) * 8.0 + t * 0.5) * 0.2;
    pattern = smoothstep(-0.3, 0.3, pattern);
    
    float totalEnergy = a + b + c + d + e + f + g;
    float intensity = pattern * (0.4 + totalEnergy * 0.6);
    
    vec3 col = vec3(intensity);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
