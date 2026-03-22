// Shader 70: Erosion Channels (from torrent-erosion-channels.html)
// Procedural terrain with erosion channel network visualization
// a=rain intensity b=erosion rate c=speed d=scale e=hue f=channel glow g=water vis h=bright

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
vec2 hash2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash2(i), f), dot(hash2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
               mix(dot(hash2(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash2(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y) * 0.5 + 0.5;
}
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = rot * p * 2.0; a *= 0.5; }
    return v;
}

// Procedural erosion channel pattern
float channelPattern(vec2 p, float t, float erosion) {
    // Domain-warped noise creates channel-like patterns
    float w1 = fbm(p * 0.5 + t * 0.02);
    float w2 = fbm(p * 0.5 + t * 0.015 + 5.0);
    vec2 warpedP = p + vec2(w1, w2) * 2.0 * erosion;
    // Multiple channel scales
    float channels = 0.0;
    for (float i = 0.0; i < 3.0; i++) {
        float sc = 1.0 + i * 1.5;
        float n = noise(warpedP * sc);
        // Channel-like: thin valleys in noise
        float ch = 1.0 - abs(2.0 * n - 1.0);
        ch = pow(ch, 4.0 + i * 2.0);
        channels += ch / (1.0 + i * 0.5);
    }
    return channels;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (uv - 0.5) * vec2(iResolution.x / iResolution.y, 1.0);
    float rain = param(a, 0.1, 1.0);
    float erosion = param(b, 0.3, 2.0);
    float speed = param(c, 0.1, 1.0);
    float scale = param(d, 3.0, 10.0);
    float hueOff = param(e, 0.0, 1.0);
    float chGlow = param(f, 0.5, 3.0);
    float waterVis = param(g, 0.0, 1.0);
    float bright = param(h, 0.5, 1.5);
    float t = iTime * speed;
    vec2 sp = p * scale;
    // Terrain height
    float terrain = fbm(sp * 0.8) * 0.5 + 0.5;
    terrain += abs(noise(sp * 1.2)) * 0.15;
    // Bowl shape to collect water
    float dist = length(p) * 1.5;
    terrain += dist * dist * 0.3;
    // Erosion channels
    float channels = channelPattern(sp, t, erosion);
    // Eroded terrain
    float erodedTerrain = terrain - channels * erosion * 0.15;
    // Water: flows in channels, modulated by rain
    float water = channels * rain * 0.5;
    // Pulsing rain
    water *= 0.5 + 0.5 * sin(uv.x * 12.0 + t * 0.5) * cos(uv.y * 10.0 - t * 0.3);
    // Active flow visualization
    float activeFlow = water * noise(sp * 3.0 + t * 2.0);
    // Terrain color
    vec3 terrainColor = mix(
        vec3(0.05, 0.03, 0.02),
        vec3(0.15, 0.12, 0.08),
        smoothstep(0.2, 0.8, erodedTerrain)
    );
    // Channel glow: luminous cyan-white network
    float channelGlowF = smoothstep(0.05, 0.5, channels * chGlow);
    vec3 channelColor = mix(
        vec3(0.0, 0.3, 0.6),
        vec3(0.4, 0.9, 1.0),
        channelGlowF
    ) * channelGlowF * 1.5;
    // Water overlay
    float waterVisMask = smoothstep(0.0, 0.02, water) * waterVis;
    vec3 waterColor = vec3(0.1, 0.2, 0.5) * waterVisMask * 0.8;
    // Active flow highlight
    vec3 flowCol = vec3(0.2, 0.4, 0.6) * smoothstep(0.0, 1.0, activeFlow * 20.0) * 0.3;
    vec3 col = terrainColor + channelColor + waterColor + flowCol;
    // Hue shift
    if (hueOff > 0.01) {
        float ca = cos(hueOff * 6.2832), sa = sin(hueOff * 6.2832);
        col = vec3(
            col.r*(0.333+0.667*ca) + col.g*(0.333-0.333*ca-0.577*sa) + col.b*(0.333-0.333*ca+0.577*sa),
            col.r*(0.333-0.333*ca+0.577*sa) + col.g*(0.333+0.667*ca) + col.b*(0.333-0.333*ca-0.577*sa),
            col.r*(0.333-0.333*ca-0.577*sa) + col.g*(0.333-0.333*ca+0.577*sa) + col.b*(0.333+0.667*ca)
        );
    }
    col *= bright;
    fragColor = vec4(max(col, 0.0), 1.0);
}
