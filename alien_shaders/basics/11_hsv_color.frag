// ============================================================
// basics/11 — HSV Color
// ============================================================
// RGB is awkward for "make it rainbow" or "shift the hue". HSV (hue,
// saturation, value) is the artist-friendly space: animate hue for
// smooth spectral sweeps. hsv2rgb() is copy-pasted into nearly every
// shader in this repo — learn it here.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Base hue
//   b = Saturation
//   c = Value (brightness)
//   d = Hue sweep across screen
//   e = Hue drift speed over time
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

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // Hue wraps at 1.0, so we can freely add sweeps and drift.
    float hue = a + uv.x * param(d, 0.0, 1.0) + iTime * param(e, 0.0, 0.3);
    float sat = param(b, 0.0, 1.0);
    float val = param(c, 0.2, 1.0);

    fragColor = vec4(hsv2rgb(vec3(hue, sat, val)), 1.0);
}
