// ============================================================
// 74.frag — Radial Lattice (animated polar grid / radar-sonar screen)
// ============================================================
// A polar coordinate grid: concentric RINGS at evenly-spaced radii
// plus RAYS at evenly-spaced angles. Rings breathe harmonically,
// rays jitter with noise, and a rotating sweep line crosses the
// field like radar. On a transient, a bright ring pulse pings out.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = ring count      (concentric circles, ~3 to 24)
//   b = ray count       (angular spokes, ~3 to 48)
//   c = radial wobble   (rings breathe in/out harmonically)
//   d = angular jitter  (rays wiggle via noise)
//   e = sweep / rotation speed
//   f = glow / line brightness
//   g = hue rotation    (hue also varies with radius = spectrum rings)
//   h = EVENT: radar ping — bright ring expands outward on a transient
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

// --- house helpers ---
float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float saturate(float x){ return clamp(x,0.0,1.0); }
float hash(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.13); p3+=dot(p3,p3.yzx+3.333); return fract((p3.x+p3.y)*p3.z); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y); }
#define PI 3.14159265359
#define TAU 6.28318530718

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    // centered, aspect-correct coords
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    // polar conversion
    float r   = length(uv);
    float ang = atan(uv.y, uv.x);

    // --- knob mapping ---
    float ringCount = param(a, 3.0, 24.0);   // concentric rings
    float rayCount  = param(b, 3.0, 48.0);   // angular spokes
    float wobAmt    = param(c, 0.0, 0.35);   // radial breathing depth
    float jitAmt    = param(d, 0.0, 0.25);   // ray angular jitter
    float speed     = param(e, 0.0, 2.0);    // sweep / rotation speed
    float glow      = param(f, 0.4, 3.0);    // line brightness
    float hueRot    = param(g, 0.0, 1.0);    // hue offset

    float t = iTime * speed;

    // --- RINGS ------------------------------------------------
    // rings breathe: each ring's radius wobbles harmonically over time.
    // phase varies with index so the rings pulse independently.
    float ringPhase = r * ringCount;
    float wobble = wobAmt * sin(ringPhase * PI + t * 1.7);
    float ringF = fract(ringPhase + wobble);
    // distance to nearest ring edge -> antialiased glowing line
    float ringD = min(ringF, 1.0 - ringF);
    float ring = smoothstep(0.06, 0.0, ringD) * glow;

    // --- RAYS -------------------------------------------------
    // spokes jitter with noise; also slowly rotate with the sweep.
    float rayAng = (ang / TAU) + 0.5;               // 0..1 around circle
    float jitter = jitAmt * (noise(vec2(rayAng * rayCount, t * 0.4)) - 0.5);
    float rayF = fract(rayAng * rayCount + jitter + t * 0.05);
    float rayD = min(rayF, 1.0 - rayF);
    // rays fade near the very center (avoid the singularity mess)
    float ray = smoothstep(0.06, 0.0, rayD) * glow * smoothstep(0.02, 0.15, r);

    // --- ROTATING SWEEP (radar arm) ---------------------------
    // angular gradient rotating around the origin; brightest at the arm,
    // trailing off behind it like a phosphor decay.
    float sweepAng = mod(ang - t * 1.3, TAU) / TAU;  // 0 just behind the arm
    float sweep = pow(1.0 - sweepAng, 4.0);          // sharp leading edge, long tail
    sweep *= smoothstep(0.0, 0.05, r);               // hide the hub

    // --- EVENT: radar ping (h) --------------------------------
    // h spikes to ~1 on a transient then decays. Emit a bright ring that
    // expands from center outward through the whole field: a sonar ping.
    float pingRadius = fract(iTime * 0.9) * 0.9;      // expanding wavefront (0->outer)
    float pingLine = smoothstep(0.05, 0.0, abs(r - pingRadius));
    float ping = pingLine * h * 3.0;                  // <-- h drives the ping brightness

    // --- COMPOSITE FIELDS ------------------------------------
    float lattice = ring + ray;
    float bright  = lattice * (0.35 + sweep * 1.6) + ping;

    // --- COLOR (HSV) -----------------------------------------
    // hue drifts with radius for a spectrum-ring look, plus global rotation.
    float hue = fract(hueRot + r * 0.6 + t * 0.03);
    float sat = 0.85 - 0.25 * sweep;                  // sweep desaturates slightly (hot)
    vec3 col = hsv2rgb(vec3(hue, sat, saturate(bright)));

    // the ping reads as a bright cool-white flash on the wavefront
    col += vec3(0.6, 0.8, 1.0) * ping * 0.7;

    // faint sweep afterglow tint over the whole disc
    col += hsv2rgb(vec3(fract(hue + 0.5), 0.6, 1.0)) * sweep * 0.12 * smoothstep(0.9, 0.0, r);

    // dark radial vignette background
    col *= smoothstep(1.05, 0.2, r) + 0.05;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
