// ============================================================
// basics/15 — Domain Warping
// ============================================================
// The trick that makes fbm look ALIVE: instead of sampling noise at
// p, sample it at p + fbm(p). Do it twice for deep, folding, organic
// flow. This is the exact structure of 1.frag (Fluid Flow) — once you
// understand this file, that one is no longer mysterious.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Scale
//   b = Warp amount — strength of the fold
//   c = Speed
//   d = Detail (octaves 1–6)
//   e = Hue
//   f = Highlight on the warp veins
//   (g,h unused)
// ============================================================

/////////////////////////start Pd Header
uniform vec3 iResolution;
uniform float iTime;
uniform float iGlobalTime;
uniform vec4 iMouse;
uniform float a, b, c, d, e, f, g, h;
void mainImage(out vec4 fragColor, in vec2 fragCoord);
void main() { mainImage(gl_FragColor, gl_FragCoord.xy); }
/////////////////////////end Pd Header

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p, int oct) {
    float v = 0.0, amp = 0.5, norm = 0.0;
    for (int i = 0; i < 6; i++) {
        if (i >= oct) break;
        v += amp * noise(p); norm += amp; p *= 2.0; amp *= 0.5;
    }
    return v / norm;
}
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.); vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    int oct = int(floor(param(d, 1.0, 6.0) + 0.5));
    float t = iTime * param(c, 0.0, 1.5);
    vec2 p = uv * param(a, 1.0, 8.0);
    float warp = param(b, 0.0, 4.0);

    // First warp field q, then warp again with r using q — double fold.
    vec2 q = vec2(fbm(p + t * 0.1, oct), fbm(p + vec2(5.2, 1.3), oct));
    vec2 r = vec2(fbm(p + warp * q + vec2(1.7, 9.2) + t * 0.15, oct),
                  fbm(p + warp * q + vec2(8.3, 2.8), oct));
    float n = fbm(p + warp * r, oct);

    float hue = param(e, 0.0, 1.0) + 0.2 * length(r);
    vec3 col = hsv2rgb(vec3(hue, 0.7, clamp(n * 1.3, 0.0, 1.0)));

    // Bright veins where the warp field stretches most.
    float veins = length(r - q) * param(f, 0.0, 3.0);
    col += vec3(1.0, 0.9, 0.7) * pow(veins, 2.0) * 0.15;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
