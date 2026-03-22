// Shader 50: Soliton River (ported from soliton-river.html)
// Traveling wave packets through procedural channel networks
//
// a = soliton count
// b = channel depth
// c = wave speed
// d = dispersion
// e = hue offset
// f = channel glow
// g = terrain roughness
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
float cosh_f(float x) { return (exp(x)+exp(-x))*0.5; }

vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = dot(hash2(i) - 0.5, f);
    float b = dot(hash2(i + vec2(1, 0)) - 0.5, f - vec2(1, 0));
    float c = dot(hash2(i + vec2(0, 1)) - 0.5, f - vec2(0, 1));
    float d = dot(hash2(i + vec2(1, 1)) - 0.5, f - vec2(1, 1));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) + 0.5;
}

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float aspect = iResolution.x / iResolution.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 10.0;

    float solN      = param(a, 3.0, 15.0);
    float chanDepth = param(b, 0.2, 1.0);
    float waveSpd   = param(c, 0.5, 3.0);
    float disp      = param(d, 0.5, 3.0);
    float hueOff    = param(e, 0.0, 1.0);
    float chanGlow  = param(f, 0.3, 2.0);
    float terrRough = param(g, 0.3, 1.0);
    float bright    = param(h, 0.5, 2.0);

    float t = iTime;

    // Terrain from fbm
    float terrain = fbm(p * 0.3) * terrRough;

    // Channel network from terrain gradient (rivers flow downhill)
    float eps = 0.1;
    float tL = fbm((p + vec2(-eps, 0.0)) * 0.3);
    float tR = fbm((p + vec2(eps, 0.0)) * 0.3);
    float tU = fbm((p + vec2(0.0, eps)) * 0.3);
    float tD = fbm((p + vec2(0.0, -eps)) * 0.3);
    vec2 grad = vec2(tR - tL, tU - tD) / (2.0 * eps);
    float channelness = length(grad);
    // Channels form where gradient changes direction (valleys)
    float laplacian = (tL + tR + tU + tD - 4.0 * terrain / terrRough) * 10.0;
    float channel = smoothstep(-0.1, 0.3, laplacian) * chanDepth;

    // Soliton wave packets
    float totalWave = 0.0;
    for (float i = 0.0; i < 15.0; i++) {
        if (i >= solN) break;
        float fi = i;
        // Each soliton has random direction and speed
        vec2 dir = normalize(vec2(
            sin(fi * 2.39996 + 0.5),
            cos(fi * 1.83 + 0.3)
        ));
        float speed = (1.0 + fract(fi * 0.618) * 0.5) * waveSpd;
        float width = 0.8 + fract(fi * 0.317) * 0.5;
        float amp = 0.3 + fract(fi * 0.731) * 0.4;

        // Soliton position along its direction
        float pos = dot(p, dir) - t * speed + fi * 3.0;
        // Sech-squared envelope
        float sech = 1.0 / cosh_f(pos / width);
        float wave = amp * sech * sech;
        // Carrier wave
        wave *= cos(pos * disp + t * speed * 2.0);
        totalWave += wave;
    }

    // Color: terrain base + channel + wave
    vec3 terrainCol = mix(vec3(0.05, 0.03, 0.02), vec3(0.15, 0.1, 0.05), terrain);
    vec3 channelCol = hsv2rgb(vec3(fract(0.6 + hueOff), 0.7, 0.4)) * channel * chanGlow;

    // Wave color — bright neon
    float waveAbs = abs(totalWave);
    float waveSign = totalWave > 0.0 ? 1.0 : 0.0;
    vec3 waveCol = hsv2rgb(vec3(fract(0.1 + hueOff + waveAbs * 0.2), 0.9, waveAbs * bright));
    waveCol = mix(waveCol, hsv2rgb(vec3(fract(0.55 + hueOff), 0.9, waveAbs * bright)), waveSign);

    vec3 col = terrainCol + channelCol + waveCol;

    // Collision glow where waves overlap
    float collision = max(0.0, waveAbs - 0.5) * 2.0;
    col += vec3(1.0, 0.8, 0.4) * collision * 0.3;


    col = col / (1.0 + col * 0.3);

    fragColor = vec4(col, 1.0);
}
