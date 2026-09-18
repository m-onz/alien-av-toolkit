// ============================================================
// basics/07 — Stripes (periodic patterns)
// ============================================================
// fract() (the fractional part) and sin() are how you make anything
// repeat. Feed a coordinate through them and space becomes rhythmic:
// stripes, waves, scanlines.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Frequency — number of stripes
//   b = Angle
//   c = Duty — stripe vs gap ratio
//   d = Softness of the stripe edges
//   e = Scroll speed
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
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float ang = param(b, 0.0, 3.14159);
    vec2 dir = vec2(cos(ang), sin(ang));
    float coord = dot(uv, dir);

    float freq  = param(a, 2.0, 60.0);
    float scroll = iTime * param(e, 0.0, 2.0);

    // fract() gives a 0..1 sawtooth that repeats every 1/freq.
    float saw = fract(coord * freq + scroll);

    float duty = param(c, 0.1, 0.9);
    float soft = param(d, 0.005, 0.3);
    // Two soft edges make a clean stripe of width `duty`.
    float stripe = smoothstep(0.5 - duty*0.5 - soft, 0.5 - duty*0.5, saw)
                 - smoothstep(0.5 + duty*0.5,        0.5 + duty*0.5 + soft, saw);

    fragColor = vec4(vec3(stripe), 1.0);
}
