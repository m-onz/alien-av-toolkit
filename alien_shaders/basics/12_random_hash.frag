// ============================================================
// basics/12 — Randomness (hash)
// ============================================================
// GLSL has no rand(). We fake it with a hash: a deterministic
// function that turns a coordinate into a pseudo-random 0..1 value.
// Same input → same output every frame, which is exactly what you
// want. Hash of the CELL id gives static; hash including iTime gives
// TV noise. This is the raw ingredient for noise (next step).
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Cell size (blockiness)
//   b = Animate — 0 static, 1 flickering per frame
//   c = Contrast
//   d = Color amount (0 mono, 1 RGB static)
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

// Classic hash: the big constants scramble the input into "noise".
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float cells = param(a, 8.0, 200.0);
    vec2 id = floor(fragCoord / iResolution.y * cells);

    // Mixing iTime into the hash reseeds it each frame → flicker.
    float t = floor(iTime * 20.0) * param(b, 0.0, 1.0);

    float r = hash3(vec3(id, t));
    float g_ = mix(r, hash3(vec3(id, t + 5.0)), d);
    float b_ = mix(r, hash3(vec3(id, t + 9.0)), d);

    vec3 col = vec3(r, g_, b_);
    col = (col - 0.5) * param(c, 1.0, 2.5) + 0.5;   // contrast around mid-grey
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
