// ============================================================
// basics/08 — Grid & Domain Repetition
// ============================================================
// The most powerful trick in shaders: repeat SPACE, not shapes.
// fract(uv * N) tiles the plane into N cells, each with its own local
// 0..1 coordinate. Draw one thing in that local space and it appears
// in every cell. floor() gives you a per-cell id for variation.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Cells — grid resolution
//   b = Dot radius inside each cell
//   c = Edge softness
//   d = Per-cell random size variation
//   e = Pulse speed (cells breathe by id)
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
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    uv.x *= iResolution.x / iResolution.y;   // keep cells square

    float cells = param(a, 2.0, 24.0);
    vec2 g_uv = uv * cells;

    vec2 id    = floor(g_uv);          // which cell (integer) — an id for randomness
    vec2 local = fract(g_uv) - 0.5;    // position inside the cell, centred at 0

    float rnd = hash(id);
    float pulse = 0.5 + 0.5 * sin(iTime * param(e, 0.0, 4.0) + rnd * 6.2831);

    float radius = param(b, 0.05, 0.45) * (1.0 + (rnd - 0.5) * 2.0 * d) * pulse;
    float soft   = param(c, 0.005, 0.2);
    float dot_   = 1.0 - smoothstep(radius, radius + soft, length(local));

    vec3 col = mix(vec3(0.03), vec3(rnd, 1.0 - rnd, 0.6), dot_);
    fragColor = vec4(col, 1.0);
}
