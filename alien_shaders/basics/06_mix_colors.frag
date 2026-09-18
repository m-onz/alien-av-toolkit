// ============================================================
// basics/06 — Mixing Colors
// ============================================================
// mix(A, B, t) is linear interpolation: t=0 gives A, t=1 gives B.
// Combined with smoothstep() for the blend factor you get clean
// multi-stop gradients — the backbone of shader "color grading".
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Angle of the gradient
//   b = Position of the mid color
//   c = Contrast of the blend (smoothstep width)
//   d,e = shift the two end hues
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

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // Project uv onto a direction to get a 1D gradient coordinate.
    float ang = param(a, 0.0, 6.2831853);
    vec2 dir = vec2(cos(ang), sin(ang));
    float t = dot(uv - 0.5, dir) + 0.5;

    // Three color stops.
    vec3 c0 = vec3(0.1, 0.2, 0.6) + d;
    vec3 c1 = vec3(1.0, 0.6, 0.2);
    vec3 c2 = vec3(0.9, 0.1, 0.4) + e;

    float mid  = param(b, 0.2, 0.8);
    float cont = param(c, 0.5, 0.05);   // smaller = sharper transition

    // Blend c0→c1 over the first half, c1→c2 over the second.
    vec3 col = mix(c0, c1, smoothstep(mid - cont, mid, t));
    col      = mix(col, c2, smoothstep(mid, mid + cont, t));

    fragColor = vec4(col, 1.0);
}
