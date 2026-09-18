// ============================================================
// basics/05 — Circle & smoothstep (antialiasing)
// ============================================================
// A shape is just "is this pixel inside?". step() gives a hard edge;
// smoothstep() gives a soft, antialiased one. This introduces the
// distance-field way of drawing: compute distance, then threshold it.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Radius
//   b = Softness — edge blur (0 = crisp, 1 = very soft)
//   c = Hard edge — 1.0 uses step() (aliased) to see the difference
//   d = Hue
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

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float radius = param(a, 0.05, 0.6);
    float dist   = length(uv) - radius;   // <0 inside, >0 outside: a distance field

    float soft = param(b, 0.002, 0.15);
    // smoothstep makes a soft ring of width `soft` around the edge.
    float circleSoft = 1.0 - smoothstep(0.0, soft, dist);
    // step is a hard cutoff — cheaper, but jagged edges.
    float circleHard = 1.0 - step(0.0, dist);

    float mask = mix(circleSoft, circleHard, step(0.5, c));

    vec3 col = mix(vec3(0.05), mix(vec3(1.0,0.3,0.5), vec3(0.3,0.8,1.0), d), mask);
    fragColor = vec4(col, 1.0);
}
