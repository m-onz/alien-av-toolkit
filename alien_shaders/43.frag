// Shader 43: Constraint Sculpture (ported from bet-constraint-sculpture.html)
// Raymarched sphere carved by constraint planes/surfaces — via negativa
//
// a = constraint rate (how many active constraints)
// b = carve depth
// c = rotation speed
// d = hue offset
// e = glow intensity (surviving regions)
// f = constraint animation speed
// g = surface roughness
// h = brightness

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

#define PI 3.14159265

float param(float p, float lo, float hi) { return mix(lo, hi, p); }

float hash(float n) { return fract(sin(n) * 43758.5453); }

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float evaluateConstraint(vec3 p, float id, float t) {
    float type = mod(floor(hash(id * 137.0) * 4.0), 4.0);
    vec3 normal = normalize(vec3(
        hash(id * 7.0) - 0.5,
        hash(id * 13.0) - 0.5,
        hash(id * 19.0) - 0.5
    ));
    float offset = (hash(id * 31.0) - 0.5) * 0.8;
    float freq = 1.0 + hash(id * 41.0) * 4.0;
    float phase = hash(id * 53.0) * PI * 2.0;

    // Animate constraint
    offset += sin(t * 0.3 + id) * 0.2;

    float val = 0.0;
    if (type < 1.0) {
        val = dot(p, normal) - offset;
    } else if (type < 2.0) {
        vec3 center = vec3(hash(id*61.0)-0.5, hash(id*67.0)-0.5, hash(id*71.0)-0.5) * 1.5;
        float radius = 0.2 + hash(id*79.0) * 0.6;
        val = radius - length(p - center);
    } else if (type < 3.0) {
        int axis = int(mod(floor(hash(id*83.0)*3.0), 3.0));
        float coord = axis == 0 ? p.x : (axis == 1 ? p.y : p.z);
        val = sin(coord * freq + phase + t * 0.5) * 0.3 - 0.1;
    } else {
        float r = length(p.xz) - 0.6;
        val = 0.25 - sqrt(r * r + p.y * p.y);
    }
    return val;
}

float sceneSDF(vec3 p, float t, float numConstraints, float carveAmt, float rough) {
    float sphere = length(p) - 1.2;
    sphere += sin(p.x*8.0+t)*sin(p.y*7.0)*sin(p.z*9.0) * rough * 0.02;

    float totalCarve = 0.0;
    for (float i = 0.0; i < 12.0; i++) {
        if (i >= numConstraints) break;
        float carve = evaluateConstraint(normalize(p), i, t);
        if (carve > 0.0) totalCarve += carve;
    }

    return sphere + totalCarve * carveAmt;
}

vec3 calcNormal(vec3 p, float t, float nc, float ca, float ro) {
    vec2 e = vec2(0.002, 0.0);
    return normalize(vec3(
        sceneSDF(p+e.xyy,t,nc,ca,ro) - sceneSDF(p-e.xyy,t,nc,ca,ro),
        sceneSDF(p+e.yxy,t,nc,ca,ro) - sceneSDF(p-e.yxy,t,nc,ca,ro),
        sceneSDF(p+e.yyx,t,nc,ca,ro) - sceneSDF(p-e.yyx,t,nc,ca,ro)
    ));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float numC   = param(a, 2.0, 12.0);
    float carve  = param(b, 0.2, 1.5);
    float rotSpd = param(c, 0.1, 1.0);
    float hueOff = param(d, 0.0, 1.0);
    float glow   = param(e, 0.5, 3.0);
    float animSpd= param(f, 0.2, 2.0);
    float rough  = param(g, 0.0, 1.0);
    float bright = param(h, 0.5, 2.0);

    float t = iTime * animSpd;

    float ca = t * rotSpd;
    float cb = sin(t * 0.15) * 0.3;
    vec3 ro = vec3(sin(ca)*cos(cb), sin(cb), cos(ca)*cos(cb)) * 3.5;
    vec3 ta = vec3(0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0, 1, 0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.6 * ww);

    float totalDist = 0.0;
    bool hit = false;
    vec3 p;
    for (int i = 0; i < 80; i++) {
        p = ro + rd * totalDist;
        float dist = sceneSDF(p, t, numC, carve, rough);
        if (dist < 0.002) { hit = true; break; }
        if (totalDist > 10.0) break;
        totalDist += dist * 0.8;
    }

    vec3 col = vec3(0.02, 0.01, 0.04);

    if (hit) {
        vec3 n = calcNormal(p, t, numC, carve, rough);
        vec3 ref = reflect(rd, n);
        float fresnel = pow(1.0 - max(0.0, dot(-rd, n)), 3.0);

        // Constraint coloring
        float totalC = 0.0;
        float hueAccum = 0.0;
        for (float i = 0.0; i < 12.0; i++) {
            if (i >= numC) break;
            float cv = evaluateConstraint(normalize(p), i, t);
            if (cv > 0.0) {
                totalC += cv;
                hueAccum += hash(i * 23.7) * cv;
            }
        }
        float hue = fract(hueAccum / max(totalC, 0.01) + hueOff);
        float survivalGlow = totalC < 0.1 ? glow : 1.0 / (1.0 + totalC * 2.0);

        vec3 baseCol = hsv2rgb(vec3(hue, 0.7, 0.5 * survivalGlow * bright));

        vec3 l1 = normalize(vec3(2, 3, 2));
        vec3 l2 = normalize(vec3(-2, 1, -2));
        float d1 = max(0.0, dot(n, l1));
        float d2 = max(0.0, dot(n, l2)) * 0.3;
        float spec = pow(max(0.0, dot(ref, l1)), 64.0);

        col = baseCol * (d1 + d2 + 0.15);
        col += spec * vec3(1.0, 0.9, 0.8) * 0.5;

        vec3 irid = 0.5 + 0.5 * cos(vec3(1, 2, 3) * fresnel * 6.0 + t * 0.3);
        col = mix(col, irid, fresnel * 0.4);
    }

    col = col / (1.0 + col);
    fragColor = vec4(col, 1.0);
}
