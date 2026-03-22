// Shader 71: Particle Ecosystem (from particle-ecosystem.html)
// 5-species cyclic predator-prey with flowing trails
// a=species count b=interaction c=speed d=scale e=hue f=trail glow g=overlap intensity h=bright

/////////////////////////start Pd Header
uniform vec3 iResolution;
uniform float iTime;
uniform float iGlobalTime;
uniform vec4 iMouse;
uniform float a, b, c, d, e, f, g, h;
void mainImage(out vec4 fragColor, in vec2 fragCoord);
void main() { mainImage(gl_FragColor, gl_FragCoord.xy); }
/////////////////////////end Pd Header

#define PI 3.14159265
float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash(float n) { return fract(sin(n) * 43758.5453); }
vec2 hash2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash2(i) - 0.5, f), dot(hash2(i + vec2(1, 0)) - 0.5, f - vec2(1, 0)), u.x),
               mix(dot(hash2(i + vec2(0, 1)) - 0.5, f - vec2(0, 1)), dot(hash2(i + vec2(1, 1)) - 0.5, f - vec2(1, 1)), u.x), u.y) + 0.5;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (uv - 0.5) * vec2(iResolution.x / iResolution.y, 1.0);
    float specN = param(a, 3.0, 5.0);
    float interact = param(b, 0.3, 1.5);
    float speed = param(c, 0.3, 2.0);
    float scale = param(d, 3.0, 8.0);
    float hueOff = param(e, 0.0, 1.0);
    float trailGlow = param(f, 0.5, 3.0);
    float overlapInt = param(g, 0.5, 2.0);
    float bright = param(h, 0.5, 1.5);
    float t = iTime * speed;
    vec2 sp = p * scale;

    // 5 species with cyclic predator-prey: each chases next, flees previous
    // Approximate with flowing noise fields per species
    float species[5];
    // Unroll the species array
    float s0 = 0.0, s1 = 0.0, s2 = 0.0, s3 = 0.0, s4 = 0.0;

    for (float i = 0.0; i < 5.0; i++) {
        if (i >= specN) break;
        // Each species has unique flow direction
        float angle = i * 2.0 * PI / 5.0 + t * 0.2;
        vec2 flow = vec2(cos(angle), sin(angle)) * t * 0.3;
        // Domain warp for organic motion
        float w1 = noise(sp * 0.4 + flow + i * 10.0) * interact * 2.0;
        float w2 = noise(sp * 0.4 - flow * 0.7 + i * 10.0 + 5.0) * interact * 2.0;
        vec2 warpedP = sp + vec2(w1, w2);
        // Cyclic chase/flee: offset flow direction based on neighbors
        float chaseAngle = (i + 1.0) * 2.0 * PI / 5.0 + t * 0.3;
        float fleeAngle = (i - 1.0) * 2.0 * PI / 5.0 + t * 0.3;
        vec2 chase = vec2(cos(chaseAngle), sin(chaseAngle)) * interact * 0.3;
        vec2 flee = -vec2(cos(fleeAngle), sin(fleeAngle)) * interact * 0.2;
        warpedP += chase + flee;
        // Multiple flock centers per species
        float density = 0.0;
        for (float j = 0.0; j < 4.0; j++) {
            vec2 center = vec2(
                sin(t * 0.15 + i * 2.4 + j * 3.7) * 2.0,
                cos(t * 0.12 + i * 1.8 + j * 2.9) * 2.0
            );
            float r = length(warpedP - center);
            density += exp(-r * r * 0.3);
        }
        // Fine particle texture
        float particles = noise(warpedP * 3.0 + flow * 2.0);
        particles = pow(particles, 2.0) * density;
        float val = particles * trailGlow * 0.3;
        if (i < 0.5) s0 = val;
        else if (i < 1.5) s1 = val;
        else if (i < 2.5) s2 = val;
        else if (i < 3.5) s3 = val;
        else s4 = val;
    }

    // Species colors
    vec3 col = vec3(0.0);
    col += vec3(1.0, 0.15, 0.3) * s0;   // red-pink
    col += vec3(0.1, 0.9, 0.35) * s1;    // green
    col += vec3(0.2, 0.35, 1.0) * s2;    // blue
    col += vec3(1.0, 0.8, 0.1) * s3;     // yellow
    col += vec3(0.7, 0.2, 0.9) * s4;     // purple

    // Overlap zones glow white
    float minSpecies = min(min(s0, s1), min(s2, s3));
    minSpecies = min(minSpecies, s4);
    col += vec3(1.0, 0.9, 0.7) * minSpecies * overlapInt * 10.0;

    // Hue shift
    if (hueOff > 0.01) {
        float ca = cos(hueOff * 6.2832), sa = sin(hueOff * 6.2832);
        col = vec3(
            col.r*(0.333+0.667*ca) + col.g*(0.333-0.333*ca-0.577*sa) + col.b*(0.333-0.333*ca+0.577*sa),
            col.r*(0.333-0.333*ca+0.577*sa) + col.g*(0.333+0.667*ca) + col.b*(0.333-0.333*ca-0.577*sa),
            col.r*(0.333-0.333*ca-0.577*sa) + col.g*(0.333-0.333*ca+0.577*sa) + col.b*(0.333+0.667*ca)
        );
    }

    // Tone map
    col *= bright;
    col = 1.0 - exp(-col * 1.5);
    col = pow(max(col, 0.0), vec3(0.85));
    fragColor = vec4(col, 1.0);
}
