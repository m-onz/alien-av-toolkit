// ============================================================
// basics/02 — UV Gradient
// ============================================================
// The single most important idea in fragment shaders: turn the pixel
// position (fragCoord) into "uv" coordinates that run 0..1 across the
// screen. Once you have uv, position becomes color.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Mix — blend between the horizontal (x) and vertical (y) gradient
//   b = Brightness
//   (c..h unused)
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
    // Normalize pixel coords to 0..1. Bottom-left is (0,0), top-right (1,1).
    vec2 uv = fragCoord / iResolution.xy;

    // uv.x rises left→right, uv.y rises bottom→top. Blend between them.
    float g_h = uv.x;                 // horizontal ramp
    float g_v = uv.y;                 // vertical ramp
    float ramp = mix(g_h, g_v, a);

    float bright = param(b, 0.2, 1.5);
    fragColor = vec4(vec3(ramp) * bright, 1.0);
}
