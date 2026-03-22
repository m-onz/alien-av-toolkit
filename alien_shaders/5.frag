/////////////////////////start Pd Header
uniform vec3 iResolution;
uniform float iTime;
uniform float iGlobalTime;
uniform vec4 iMouse;
uniform float a, b, c, d, e, f, g, h;

void mainImage(out vec4 fragColor, in vec2 fragCoord);

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
/////////////////////////end Pd Header

// ============================================================
// 5.frag — Spiky Plasma Sphere
// ============================================================
// PARAM MAP (all inputs 0.0–1.0 from Pd):
//   a = Spike height — amplitude of sharp protrusions
//   b = Spike count — frequency of spike pattern
//   c = Plasma scale — frequency of interference bands
//   d = Rotation speed — rate of sphere rotation
//   e = Band contrast — sharpness of plasma banding
//   f = Speed — animation rate
//   g = Pulse — rhythmic contraction/expansion
//   h = Roughness — secondary high-freq displacement noise
// ============================================================

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3 saturate3(vec3 x) { return clamp(x, 0.0, 1.0); }
float param(float p, float lo, float hi) { return mix(lo, hi, p); }

#define PI 3.14159265359
#define TAU 6.28318530718

// --- Hash ---
float hash31(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// --- Spike displacement ---
float spikeDisp(vec3 n, float spikeCount, float t) {
    float spikes = 0.0;
    spikes += pow(abs(sin(n.x * spikeCount + t)), 8.0);
    spikes += pow(abs(sin(n.y * spikeCount * 1.1 + t * 0.7)), 8.0);
    spikes += pow(abs(sin(n.z * spikeCount * 0.9 + t * 1.3)), 8.0);
    spikes += pow(abs(sin((n.x + n.y) * spikeCount * 0.7 + t * 0.5)), 8.0);
    spikes += pow(abs(sin((n.y + n.z) * spikeCount * 0.8 - t * 0.6)), 8.0);
    spikes += pow(abs(sin((n.x - n.z) * spikeCount * 0.6 + t * 0.9)), 8.0);
    return spikes / 6.0;
}

// --- Roughness ---
float roughness(vec3 p) {
    return hash31(floor(p * 20.0)) * 0.5 + 0.5;
}

// --- Plasma interference pattern ---
float plasma(vec3 p, float scale, float t) {
    // Layered sine waves at different orientations and frequencies
    float v = 0.0;
    v += sin(p.x * scale + t);
    v += sin(p.y * scale * 1.3 - t * 0.7);
    v += sin(p.z * scale * 0.9 + t * 1.1);
    v += sin((p.x + p.y) * scale * 0.7 + t * 0.5);
    v += sin((p.y - p.z) * scale * 0.8 - t * 0.8);
    v += sin((p.x * p.z) * scale * 0.3 + t * 0.6);
    // Warp with self-feedback
    v += sin(p.x * scale * 2.0 + v * 0.5);
    v += sin(p.y * scale * 1.7 - v * 0.3 + t);
    return v / 8.0;
}

// --- Rotation ---
mat3 rotY(float ang) { float c = cos(ang), s = sin(ang); return mat3(c,0,s, 0,1,0, -s,0,c); }
mat3 rotX(float ang) { float c = cos(ang), s = sin(ang); return mat3(1,0,0, 0,c,-s, 0,s,c); }

// --- Sphere SDF with spike displacement ---
float sphereSDF(vec3 p, float radius, float spikeH, float spikeCount, float rough, float t) {
    float base = length(p) - radius;
    vec3 n = normalize(p);
    float spk = spikeDisp(n, spikeCount, t * 0.4) * spikeH;
    float rgh = (roughness(n * 10.0 + t * 0.1) - 0.5) * rough;
    return base - spk - rgh;
}

// --- Raymarching ---
float raymarch(vec3 ro, vec3 rd, float radius, float spikeH, float spikeCount, float rough, float t) {
    float dist = 0.0;
    for (int i = 0; i < 90; i++) {
        vec3 p = ro + rd * dist;
        float sd = sphereSDF(p, radius, spikeH, spikeCount, rough, t);
        if (abs(sd) < 0.0008) break;
        if (dist > 5.0) break;
        dist += sd * 0.6;
    }
    return dist;
}

// --- Normal estimation ---
vec3 calcNormal(vec3 p, float radius, float spikeH, float spikeCount, float rough, float t) {
    vec2 ep = vec2(0.001, 0.0);
    return normalize(vec3(
        sphereSDF(p + ep.xyy, radius, spikeH, spikeCount, rough, t) -
        sphereSDF(p - ep.xyy, radius, spikeH, spikeCount, rough, t),
        sphereSDF(p + ep.yxy, radius, spikeH, spikeCount, rough, t) -
        sphereSDF(p - ep.yxy, radius, spikeH, spikeCount, rough, t),
        sphereSDF(p + ep.yyx, radius, spikeH, spikeCount, rough, t) -
        sphereSDF(p - ep.yyx, radius, spikeH, spikeCount, rough, t)
    ));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float spikeH      = param(a, 0.0, 0.5);
    float spikeCount  = param(b, 3.0, 15.0);
    float plasmaScale = param(c, 3.0, 20.0);
    float rotSpeed    = param(d, 0.1, 1.5);
    float bandContrast = param(e, 1.0, 5.0);
    float speed       = param(f, 0.1, 1.0);
    float pulseAmt    = param(g, 0.0, 0.3);
    float rough       = param(h, 0.0, 0.15);

    float t = iTime * speed;
    float radius = 0.8 + sin(t * 2.0) * pulseAmt;

    // Camera
    vec3 ro = vec3(0.0, 0.0, 2.5);
    vec3 rd = normalize(vec3(uv, -1.0));

    // Rotate
    mat3 rot = rotY(t * rotSpeed) * rotX(t * rotSpeed * 0.3);
    vec3 ro2 = rot * ro;
    vec3 rd2 = rot * rd;

    float dist = raymarch(ro2, rd2, radius, spikeH, spikeCount, rough, t);

    vec3 col = vec3(0.0);

    if (dist < 5.0) {
        vec3 p = ro2 + rd2 * dist;
        vec3 nor = calcNormal(p, radius, spikeH, spikeCount, rough, t);
        vec3 sn = normalize(p);

        // Plasma interference on surface
        float plas = plasma(sn, plasmaScale, t);
        // Create sharp interference bands
        float bands = sin(plas * bandContrast * PI) * 0.5 + 0.5;
        float bands2 = sin(plas * bandContrast * PI * 2.3 + 1.0) * 0.5 + 0.5;
        float pattern = bands * 0.7 + bands2 * 0.3;

        // Lighting
        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
        float diff = max(dot(nor, lightDir), 0.0);
        float spec = pow(max(dot(reflect(-lightDir, nor), -normalize(rd2)), 0.0), 16.0);
        float fres = pow(1.0 - max(dot(nor, -normalize(rd2)), 0.0), 3.0);

        float surface = pattern * (0.3 + 0.7 * diff);
        surface += spec * 0.3;
        surface += fres * 0.15;

        col = vec3(surface);
    }

    // Background glow
    float bgGlow = exp(-length(uv) * 2.0) * 0.03;
    col += bgGlow;

    col = saturate3(col);
    fragColor = vec4(col, 1.0);
}
