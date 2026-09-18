// ============================================================
// basics/10 — Polar Coordinates
// ============================================================
// Convert (x,y) into (angle, radius) with atan() and length().
// Working in polar space makes rings, rays, spirals and mandala
// symmetry trivial. This is the coordinate system behind
// kaleidoscopes.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Petals — number of angular repeats (rotational symmetry)
//   b = Rings — radial frequency
//   c = Spin speed
//   d = Spiral — couples angle into radius
//   e = Hue
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

#define TAU 6.28318530718
float param(float p, float lo, float hi) { return mix(lo, hi, p); }
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.); vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float ang = atan(uv.y, uv.x);   // -PI..PI angle around centre
    float rad = length(uv);         // distance from centre

    float petals = floor(param(a, 2.0, 16.0));
    float rings  = param(b, 2.0, 30.0);
    float spin   = iTime * param(c, 0.0, 2.0);
    float spiral = param(d, 0.0, 12.0);

    // Angular petals + radial rings + spiral coupling.
    float pattern = sin(ang * petals + spin + rad * spiral) * sin(rad * rings - spin);
    pattern = pattern * 0.5 + 0.5;

    float hue = param(e, 0.0, 1.0) + rad * 0.3;
    vec3 col = hsv2rgb(vec3(hue, 0.8, pattern));
    fragColor = vec4(col, 1.0);
}
