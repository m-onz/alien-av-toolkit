// Shader 61: XY Vortex Dance (from 16-xy-vortex-dance.html)
// Spin field with vortex/antivortex pairs
// a=vortex count b=spin coupling c=speed d=scale e=hue f=vortex glow g=spin viz h=bright

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
vec3 hsv2rgb(vec3 c) { vec4 K=vec4(1,2./3.,1./3.,3); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord/iResolution.xy;
    vec2 p = (uv-0.5)*vec2(iResolution.x/iResolution.y,1.0);
    float vortN = param(a,3.0,10.0); float coupling = param(b,0.3,2.0);
    float speed = param(c,0.3,2.0); float scale = param(d,4.0,12.0);
    float hueOff = param(e,0.0,1.0); float vGlow = param(f,0.5,3.0);
    float spinViz = param(g,0.3,1.0); float bright = param(h,0.5,1.5);
    float t = iTime * speed;
    p *= scale;
    // Compute spin angle from vortex/antivortex pairs
    float theta = 0.0;
    float totalVorticity = 0.0;
    for (float i = 0.0; i < 10.0; i++) {
        if (i >= vortN) break;
        vec2 center = vec2((hash(i*7.13)-0.5)*8.0, (hash(i*13.71)-0.5)*8.0);
        center += vec2(sin(t*0.2+i*2.39996), cos(t*0.15+i*1.83)) * 2.0;
        float charge = (hash(i*23.37) > 0.5) ? 1.0 : -1.0;
        vec2 dd = p - center;
        float r = length(dd);
        theta += charge * atan(dd.y, dd.x);
        totalVorticity += exp(-r*r*2.0) * abs(charge);
    }
    // Smooth spin wave background
    theta += sin(p.x*0.5+t*0.3)*coupling + cos(p.y*0.7-t*0.2)*coupling;
    // Spin visualization
    vec2 spin = vec2(cos(theta), sin(theta));
    float spinColor = spin.x * 0.5 + 0.5;
    float hue = fract(theta/(2.0*PI) + hueOff);
    vec3 col = hsv2rgb(vec3(hue, 0.7, spinColor * spinViz * bright));
    // Spin direction arrows via stripe pattern
    float stripe = sin(dot(p, spin) * 10.0) * 0.5 + 0.5;
    col += vec3(0.1) * stripe * 0.2;
    // Vortex core glow
    for (float i = 0.0; i < 10.0; i++) {
        if (i >= vortN) break;
        vec2 center = vec2((hash(i*7.13)-0.5)*8.0, (hash(i*13.71)-0.5)*8.0);
        center += vec2(sin(t*0.2+i*2.39996), cos(t*0.15+i*1.83)) * 2.0;
        float charge = (hash(i*23.37) > 0.5) ? 1.0 : -1.0;
        float dd = length(p - center);
        float glow = exp(-dd*dd*3.0);
        vec3 vCol = charge > 0.0 ? vec3(1.0,0.3,0.1) : vec3(0.1,0.5,1.0);
        col += vCol * glow * vGlow * 0.3;
    }
    col += vec3(0.01,0.005,0.02);
    fragColor = vec4(col, 1.0);
}
