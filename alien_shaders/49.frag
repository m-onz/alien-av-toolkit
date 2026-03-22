// Shader 49: Spiral Vortex Field (ported from pulse-spiral-vortex.html)
// Procedural CGLE-style spiral wave patterns
//
// a = spiral count
// b = dispersion (tightness)
// c = rotation speed
// d = scale / zoom
// e = hue offset
// f = edge glow (defect cores)
// g = saturation
// h = brightness

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
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float aspect = iResolution.x / iResolution.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

    float spiralN   = param(a, 3.0, 8.0);
    float dispersion = param(b, 0.5, 4.0);
    float rotSpd    = param(c, 0.3, 2.0);
    float scale     = param(d, 4.0, 15.0);
    float hueOff    = param(e, 0.0, 1.0);
    float edgeGlow  = param(f, 0.2, 1.5);
    float sat       = param(g, 0.5, 1.0);
    float bright    = param(h, 0.5, 1.5);

    float t = iTime * rotSpd;
    p *= scale;

    // Build complex field from multiple spiral defects
    float re = 0.0, im = 0.0;
    for (float i = 0.0; i < 8.0; i++) {
        if (i >= spiralN) break;
        // Defect positions
        vec2 center = vec2(
            (hash(i * 7.13) - 0.5) * 8.0,
            (hash(i * 13.71) - 0.5) * 8.0
        );
        // Slow drift
        center += vec2(sin(t * 0.2 + i * 2.0), cos(t * 0.15 + i * 1.7)) * 1.0;
        float charge = hash(i * 23.37) > 0.5 ? 1.0 : -1.0;

        vec2 d = p - center;
        float r = length(d);
        float angle = atan(d.y, d.x) * charge;
        float amp = tanh_f(r * 0.5);

        // Spiral: phase = angle + k*r - omega*t
        float phase = angle + r * dispersion - t * (1.0 + i * 0.2);
        re += amp * cos(phase);
        im += amp * sin(phase);
    }

    float amplitude = sqrt(re * re + im * im);
    float phase = atan(im, re);

    // Color from phase
    float hue = fract(phase / (2.0 * PI) + 0.5 + hueOff);

    // Gradient magnitude for edge detection (defect cores)
    vec2 eps = vec2(0.05, 0.0);
    // Approximate gradient
    float reR = 0.0, imR = 0.0, reU = 0.0, imU = 0.0;
    for (float i = 0.0; i < 8.0; i++) {
        if (i >= spiralN) break;
        vec2 center = vec2((hash(i*7.13)-0.5)*8.0, (hash(i*13.71)-0.5)*8.0);
        center += vec2(sin(t*0.2+i*2.0), cos(t*0.15+i*1.7));
        float charge = hash(i*23.37) > 0.5 ? 1.0 : -1.0;
        {
            vec2 dd = (p+eps.xy) - center; float r=length(dd); float ang=atan(dd.y,dd.x)*charge;
            float ph=ang+r*dispersion-t*(1.0+i*0.2); reR+=tanh_f(r*0.5)*cos(ph); imR+=tanh_f(r*0.5)*sin(ph);
        }
        {
            vec2 dd = (p+eps.yx) - center; float r=length(dd); float ang=atan(dd.y,dd.x)*charge;
            float ph=ang+r*dispersion-t*(1.0+i*0.2); reU+=tanh_f(r*0.5)*cos(ph); imU+=tanh_f(r*0.5)*sin(ph);
        }
    }
    float phaseR = atan(imR, reR);
    float phaseU = atan(imU, reU);
    float edge = abs(phaseR - phase) + abs(phaseU - phase);
    edge = min(edge, 2.0 * PI - edge);

    float val = pow(clamp(amplitude * 0.5, 0.0, 1.0), 0.6) * bright;
    vec3 col = hsv2rgb(vec3(hue, sat * 0.75, val));

    // Edge glow at defect cores
    col += vec3(0.3, 0.1, 0.5) * smoothstep(0.5, 2.0, edge * 8.0) * edgeGlow;

    // Defect core highlight
    float defect = exp(-amplitude * amplitude * 60.0) * 0.6;
    col += vec3(defect * 0.2, defect * 0.05, defect * 0.4);



    fragColor = vec4(col, 1.0);
}
