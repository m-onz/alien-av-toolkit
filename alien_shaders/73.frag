// ============================================================
// 73.frag — Grid Warp (a breathing square lattice pushed by a flow field)
// ============================================================
// A crisp square grid of glowing lines (with optional vertex dots) whose
// domain is displaced by a smooth 2D curl-noise flow field before drawing.
// The mesh bends, bulges and swirls organically while staying recognizably
// a grid. A drum transient fires a radial shockwave that punches the grid
// outward from the center on the beat.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = grid density (cells across, ~4 to 40)
//   b = warp strength (flow-field displacement amount)
//   c = flow field scale (spatial frequency of the noise)
//   d = rotation of the whole field over time
//   e = time speed
//   f = render mode blend: lines only -> lines + vertex dots
//   g = palette / hue
//   h = EVENT: radial shockwave — grid punched outward from center on a hit
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
float saturate(float x){ return clamp(x,0.0,1.0); }
float hash(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.13); p3+=dot(p3,p3.yzx+3.333); return fract((p3.x+p3.y)*p3.z); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y); }
#define PI 3.14159265359
#define TAU 6.28318530718

// Scalar potential field we take the curl of. Two scrolling noise octaves
// give a swirly, divergence-free-ish flow when differentiated.
float flowPot(vec2 p, float t)
{
    float v  = noise(p + vec2(0.0, t * 0.6));
    v += 0.5 * noise(p * 2.03 - vec2(t * 0.4, 0.0));
    return v;
}

// Curl of the potential -> a smooth 2D flow vector (swirling, mostly
// incompressible so the grid sloshes rather than just stretches).
vec2 curlFlow(vec2 p, float t)
{
    float eps = 0.06;
    float n1 = flowPot(p + vec2(0.0, eps), t);
    float n2 = flowPot(p - vec2(0.0, eps), t);
    float n3 = flowPot(p + vec2(eps, 0.0), t);
    float n4 = flowPot(p - vec2(eps, 0.0), t);
    // d/dy in x-channel, -d/dx in y-channel = curl of a scalar field
    return vec2(n1 - n2, -(n3 - n4)) / (2.0 * eps);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    // centered, aspect-correct coords: y in roughly [-0.5, 0.5]
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // --- map knobs to working ranges ---
    float density   = param(a, 4.0, 40.0);      // cells across the short axis
    float warp      = param(b, 0.0, 0.35);       // flow displacement amount (uv units)
    float flowScale = param(c, 0.8, 6.0);        // spatial frequency of the flow
    float rotSpeed  = param(d, 0.0, 0.6);        // whole-field rotation over time
    float speed     = param(e, 0.05, 2.0);       // time speed
    float dotMix    = param(f, 0.0, 1.0);        // 0 = lines only, 1 = full vertex dots
    float baseHue   = param(g, 0.0, 1.0);        // palette / hue

    float t = iTime * speed;

    // --- slow rotation of the whole field over time (knob d) ---
    float ang = t * rotSpeed;
    float cs = cos(ang), sn = sin(ang);
    mat2 rot = mat2(cs, -sn, sn, cs);
    vec2 p = rot * uv;

    // --- flow-field domain warp ---
    // Sample a swirling curl-noise flow and offset the coordinates BEFORE
    // drawing the grid, so the lattice itself appears to breathe and swirl.
    vec2 flow = curlFlow(p * flowScale, t);
    vec2 warped = p + flow * warp;

    // --- EVENT: radial shockwave (h) ---
    // h rests at 0 and spikes toward 1 on a drum transient, then decays.
    // We launch an expanding ring of outward displacement from center: the
    // ring radius grows as h decays (so at impact it's tight at the middle
    // and races outward), momentarily punching the grid outward on the beat.
    float event = h * h;                                  // sharpen response  <-- h acts here
    float r = length(p);                                  // distance from center
    float ringR = (1.0 - h) * 1.4;                        // ring sweeps outward as h decays
    float ring = exp(-pow((r - ringR) * 6.0, 2.0));       // gaussian ring profile
    vec2 outward = (r > 1e-4) ? p / r : vec2(0.0);        // radial push direction
    warped += outward * ring * event * 0.6;               // punch grid outward on the hit

    // --- draw the warped grid ---
    // fract() tiles the (displaced) plane; distance to the nearest grid line
    // in each axis gives crisp, antialiased strokes.
    vec2 gp = warped * density;
    vec2 gv = abs(fract(gp) - 0.5);                       // 0 at cell centers, 0.5 at edges
    vec2 gl = 0.5 - gv;                                   // 0 exactly on a grid line

    float aa = fwidth(gp.x) + fwidth(gp.y) + 1e-5;        // screen-space AA width
    float lineW = 0.04;                                   // half-thickness of the stroke

    // nearest of the two axis distances -> the grid line
    float dLine = min(gl.x, gl.y);
    float core  = 1.0 - smoothstep(lineW, lineW + aa, dLine);
    float glow  = exp(-dLine * dLine / (lineW * lineW * 6.0)) * 0.5;
    float lines = core + glow;

    // vertex dots: bright at cell corners (where both axes hit a line)
    float dVert = length(gl);                             // 0 exactly on a vertex
    float dotW  = lineW * 1.6;
    float dots  = 1.0 - smoothstep(dotW, dotW + aa * 1.5, dVert);
    dots += exp(-dVert * dVert / (dotW * dotW * 5.0)) * 0.7;

    // f fades the vertex dots in on top of the lines
    float grid = lines + dots * dotMix;

    // --- color ---
    // Hue drifts with the flow magnitude and position so warped regions
    // shift color, plus the shockwave ring flashes brighter/whiter.
    float flowMag = length(flow);
    float hue = baseHue + flowMag * 0.15 + r * 0.08 + t * 0.02;
    float sat = mix(0.85, 0.0, saturate(ring * event));   // ring washes toward white
    vec3 gridColor = hsv2rgb(vec3(fract(hue), sat, 1.0));

    vec3 background = vec3(0.015, 0.02, 0.035);           // dark, faintly blue
    vec3 col = background + gridColor * grid;

    // extra lift along the shockwave ring so the punch reads instantly
    col += vec3(0.4, 0.5, 0.7) * ring * event * saturate(grid + 0.3);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
