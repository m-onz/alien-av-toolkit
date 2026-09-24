// ============================================================
// 76.frag — Voronoi Shatter (cracked-glass cellular tessellation)
// ============================================================
// A Voronoi diagram: seed points on an integer grid drift with noise,
// and we render the glowing BORDERS between nearest seeds so it reads
// like living shattered glass. Cells are faintly tinted by id. On a
// transient the seeds scatter hard and the whole diagram cracks apart.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = cell density   (uv scale, ~3 to 30 cells across)
//   b = seed drift      (how far seeds wander from the grid)
//   c = edge sharpness  (glowing crack / border thickness)
//   d = fill variation  (per-cell interior brightness noise)
//   e = drift speed     (how fast seeds wander)
//   f = border glow     (crack line intensity)
//   g = hue             (base tint; cells vary by id hash)
//   h = EVENT: on a transient, SCATTER seeds hard so the diagram
//       cracks and re-forms — a visible shatter on the beat
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
vec2 hash2(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); } // 2D hash -> vec2 in 0..1
float hash(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.13); p3+=dot(p3,p3.yzx+3.333); return fract((p3.x+p3.y)*p3.z); }
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y); }
#define PI 3.14159265359
#define TAU 6.28318530718

// Animated seed offset for the cell at integer coord ip.
// Base grid position 0.5 + a hash-driven drift that orbits over time.
// 'amt' folds in both the drift knob and the transient scatter.
vec2 seedOffset(vec2 ip, float amt, float t)
{
    vec2 rnd = hash2(ip);                 // stable per-cell random in 0..1
    // each seed orbits its own little circle at its own phase/rate
    vec2 phase = rnd * TAU + t * (0.5 + rnd);
    return vec2(0.5) + amt * (0.5 * vec2(sin(phase.x), cos(phase.y)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    // centered, aspect-correct coords
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    // --- knob mapping ---
    float density  = param(a, 3.0, 30.0);   // cells across the view
    float drift    = param(b, 0.0, 0.45);   // base seed wander
    float sharp    = param(c, 0.006, 0.09); // crack width (smaller = crisper)
    float fillVar  = param(d, 0.0, 0.6);    // interior brightness variation
    float speed    = param(e, 0.0, 1.5);    // drift speed
    float glow     = param(f, 0.4, 3.0);    // border glow intensity
    float hueBase  = param(g, 0.0, 1.0);    // base hue

    float t = iTime * speed;

    // EVENT (h): a transient spikes h to ~1 then decays. Add it to the
    // drift so seeds scatter hard and the tessellation visibly cracks
    // and re-forms on the beat. <-- h acts here
    float driftAmt = drift + h * 0.9;

    // work in cell space
    vec2 p  = uv * density;
    vec2 ip = floor(p);      // which cell we're in
    vec2 fp = fract(p);      // position within cell

    // ---- PASS 1: find the nearest seed (F1) --------------------
    // Scan the 3x3 neighbourhood, offset each seed, keep the closest.
    vec2 nearestOff = vec2(0.0);   // vector from fp to nearest seed
    vec2 nearestId  = ip;          // integer id of nearest cell
    float f1 = 1e9;
    for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++)
    {
        vec2 nb   = vec2(float(i), float(j));
        vec2 seed = nb + seedOffset(ip + nb, driftAmt, t); // seed pos rel. to current cell origin
        vec2 diff = seed - fp;
        float d2  = dot(diff, diff);
        if (d2 < f1)
        {
            f1        = d2;
            nearestOff = diff;
            nearestId  = ip + nb;
        }
    }

    // ---- PASS 2: edge distance (Inigo Quilez perpendicular bisector) ----
    // For crisp borders: min distance to the bisector between the nearest
    // seed and every other seed in the neighbourhood.
    float edge = 1e9;
    for (int j = -2; j <= 2; j++)
    for (int i = -2; i <= 2; i++)
    {
        vec2 nb   = vec2(float(i), float(j));
        vec2 seed = nb + seedOffset(ip + nb, driftAmt, t);
        vec2 diff = seed - fp;
        // skip the nearest seed itself (its bisector with itself is degenerate)
        vec2 toOther = diff - nearestOff;
        if (dot(toOther, toOther) > 1e-4)
        {
            // distance from fp to the midplane between nearest seed and this one
            float dEdge = dot(0.5 * (nearestOff + diff), normalize(toOther));
            edge = min(edge, dEdge);
        }
    }

    // ---- BORDERS ------------------------------------------------
    // glowing crack: bright right at the boundary, falling off by 'sharp'.
    float border = smoothstep(sharp, 0.0, edge) * glow;

    // ---- CELL FILL ----------------------------------------------
    // faint interior lit by a per-id hash; darkens toward the seed centre
    // so each shard looks like it catches a little light.
    float idRnd = hash(nearestId);
    float fill  = mix(1.0 - fillVar, 1.0, idRnd);          // per-cell brightness
    fill *= smoothstep(0.9, 0.15, sqrt(f1));               // brighter toward edges
    fill *= 0.18;                                          // keep interiors dim vs cracks

    // ---- COLOR (HSV) --------------------------------------------
    // each cell tinted by its id hash; global hue offset + slow drift.
    float hue = fract(hueBase + idRnd * 0.5 + t * 0.02);
    vec3 cellCol = hsv2rgb(vec3(hue, 0.85, 1.0));

    // cracks glow a hotter, slightly shifted hue
    vec3 crackCol = hsv2rgb(vec3(fract(hue + 0.08), 0.6, 1.0));

    vec3 col = cellCol * fill + crackCol * border;

    // shatter flash: the event also briefly whitens the whole field
    col += vec3(0.7, 0.85, 1.0) * h * border * 0.6;   // <-- h brightens cracks on the beat

    // gentle vignette to seat it on black
    col *= smoothstep(1.25, 0.2, length(uv)) + 0.06;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
