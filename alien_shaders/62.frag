// Shader 62: Belousov-Zhabotinsky (from 17-belousov-zhabotinsky.html)
// Chemical spiral waves — BZ reaction patterns
// a=spiral count b=wave speed c=scale d=chemical ratio e=hue f=wave brightness g=bg color h=bright

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
vec2 hash2(vec2 p) { p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
float noise(vec2 p) { vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(dot(hash2(i)-0.5,f),dot(hash2(i+vec2(1,0))-0.5,f-vec2(1,0)),u.x),
               mix(dot(hash2(i+vec2(0,1))-0.5,f-vec2(0,1)),dot(hash2(i+vec2(1,1))-0.5,f-vec2(1,1)),u.x),u.y)+0.5; }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord/iResolution.xy;
    vec2 p = (uv-0.5)*vec2(iResolution.x/iResolution.y,1.0);
    float spiralN = param(a,2.0,8.0); float waveSpd = param(b,0.5,3.0);
    float scale = param(c,5.0,15.0); float chemR = param(d,0.3,1.0);
    float hueOff = param(e,0.0,1.0); float waveBri = param(f,0.5,2.0);
    float bgCol = param(g,0.0,0.3); float bright = param(h,0.5,1.5);
    float t = iTime * waveSpd;
    p *= scale;
    // BZ: multiple spiral wave centers
    float u = 0.0; // activator
    float v = 0.0; // inhibitor
    for (float i = 0.0; i < 8.0; i++) {
        if (i >= spiralN) break;
        vec2 center = vec2((hash(i*7.13)-0.5)*8.0, (hash(i*13.71)-0.5)*8.0);
        center += vec2(sin(t*0.1+i*2.0), cos(t*0.08+i*1.7)) * 1.5;
        float charge = hash(i*23.37) > 0.5 ? 1.0 : -1.0;
        vec2 dd = p - center;
        float r = length(dd);
        float ang = atan(dd.y, dd.x) * charge;
        // BZ spiral: activator wave
        float phase = ang + r * 1.2 * chemR - t * 2.0;
        float wave = sin(phase) * 0.5 + 0.5;
        wave *= exp(-r * 0.15);
        // Second chemical with phase offset
        float phase2 = ang + r * 0.8 * chemR - t * 1.5 + PI * 0.667;
        float wave2 = sin(phase2) * 0.5 + 0.5;
        wave2 *= exp(-r * 0.15);
        u += wave;
        v += wave2;
    }
    u = clamp(u, 0.0, 1.0);
    v = clamp(v, 0.0, 1.0);
    // Noise for organic variation
    float n = noise(p * 0.5 + t * 0.1) * 0.2;
    u += n; v += n * 0.5;
    // BZ color: 3-chemical mapping → RGB-like
    vec3 col = vec3(0.0);
    col.r = u * (1.0 - v * 0.5) * waveBri;
    col.g = v * (1.0 - u * 0.3) * waveBri * 0.7;
    col.b = (1.0 - u) * v * 0.5 * waveBri;
    // Hue shift
    float luma = dot(col, vec3(0.3, 0.6, 0.1));
    vec3 shifted = col;
    if (hueOff > 0.01) {
        float ca = cos(hueOff * PI * 2.0), sa = sin(hueOff * PI * 2.0);
        shifted = vec3(
            col.r * (0.333+0.667*ca) + col.g * (0.333-0.333*ca-0.577*sa) + col.b * (0.333-0.333*ca+0.577*sa),
            col.r * (0.333-0.333*ca+0.577*sa) + col.g * (0.333+0.667*ca) + col.b * (0.333-0.333*ca-0.577*sa),
            col.r * (0.333-0.333*ca-0.577*sa) + col.g * (0.333-0.333*ca+0.577*sa) + col.b * (0.333+0.667*ca)
        );
    }
    col = shifted * bright;
    col += vec3(bgCol * 0.3, bgCol * 0.1, bgCol * 0.2);
    fragColor = vec4(max(col, 0.0), 1.0);
}
