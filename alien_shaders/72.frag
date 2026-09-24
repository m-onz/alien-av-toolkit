// ============================================================
// 72.frag — Displaced Lines (oscilloscope stack of waveform scanlines)
// ============================================================
// N evenly-spaced horizontal lines, each pushed off its resting row
// by a travelling sine wave plus fbm noise. They wander and ripple
// like a stack of audio waveforms. Bright thin lines, soft glow, dark
// background. A drum transient whips the amplitude up and flashes white.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = line count (~8 to 128)
//   b = wave amplitude (displacement distance)
//   c = wave frequency (waviness along x)
//   d = noise amount (fbm contribution)
//   e = scroll / time speed
//   f = line thickness / sharpness
//   g = base hue (drifts slowly along the lines)
//   h = EVENT: transient jolt — amplitude whip + white flash
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

// --- helpers ---
float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float saturate(float x) { return clamp(x, 0.0, 1.0); }
float hash(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.13); p3+=dot(p3,p3.yzx+3.333); return fract((p3.x+p3.y)*p3.z); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float v=0.0,amp=0.5; for(int i=0;i<5;i++){ v+=amp*noise(p); p*=2.0; amp*=0.5;} return v; }
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y); }
#define PI 3.14159265359
#define TAU 6.28318530718

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    // centered, aspect-correct coords: y in roughly [-0.5, 0.5]
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // --- map knobs to working ranges ---
    float lineCount = floor(param(a, 8.0, 128.0));   // number of scanlines
    float amp       = param(b, 0.0, 0.18);           // base displacement in uv units
    float freq      = param(c, 1.0, 14.0);           // spatial waviness along x
    float noiseAmt  = param(d, 0.0, 0.12);           // fbm displacement contribution
    float speed     = param(e, 0.05, 2.5);           // scroll speed
    float thickness = param(f, 0.0008, 0.006);       // half-width of the bright core
    float baseHue   = param(g, 0.0, 1.0);            // base color

    float t = iTime * speed;

    // --- EVENT: transient jolt (h) ---
    // h is 0 at rest and spikes toward 1 on a drum hit, then decays.
    // We add a nonlinear kick so the whole stack visibly "snaps": the
    // wave amplitude whips up hard and the lines get a white flash.
    float event   = h * h;                     // sharpen the response curve  <-- h acts here
    amp          += event * 0.35;              // amplitude whip (dwarfs base amp on a hit)
    float whiteFlash = event;                  // drives desaturation + boost below
    float ampBoost   = 1.0 + event * 2.0;      // brighten cores on impact

    // vertical span the lines occupy (a little padding from edges)
    float span   = 0.9;
    float rowGap = span / lineCount;

    // Find which row band this pixel is closest to. Working in the same
    // uv.y space keeps line thickness uniform across the screen.
    float rowF = (uv.y + span * 0.5) / rowGap;   // fractional row index
    float col = 0.0;
    float hueAccum = 0.0;

    // Check the nearest few rows so a displaced line from a neighbouring
    // band can still light up this pixel. 3 candidates is plenty for the
    // amplitudes used here.
    for (int k = -1; k <= 1; k++) {
        float idx = floor(rowF) + float(k);
        if (idx < 0.0 || idx > lineCount - 1.0) continue;

        // resting y for this line
        float restY = idx * rowGap - span * 0.5;

        // per-line phase so lines don't move in lockstep
        float ph = idx * 0.55;

        // travelling sine wave along x + fbm ripple, scrolling in time
        float wave = sin(uv.x * freq + t * 1.7 + ph);
        float n    = fbm(vec2(uv.x * (freq * 0.5) + idx * 3.1, t * 0.6)) - 0.5;

        float dispY = restY + wave * amp + n * noiseAmt * 2.0;

        // distance from pixel to this displaced line, antialiased
        float dist = abs(uv.y - dispY);
        float aa   = fwidth(uv.y) + 1e-5;

        // bright thin core
        float core = 1.0 - smoothstep(thickness, thickness + aa * 1.5, dist);
        // soft glow falloff around it
        float glow = exp(-dist * dist / (thickness * thickness * 42.0)) * 0.55;

        float lineVal = core + glow;

        // hue drifts slowly along the line (with x) and per row
        float hue = baseHue + uv.x * 0.08 + idx * 0.012 + t * 0.01;

        col      += lineVal;
        hueAccum += hue * lineVal;
    }

    // normalize accumulated hue by total brightness
    float hue = (col > 1e-4) ? hueAccum / col : baseHue;

    float sat = mix(0.85, 0.0, whiteFlash);      // flash washes lines to white
    vec3 lineColor = hsv2rgb(vec3(fract(hue), sat, 1.0));

    vec3 background = vec3(0.02, 0.02, 0.035);   // near-black
    vec3 result = background + lineColor * col * ampBoost;

    // extra full-frame lift on impact so the jolt reads instantly
    result += vec3(0.25) * whiteFlash * saturate(col);

    fragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
