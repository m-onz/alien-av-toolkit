// Shader 66: Boids Murmuration (from 02-boids-murmuration.html)
// Starling murmuration — flowing flock with velocity trails
// a=flock density b=cohesion c=speed d=predator influence e=hue f=trail glow g=spread h=bright

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
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
    return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (uv - 0.5) * vec2(iResolution.x / iResolution.y, 1.0);
    float flockDens = param(a, 0.3, 1.0);
    float cohesion = param(b, 0.5, 2.0);
    float speed = param(c, 0.3, 2.0);
    float predInfl = param(d, 0.0, 1.0);
    float hueOff = param(e, 0.0, 1.0);
    float trailGlow = param(f, 0.5, 3.0);
    float spread = param(g, 0.5, 2.0);
    float bright = param(h, 0.5, 1.5);
    float t = iTime * speed;

    // Flock center of mass - organic orbit
    vec2 flockCenter = vec2(
        sin(t * 0.3) * 0.3 + sin(t * 0.17) * 0.15,
        cos(t * 0.25) * 0.25 + cos(t * 0.13) * 0.1
    );

    // Predator positions that scatter the flock
    vec3 col = vec3(0.0);

    // Multiple flock sub-groups with flowing noise
    for (float layer = 0.0; layer < 4.0; layer++) {
        // Each layer = different noise frequency for density variation
        vec2 lp = (p - flockCenter) * (3.0 + layer) / spread;
        // Flow direction from curl noise
        float n1 = noise(lp + vec2(0.01, 0.0) + t * 0.2);
        float n2 = noise(lp - vec2(0.01, 0.0) + t * 0.2);
        float n3 = noise(lp + vec2(0.0, 0.01) + t * 0.2);
        float n4 = noise(lp - vec2(0.0, 0.01) + t * 0.2);
        vec2 curl = vec2(n3 - n4, n2 - n1) * 50.0;
        // Advect position along flow
        vec2 advP = lp + curl * 0.1 * cohesion;
        // Flock density: concentrated near center with noise variation
        float centerDist = length(p - flockCenter) / spread;
        float envelope = exp(-centerDist * centerDist * 2.0) * flockDens;
        // Bird-like particles from high-frequency noise
        float birds = noise(advP * (8.0 + layer * 5.0) + t * (0.5 + layer * 0.2));
        birds = smoothstep(0.55, 0.65, birds) * envelope;
        // Predator avoidance: gap in flock
        for (float i = 0.0; i < 3.0; i++) {
            vec2 pred = vec2(
                0.35 * sin(t * (0.2 + i * 0.07) + i * 2.1),
                0.35 * cos(t * (0.15 + i * 0.08) + i * 1.7)
            );
            float predDist = length(p - pred);
            birds *= smoothstep(0.05, 0.15 * predInfl + 0.05, predDist);
        }
        // Velocity-based color: heading encodes hue
        float heading = atan(curl.y, curl.x);
        float spd = length(curl) * 0.01;
        // Trail color
        vec3 trailCol;
        trailCol.r = sin(heading) * 0.5 + 0.5;
        trailCol.g = cos(heading) * 0.5 + 0.5;
        trailCol.b = spd;
        col += trailCol * birds * trailGlow * 0.4;
    }
    // Color remap
    vec3 finalCol = vec3(col.r * 1.8, col.g * 1.2, col.b * 2.5 + col.r * 0.3);
    // Hue shift
    if (hueOff > 0.01) {
        float ca = cos(hueOff * 6.2832), sa = sin(hueOff * 6.2832);
        finalCol = vec3(
            finalCol.r*(0.333+0.667*ca) + finalCol.g*(0.333-0.333*ca-0.577*sa) + finalCol.b*(0.333-0.333*ca+0.577*sa),
            finalCol.r*(0.333-0.333*ca+0.577*sa) + finalCol.g*(0.333+0.667*ca) + finalCol.b*(0.333-0.333*ca-0.577*sa),
            finalCol.r*(0.333-0.333*ca-0.577*sa) + finalCol.g*(0.333-0.333*ca+0.577*sa) + finalCol.b*(0.333+0.667*ca)
        );
    }
    finalCol *= bright;
    finalCol = pow(max(finalCol, 0.0), vec3(0.7)) * 1.5;
    finalCol = 1.0 - exp(-finalCol * 2.0);
    fragColor = vec4(finalCol, 1.0);
}
