// Shader 48: Magnetic Flow (ported from 12-magnetic-flow.html)
// Magnetic dipole field visualization with procedural LIC
//
// a = dipole count
// b = field line density
// c = dipole orbit speed
// d = shimmer speed
// e = hue shift (warm/cool)
// f = pole glow intensity
// g = contrast
// h = animation speed

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
#define NUM_DIPOLES 6

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec2 dipolePos(int i, float t, float orbSpd) {
    float fi = float(i);
    float angle = t * orbSpd * (0.15 + fi * 0.05) + fi * PI * 0.618;
    float r = 0.15 + 0.12 * sin(t * 0.1 + fi * 2.3);
    vec2 center = vec2(0.0);
    if (i < 2) { center = vec2(-0.15, 0.0); r = 0.1; angle = t*orbSpd*0.4+float(i)*PI; }
    else if (i < 4) { center = vec2(0.2, 0.15); r = 0.08; angle = t*orbSpd*(-0.35)+float(i)*PI; }
    else { center = vec2(0.0, -0.2+0.1*sin(t*0.12)); r = 0.2; angle = t*orbSpd*0.2+fi*1.5; }
    return center + r * vec2(cos(angle), sin(angle));
}

vec2 dipoleMom(int i, float t) {
    float fi = float(i);
    float angle = t * (0.2 + fi * 0.08) + fi * 1.7;
    float strength = 0.8 + 0.4 * sin(t * 0.15 + fi * 3.1);
    return strength * vec2(cos(angle), sin(angle));
}

vec2 bField(vec2 p, float t, float orbSpd) {
    vec2 B = vec2(0.0);
    for (int i = 0; i < NUM_DIPOLES; i++) {
        vec2 dp = dipolePos(i, t, orbSpd);
        vec2 m = dipoleMom(i, t);
        vec2 r = p - dp;
        float rLen = length(r);
        float safe = step(0.005, rLen);
        float rLen5 = rLen*rLen*rLen*rLen*rLen;
        float mr = dot(m, r);
        B += (3.0 * mr * r - rLen * rLen * m) / (rLen5 + 0.0001) * safe;
    }
    return B;
}

float procNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float aspect = iResolution.x / iResolution.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

    float dipN     = param(a, 2.0, 6.0);
    float lineDens = param(b, 1.0, 3.0);
    float orbSpd   = param(c, 0.3, 2.0);
    float shimSpd  = param(d, 0.5, 4.0);
    float hueShift = param(e, 0.0, 1.0);
    float poleGlow = param(f, 1.0, 5.0);
    float contrast = param(g, 0.5, 1.5);
    float animSpd  = param(h, 0.5, 2.0);

    float t = iTime * animSpd;

    vec2 B = bField(p, t, orbSpd);
    float Bmag = length(B);

    // Procedural LIC approximation
    float lic = 0.0;
    float weight = 0.0;
    vec2 pos = p;
    for (int i = 0; i < 20; i++) {
        vec2 bf = bField(pos, t, orbSpd);
        float bm = length(bf);
        if (bm < 0.0001) break;
        vec2 dir = bf / bm;
        pos += dir * 0.003;
        float w = 1.0 - float(i) / 20.0;
        lic += procNoise(pos * 20.0 * lineDens + dir * t * 0.5) * w;
        weight += w;
    }
    pos = p;
    for (int i = 0; i < 20; i++) {
        vec2 bf = bField(pos, t, orbSpd);
        float bm = length(bf);
        if (bm < 0.0001) break;
        vec2 dir = bf / bm;
        pos -= dir * 0.003;
        float w = 1.0 - float(i) / 20.0;
        lic += procNoise(pos * 20.0 * lineDens - dir * t * 0.5) * w;
        weight += w;
    }
    lic /= max(weight, 1.0);

    float strength = clamp(log(1.0 + Bmag * 0.5), 0.0, 1.0);

    // Color: deep blue -> cyan -> white
    vec3 col = mix(vec3(0.01, 0.01, 0.06), vec3(0.0, 0.15, 0.4), smoothstep(0.0, 0.2, strength));
    col = mix(col, vec3(0.0, 0.5, 0.8), smoothstep(0.2, 0.5, strength));
    col = mix(col, vec3(0.3, 0.8, 1.0), smoothstep(0.5, 0.75, strength));
    col = mix(col, vec3(0.9, 0.95, 1.0), smoothstep(0.75, 1.0, strength));

    // Hue shift
    col = mix(col, col.gbr, hueShift * 0.5);

    float licContrast = smoothstep(0.3, 0.7, lic);
    col *= (0.4 + 0.8 * licContrast) * contrast;

    float shimmer = sin(lic * 20.0 + t * shimSpd + strength * 10.0) * 0.5 + 0.5;
    col += vec3(0.05, 0.1, 0.15) * shimmer * strength;

    // Pole glow
    for (int i = 0; i < NUM_DIPOLES; i++) {
        if (float(i) >= dipN) break;
        vec2 dp = dipolePos(i, t, orbSpd);
        float dd = length(p - dp);
        float glow = exp(-dd * dd * 800.0);
        float pulse = 0.7 + 0.3 * sin(t * 3.0 + float(i) * 1.5);
        vec2 m = dipoleMom(i, t);
        float polarity = dot(normalize(m), vec2(0, 1));
        vec3 poleColor = mix(vec3(1.0, 0.3, 0.1), vec3(0.2, 0.6, 1.0), polarity * 0.5 + 0.5);
        col += glow * pulse * poleColor * poleGlow;
        col += exp(-dd * dd * 5000.0) * vec3(1.0) * 2.0;
    }


    col = col / (0.7 + col);

    fragColor = vec4(col, 1.0);
}
