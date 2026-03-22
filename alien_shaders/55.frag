// Shader 55: Soliton Gas (from 05-soliton-gas.html)
// Colliding sech-envelope wave packets
// a=count b=speed c=width d=dispersion e=hue f=collision glow g=contrast h=brightness

/////////////////////////start Pd Header
uniform vec3 iResolution;
uniform float iTime;
uniform float iGlobalTime;
uniform vec4 iMouse;
uniform float a, b, c, d, e, f, g, h;
void mainImage(out vec4 fragColor, in vec2 fragCoord);
void main() { mainImage(gl_FragColor, gl_FragCoord.xy); }
/////////////////////////end Pd Header

#define PI 3.14159265
float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash(float n) { return fract(sin(n)*43758.5453); }
float cosh_f(float x) { return (exp(x)+exp(-x))*0.5; }
vec3 hsv2rgb(vec3 c) { vec4 K=vec4(1,2./3.,1./3.,3); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (uv - 0.5) * vec2(iResolution.x/iResolution.y, 1.0) * 10.0;
    float t = iTime;
    float solN = param(a, 4.0, 20.0);
    float spd = param(b, 0.5, 3.0);
    float width = param(c, 0.3, 1.5);
    float disp = param(d, 1.0, 5.0);
    float hueOff = param(e, 0.0, 1.0);
    float collGlow = param(f, 0.3, 2.0);
    float contrast = param(g, 0.5, 2.0);
    float bright = param(h, 0.5, 2.0);
    float re = 0.0, im = 0.0;
    for (float i = 0.0; i < 20.0; i++) {
        if (i >= solN) break;
        vec2 dir = vec2(cos(i*2.39996+0.5), sin(i*1.83+0.3));
        float v = (hash(i*7.13)-0.5) * 2.0 * spd;
        float w = width * (0.5 + hash(i*13.71));
        float pos = dot(p, dir) - t * v;
        float env = 1.0 / cosh_f(pos / w);
        float phase = pos * disp + t * v * v * 0.5;
        re += env * cos(phase) * 0.5;
        im += env * sin(phase) * 0.5;
    }
    float amp = sqrt(re*re + im*im);
    float phase = atan(im, re);
    float hue = fract(phase/(2.0*PI) + 0.5 + hueOff);
    float val = pow(clamp(amp*contrast, 0.0, 1.0), 0.7) * bright;
    vec3 col = hsv2rgb(vec3(hue, 0.85, val));
    float collision = max(0.0, amp - 0.7) * collGlow;
    col += vec3(1.0, 0.8, 0.4) * collision * 0.5;

    fragColor = vec4(col, 1.0);
}
