// ============================================================
// basics/04 — Centered & Aspect-Correct Coordinates
// ============================================================
// Most interesting shapes are built around the CENTRE of the screen,
// not the corner. This is the "uvCenter" idiom used all over the
// complex shaders: subtract half the resolution, divide by height so
// circles stay round on a wide screen. length() then gives distance
// from centre — the basis for every radial effect.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Zoom
//   b = Falloff — how quickly brightness drops with distance
//   c = Hue tint
//   (d..h unused)
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

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Centre at 0, divide by .y so aspect ratio doesn't stretch shapes.
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float zoom = param(a, 0.5, 3.0);
    uv *= zoom;

    // Distance from the centre — the seed of all radial patterns.
    float r = length(uv);

    // Brightness falls off with distance (a radial vignette / glow).
    float falloff = param(b, 1.0, 8.0);
    float v = exp(-r * falloff);

    vec3 tint = mix(vec3(0.2, 0.5, 1.0), vec3(1.0, 0.5, 0.2), c);
    fragColor = vec4(tint * v, 1.0);
}
