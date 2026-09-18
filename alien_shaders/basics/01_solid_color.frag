// ============================================================
// basics/01 — Solid Color
// ============================================================
// The absolute minimum: every fragment (pixel) gets one color.
// A fragment shader runs once per pixel and must write gl_FragColor.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Red
//   b = Green
//   c = Blue
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

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // A color is a vec4: red, green, blue, alpha. Each is 0.0–1.0.
    // fragCoord (the pixel position) is ignored here — every pixel is identical.
    fragColor = vec4(a, b, c, 1.0);
}
