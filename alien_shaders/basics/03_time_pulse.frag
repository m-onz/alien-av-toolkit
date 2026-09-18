// ============================================================
// basics/03 — Time Pulse
// ============================================================
// Animation = feeding iTime into a periodic function. sin() returns
// -1..1, so remap it to 0..1 with *0.5+0.5. This is the heartbeat of
// almost every animated shader.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Speed
//   b = Hue-ish tint (shifts the color of the pulse)
//   c = Floor — minimum brightness so it never goes fully black
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
    float speed = param(a, 0.2, 4.0);

    // sin() oscillates -1..1; remap to 0..1 for a smooth pulse.
    float pulse = sin(iTime * speed) * 0.5 + 0.5;

    // Keep a floor so it breathes instead of blinking off.
    float floor_ = param(c, 0.0, 0.6);
    pulse = mix(floor_, 1.0, pulse);

    // Tint by rotating which channels lead.
    vec3 tint = vec3(1.0, 0.4 + 0.6 * b, 0.2 + 0.8 * (1.0 - b));
    fragColor = vec4(tint * pulse, 1.0);
}
