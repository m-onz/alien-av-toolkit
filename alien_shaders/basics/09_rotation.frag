// ============================================================
// basics/09 — 2D Rotation
// ============================================================
// A 2x2 rotation matrix spins coordinates around the origin. Rotate
// uv before drawing and the whole pattern turns; rotate by iTime and
// it animates. This is the building block for kaleidoscopes and any
// swirling motion.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Spin speed
//   b = Stripe frequency (something to watch rotate)
//   c = Twist — rotation grows with distance from centre (swirl)
//   d = Zoom
//   (e..h unused)
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

// A rotation matrix: multiply a vec2 by this to rotate it by `a` radians.
mat2 rot(float ang) { float c = cos(ang), s = sin(ang); return mat2(c, -s, s, c); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    uv *= param(d, 0.5, 3.0);

    // Base spin, plus extra twist that increases with radius → swirl.
    float ang = iTime * param(a, 0.0, 2.0) + length(uv) * param(c, 0.0, 8.0);
    uv = rot(ang) * uv;

    float freq = param(b, 3.0, 40.0);
    float stripe = sin(uv.x * freq) * 0.5 + 0.5;

    vec3 col = mix(vec3(0.1, 0.0, 0.2), vec3(0.9, 0.8, 1.0), stripe);
    fragColor = vec4(col, 1.0);
}
