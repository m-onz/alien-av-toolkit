// Shader 44: Morphogenetic Mesh (ported from morpho-mesh.html)
// Raymarched organic organism with branching tentacles
//
// a = branch count
// b = growth pulse speed
// c = body deformation
// d = camera orbit speed
// e = hue shift (inner color)
// f = iridescence amount
// g = subsurface scattering
// h = glow intensity

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

float param(float p, float lo, float hi) { return mix(lo, hi, p); }

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}
float smax(float a, float b, float k) { return -smin(-a, -b, k); }

float organism(vec3 p, float t, float branchN, float pulseSpd, float bodyDef) {
    float breath = 1.0 + 0.1 * sin(t * 0.5);
    float body = length(p) - 0.8 * breath;
    // Sin-based body deformation instead of fbm
    body += (sin(p.x * 2.0 + t * 0.1) * 0.4
           + sin(p.y * 2.5 + p.x * 1.3 + t * 0.15) * 0.3
           + sin(p.z * 3.0 + p.y * 0.8 + t * 0.12) * 0.2) * bodyDef * 0.15;

    float branches = 1e10;
    for (float i = 0.0; i < 6.0; i++) {
        if (i >= branchN) break;
        float a1 = i * 1.047 + t * 0.15 + sin(t * 0.1 + i) * 0.3;
        float a2 = sin(t * 0.2 + i * 1.5) * 0.5;
        vec3 dir = vec3(cos(a1) * cos(a2), sin(a2), sin(a1) * cos(a2));
        float growth = 0.5 + 0.5 * sin(t * pulseSpd * 0.3 + i);
        for (float seg = 0.0; seg < 4.0; seg++) {
            float segT = seg / 4.0 * growth * 2.0;
            vec3 segCenter = dir * segT;
            segCenter += vec3(
                sin(segT * 3.0 + t * 0.5 + i) * 0.15,
                cos(segT * 2.5 + t * 0.4 + i) * 0.12,
                sin(segT * 2.0 + t * 0.3 + i * 2.0) * 0.1
            );
            float radius = 0.15 * (1.0 - segT * 0.3) * breath;
            radius += sin(segT * 8.0 - t * pulseSpd * 2.0) * 0.03;
            float seg_d = length(p - segCenter) - max(radius, 0.02);
            branches = smin(branches, seg_d, 0.2);
        }
    }

    float d = smin(body, branches, 0.3);
    d += sin(p.x * 8.0 + t) * sin(p.y * 7.0 + t * 0.8) * sin(p.z * 9.0 - t * 0.6) * 0.02;

    float cavities = 1e10;
    for (float i = 0.0; i < 3.0; i++) {
        vec3 cc = vec3(sin(t*0.3+i*2.0)*0.3, cos(t*0.25+i*2.5)*0.3, sin(t*0.35+i*1.8)*0.3);
        cavities = min(cavities, length(p - cc) - 0.2 - 0.1 * sin(t + i));
    }
    return smax(d, -cavities, 0.1);
}

vec3 calcNormal(vec3 p, float t, float bn, float ps, float bd) {
    float ep = 0.005;
    vec3 n = vec3(0.0);
    vec3 k;
    k = vec3( 1,-1,-1); n += k * organism(p + k * ep, t, bn, ps, bd);
    k = vec3(-1,-1, 1); n += k * organism(p + k * ep, t, bn, ps, bd);
    k = vec3(-1, 1,-1); n += k * organism(p + k * ep, t, bn, ps, bd);
    k = vec3( 1, 1, 1); n += k * organism(p + k * ep, t, bn, ps, bd);
    return normalize(n);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;

    float branchN  = param(a, 2.0, 6.0);
    float pulseSpd = param(b, 0.5, 3.0);
    float bodyDef  = param(c, 0.2, 1.5);
    float camSpd   = param(d, 0.05, 0.5);
    float hueShift = param(e, 0.0, 1.0);
    float iridAmt  = param(f, 0.0, 1.0);
    float sssAmt   = param(g, 0.0, 0.5);
    float glowAmt  = param(h, 0.1, 0.5);

    float ca = t * camSpd;
    float cb = sin(t * 0.15) * 0.3;
    vec3 ro = vec3(sin(ca)*cos(cb), sin(cb), cos(ca)*cos(cb)) * 3.5;
    vec3 ww = normalize(-ro);
    vec3 uu = normalize(cross(ww, vec3(0, 1, 0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.6 * ww);

    float totalDist = 0.0;
    bool hit = false;
    float lastDist = 1.0;
    vec3 p;
    for (int i = 0; i < 50; i++) {
        p = ro + rd * totalDist;
        lastDist = organism(p, t, branchN, pulseSpd, bodyDef);
        if (lastDist < 0.004) { hit = true; break; }
        if (totalDist > 8.0) break;
        totalDist += lastDist * 0.9;
    }

    vec3 col = vec3(0.0);
    if (hit) {
        vec3 n = calcNormal(p, t, branchN, pulseSpd, bodyDef);
        vec3 ref = reflect(rd, n);
        // Sin-based depth color instead of fbm
        float depth = sin(p.x * 4.0 + t * 0.1) * 0.3 + sin(p.y * 3.0 + p.z * 2.0 + t * 0.15) * 0.3 + 0.4;
        vec3 inner = mix(
            vec3(0.8, 0.1, 0.2) * (1.0 + hueShift),
            vec3(0.2, 0.8, 0.4),
            depth
        );
        float fresnel = pow(1.0 - abs(dot(-rd, n)), 4.0);
        vec3 irid = 0.5 + 0.5 * cos(vec3(1, 2, 3) * fresnel * 8.0 + t * 0.3 + p.x * 2.0);

        vec3 l1 = vec3(0.41, 0.82, 0.41);
        float d1 = max(0.0, dot(n, l1));
        float d2 = max(0.0, dot(n, normalize(vec3(-1.0, -0.5, 0.5)))) * 0.3;
        float spec = pow(max(0.0, dot(ref, l1)), 64.0);
        float sss = max(0.0, dot(normalize(rd + n * 0.5), l1)) * sssAmt;

        col = inner * (d1 + d2 + 0.15 + sss);
        col += spec * vec3(1.0, 0.9, 0.8) * 0.6;
        col = mix(col, irid, fresnel * iridAmt);

        float pulse = sin(length(p) * 8.0 - t * 3.0) * 0.5 + 0.5;
        col += inner * pulse * 0.15;
    }

    // Glow from last known distance (avoid extra organism call when hit)
    float glo = exp(-lastDist * lastDist * 5.0) * glowAmt;
    col += mix(vec3(0.3, 0.05, 0.1), vec3(0.05, 0.2, 0.1), sin(t * 0.5) * 0.5 + 0.5) * glo;
    col = mix(col, vec3(0.02, 0.01, 0.04), 1.0 - exp(-totalDist * 0.1));
    col = col / (1.0 + col);
    col = pow(col, vec3(0.9));

    fragColor = vec4(col, 1.0);
}
