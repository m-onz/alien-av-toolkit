// ============================================================
// basics/13 — Value Noise
// ============================================================
// Raw hash is spiky static. Value noise smooths it: hash the four
// corners of each grid cell and interpolate between them. The
// smoothstep curve (f*f*(3-2f)) removes the blocky look. This single
// function is the foundation of clouds, terrain, and fbm (next).
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Scale — noise frequency
//   b = Scroll speed
//   c = Contrast
//   d = Warp — offset the lookup by itself (a taste of domain warp)
//   e = Hue
//   (f..h unused)
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

// Value noise: smooth interpolation of a random value at grid corners.
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);           // smoothstep easing
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float scale = param(a, 1.0, 20.0);
    vec2 p = uv * scale + iTime * param(b, 0.0, 1.0);

    // Feed noise back into itself a little — soft domain warp.
    float warp = param(d, 0.0, 2.0);
    p += warp * vec2(noise(p + 3.1), noise(p + 7.7));

    float n = noise(p);
    n = (n - 0.5) * param(c, 1.0, 2.5) + 0.5;

    vec3 col = mix(vec3(0.0), vec3(param(e,0.,1.), 0.6, 1.0 - param(e,0.,1.)), clamp(n,0.,1.));
    fragColor = vec4(col, 1.0);
}
