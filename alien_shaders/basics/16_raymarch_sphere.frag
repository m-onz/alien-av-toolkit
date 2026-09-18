// ============================================================
// basics/16 — Raymarching a Sphere
// ============================================================
// The jump into 3D. A ray is shot from the camera through each pixel;
// we step along it until we hit a surface, described by a Signed
// Distance Function (SDF). length(p)-radius is the SDF of a sphere.
// Estimate the normal by sampling the SDF nearby, then light it. This
// is the skeleton of 2.frag (Distorted Mesh Sphere) with nothing
// hidden.
//
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Radius
//   b = Wobble amount (surface displacement)
//   c = Wobble frequency
//   d = Spin speed
//   e = Light hue
//   f = Fresnel rim strength
//   (g,h unused)
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
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.); vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y); }

// Signed distance to a wobbly sphere. Negative inside, positive outside.
float map(vec3 p, float radius, float wob, float freq) {
    float d = length(p) - radius;
    d += sin(p.x*freq)*sin(p.y*freq)*sin(p.z*freq) * wob;   // bumpy surface
    return d;
}

// Surface normal = gradient of the SDF, sampled with tiny offsets.
vec3 calcNormal(vec3 p, float radius, float wob, float freq) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p+e.xyy, radius, wob, freq) - map(p-e.xyy, radius, wob, freq),
        map(p+e.yxy, radius, wob, freq) - map(p-e.yxy, radius, wob, freq),
        map(p+e.yyx, radius, wob, freq) - map(p-e.yyx, radius, wob, freq)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float radius = param(a, 0.4, 1.1);
    float wob    = param(b, 0.0, 0.35);
    float freq   = param(c, 2.0, 12.0);
    float spin   = iTime * param(d, 0.0, 1.5);

    // Camera at z=3 looking toward origin; ray through this pixel.
    vec3 ro = vec3(0.0, 0.0, 3.0);
    vec3 rd = normalize(vec3(uv, -1.5));

    // Spin the world by rotating the ray around Y.
    float cs = cos(spin), sn = sin(spin);
    mat3 rotY = mat3(cs,0,sn, 0,1,0, -sn,0,cs);
    ro = rotY * ro; rd = rotY * rd;

    // March: step forward by the distance to the nearest surface.
    float t = 0.0; bool hit = false;
    for (int i = 0; i < 90; i++) {
        vec3 p = ro + rd * t;
        float dist = map(p, radius, wob, freq);
        if (dist < 0.001) { hit = true; break; }
        if (t > 8.0) break;
        t += dist;
    }

    vec3 col = vec3(0.02, 0.02, 0.05);   // background
    if (hit) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p, radius, wob, freq);
        vec3 lightDir = normalize(vec3(0.6, 0.8, 0.4));
        float diff = max(dot(n, lightDir), 0.0);
        float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * param(f, 0.0, 2.0);

        vec3 base = hsv2rgb(vec3(param(e, 0.0, 1.0), 0.6, 1.0));
        col = base * (0.15 + 0.85 * diff) + fres;
    }

    fragColor = vec4(col, 1.0);
}
