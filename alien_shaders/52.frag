// Shader 52: CGLE Regimes (from 01-cgle-regimes.html)
// Procedural spiral wave phase patterns
//
// a = dispersion (b param)  b = nonlinearity (c param)
// c = drive amplitude       d = scale
// e = hue offset            f = edge glow
// g = vortex count          h = speed

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

#define PI 3.14159265
float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash(float n) { return fract(sin(n) * 43758.5453); }
float tanh_f(float x) { float e = exp(2.0*x); return (e-1.0)/(e+1.0); }
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0,2.0/3.0,1.0/3.0,3.0);
    vec3 p = abs(fract(c.xxx+K.xyz)*6.0-K.www);
    return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (uv - 0.5) * vec2(iResolution.x/iResolution.y, 1.0);

    float bParam = param(a, -2.0, 3.0);
    float cParam = param(b, -2.0, 1.0);
    float drive  = param(c, 0.0, 0.3);
    float scale  = param(d, 6.0, 20.0);
    float hueOff = param(e, 0.0, 1.0);
    float edgeG  = param(f, 0.2, 1.5);
    float vortN  = param(g, 3.0, 10.0);
    float speed  = param(h, 0.3, 2.0);

    float t = iTime * speed;
    p *= scale;

    // Build complex field from vortex defects with CGLE-style dispersion
    float re = 0.0, im = 0.0;
    for (float i = 0.0; i < 10.0; i++) {
        if (i >= vortN) break;
        vec2 center = vec2((hash(i*7.13)-0.5)*10.0, (hash(i*13.71)-0.5)*10.0);
        center += vec2(sin(t*0.15+i*2.0), cos(t*0.12+i*1.7)) * 2.0;
        float charge = hash(i*23.37) > 0.5 ? 1.0 : -1.0;
        vec2 dd = p - center;
        float r = length(dd);
        float ang = atan(dd.y, dd.x) * charge;
        float amp = tanh_f(r * 0.5);
        // CGLE spiral: dispersion affects winding
        float phase = ang + r * bParam * 0.3 - t * (1.0 + cParam * 0.2 + i * 0.1);
        re += amp * cos(phase);
        im += amp * sin(phase);
    }
    // Drive
    float fx = sin(p.x * 0.3 + t * 0.4) * cos(p.y * 0.2 - t * 0.3);
    re += fx * drive;
    im += fx * drive * 0.7;

    float amplitude = sqrt(re*re + im*im);
    float phase = atan(im, re);
    float hue = fract(phase / (2.0*PI) + 0.5 + hueOff);

    // Edge detection
    vec2 eps = vec2(0.1, 0.0);
    float re2 = 0.0, im2 = 0.0;
    for (float i = 0.0; i < 10.0; i++) {
        if (i >= vortN) break;
        vec2 center = vec2((hash(i*7.13)-0.5)*10.0, (hash(i*13.71)-0.5)*10.0);
        center += vec2(sin(t*0.15+i*2.0), cos(t*0.12+i*1.7)) * 2.0;
        float charge = hash(i*23.37) > 0.5 ? 1.0 : -1.0;
        vec2 dd = (p+eps.xy) - center;
        float r = length(dd); float ang = atan(dd.y, dd.x)*charge;
        float ph = ang + r*bParam*0.3 - t*(1.0+cParam*0.2+i*0.1);
        re2 += tanh_f(r*0.5)*cos(ph); im2 += tanh_f(r*0.5)*sin(ph);
    }
    float phase2 = atan(im2, re2);
    float edge = abs(phase2 - phase);
    edge = min(edge, 2.0*PI - edge);

    float val = pow(clamp(amplitude*0.7, 0.0, 1.0), 0.6);
    vec3 col = hsv2rgb(vec3(hue, 0.75, val));
    col += vec3(0.3, 0.1, 0.5) * smoothstep(0.5, 2.0, edge*8.0) * edgeG;
    col += vec3(0.2, 0.05, 0.4) * exp(-amplitude*amplitude*60.0) * 0.6;


    fragColor = vec4(col, 1.0);
}
