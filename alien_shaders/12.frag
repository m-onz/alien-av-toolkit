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

// --- Inlined helpers ---

float param(float p, float lo, float hi) { return mix(lo, hi, p); }

float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.13); p3 += dot(p3, p3.yzx + 3.333); return fract((p3.x + p3.y) * p3.z); }

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// --- Cellular Automata / Game of Life with Beat Spawning ---
// a = beat/kick envelope (0-1), b = cell size, c = survive range,
// d = seed, e = hue, f = speed, g = trail, h = decay

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float beat = a;                              // kick/beat envelope from Pd
    float cellSize = param(b, 4.0, 20.0);
    vec2 cell = floor(fragCoord / cellSize);
    vec2 cellUV = fract(fragCoord / cellSize);
    float speed = param(f, 0.5, 5.0);
    float t = iTime * speed;
    int generation = int(t);
    float seed = param(d, 0.0, 100.0);
    float birthThresh = 3.0;
    float surviveMin = param(c, 1.5, 2.5);
    float surviveMax = param(c, 3.0, 4.0);

    // --- GoL simulation ---
    float alive = 0.0;
    float age = 0.0;
    float state = step(0.5, hash(cell + vec2(seed)));
    for (int gen = 0; gen < 60; gen++) {
        if (gen >= generation) break;
        float neighbors = 0.0;
        for (int dx = -1; dx <= 1; dx++) {
            for (int dy = -1; dy <= 1; dy++) {
                vec2 neighbor = cell + vec2(float(dx), float(dy));
                float nState = step(0.5, hash(neighbor + vec2(seed + float(gen) * 0.01)));
                float notSelf = min(float(dx * dx + dy * dy), 1.0);
                neighbors += nState * notSelf;
            }
        }
        float newState = 0.0;
        if (state > 0.5) { if (neighbors >= surviveMin && neighbors <= surviveMax) newState = 1.0; }
        else { if (neighbors >= birthThresh && neighbors < birthThresh + 1.0) newState = 1.0; }
        if (newState > 0.5 && state < 0.5) age = 0.0;
        else if (newState > 0.5) age += 1.0;
        state = newState;
    }
    alive = state;

    // --- Beat spawn: creatures appear when beat hits ---
    float spawned = 0.0;
    float spawnBright = 0.0;
    if (beat > 0.1) {
        vec2 res = iResolution.xy / cellSize;  // grid dimensions in cells
        // discrete beat ID — changes each ~beat so spawn positions shift
        float beatID = floor(iTime * 3.0);

        for (int i = 0; i < 8; i++) {
            // each cluster gets a unique spawn center that changes per beatID
            vec2 center = vec2(
                hash(vec2(float(i) * 7.13, beatID * 3.17)) * res.x,
                hash(vec2(float(i) * 13.71, beatID * 7.31)) * res.y
            );
            float dist = length(cell - center);
            float radius = 2.0 + beat * 10.0;  // bigger radius on harder hits

            if (dist < radius) {
                float prob = (1.0 - dist / radius) * beat;
                float r = hash(cell + vec2(float(i) * 5.0, beatID));
                if (r < prob) {
                    spawned = 1.0;
                    spawnBright = beat * (1.0 - dist / radius);
                }
            }
        }
    }

    // merge: beat spawns override dead cells
    if (spawned > 0.5 && alive < 0.5) {
        alive = 1.0;
        age = 0.0;  // fresh creature
    }

    // --- Coloring ---
    float decay = param(h, 0.8, 0.99);
    float trail = param(g, 0.0, 1.0);
    float hue = e + age * 0.02;
    if (spawned > 0.5) hue = e + 0.45 + beat * 0.1;  // distinct hue for spawns
    hue = fract(hue);
    float sat = 0.85;
    float val = alive;

    // trail glow for aging cells
    float trailGlow = exp(-age * (1.0 - decay) * 10.0) * trail;
    val = max(val, trailGlow * 0.5);

    // beat brightness boost on all alive cells
    if (alive > 0.5) val = min(1.0, val + beat * 0.25);

    // cell borders — loosen on beat so cells merge visually
    float bw = mix(0.1, 0.02, beat);
    float border = smoothstep(0.0, bw, cellUV.x) * smoothstep(1.0, 1.0 - bw, cellUV.x);
    border *= smoothstep(0.0, bw, cellUV.y) * smoothstep(1.0, 1.0 - bw, cellUV.y);
    val *= border;

    vec3 col = hsv2rgb(vec3(hue, sat, val));

    // pulse + beat bloom
    if (alive > 0.5) {
        float pulse = 0.5 + 0.5 * sin(t * 3.0 + cell.x * 0.5 + cell.y * 0.7);
        col += vec3(0.1, 0.15, 0.2) * pulse;
        // extra bloom for beat-spawned creatures
        col += vec3(0.25, 0.15, 0.35) * spawnBright;
    }

    col = max(col, vec3(0.02, 0.025, 0.03));
    fragColor = vec4(col, 1.0);
}
