// Shader 28: Colorized Game of Life
// Cellular automata with decay trails and color accumulation
// Based on Conway's Game of Life with visualization
//
// a = birth threshold
// b = survival threshold
// c = decay rate
// d = color shift
// e = cell size
// f = animation speed
// g = noise seed
// h = trail intensity

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

#define PI 3.14159265359

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float cellSize = mix(4.0, 20.0, e);
    vec2 cell = floor(fragCoord / cellSize);
    vec2 cellUV = fract(fragCoord / cellSize);
    
    float speed = mix(0.5, 5.0, f);
    float t = iTime * speed;
    int generation = int(t);
    float genFract = fract(t);
    
    // Seed for initial state
    float seed = mix(0.0, 100.0, g);
    
    // Birth and survival thresholds
    float birthThresh = mix(2.5, 3.5, a);
    float surviveMin = mix(1.5, 2.5, b);
    float surviveMax = mix(3.0, 4.0, b);
    
    // Simulate several generations
    float alive = 0.0;
    float age = 0.0;
    
    // Initial random state
    float state = step(0.5, hash(cell + seed));
    
    // Run generations
    for (int gen = 0; gen < 60; gen++) {
        if (gen >= generation) break;
        
        // Count neighbors
        float neighbors = 0.0;
        for (int dx = -1; dx <= 1; dx++) {
            for (int dy = -1; dy <= 1; dy++) {
                if (dx == 0 && dy == 0) continue;
                vec2 neighbor = cell + vec2(float(dx), float(dy));
                float nState = step(0.5, hash(neighbor + seed + float(gen) * 0.01));
                neighbors += nState;
            }
        }
        
        // Apply rules
        float newState = 0.0;
        if (state > 0.5) {
            // Survival
            if (neighbors >= surviveMin && neighbors <= surviveMax) {
                newState = 1.0;
            }
        } else {
            // Birth
            if (neighbors >= birthThresh && neighbors < birthThresh + 1.0) {
                newState = 1.0;
            }
        }
        
        if (newState > 0.5 && state < 0.5) {
            age = 0.0; // Just born
        } else if (newState > 0.5) {
            age += 1.0;
        }
        
        state = newState;
    }
    
    alive = state;
    
    // Decay for dead cells (trail effect)
    float decay = mix(0.8, 0.99, c);
    float trail = mix(0.0, 1.0, h);
    
    // Color based on age and state
    float hue = mix(0.0, 1.0, d) + age * 0.02;
    hue = fract(hue);
    
    float sat = 0.8;
    float val = alive;
    
    // Add trail glow
    float trailGlow = exp(-age * (1.0 - decay) * 10.0) * trail;
    val = max(val, trailGlow * 0.5);
    
    // Cell border
    float border = smoothstep(0.0, 0.1, cellUV.x) * smoothstep(1.0, 0.9, cellUV.x);
    border *= smoothstep(0.0, 0.1, cellUV.y) * smoothstep(1.0, 0.9, cellUV.y);
    val *= border;
    
    vec3 col = hsv2rgb(vec3(hue, sat, val));
    
    // Add energy glow for living cells
    if (alive > 0.5) {
        float pulse = 0.5 + 0.5 * sin(t * 3.0 + cell.x * 0.5 + cell.y * 0.7);
        col += vec3(0.1, 0.15, 0.2) * pulse;
    }
    
    // Background
    col = max(col, vec3(0.02, 0.025, 0.03));
    
    fragColor = vec4(col, 1.0);
}
