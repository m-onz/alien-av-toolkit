// Shader 26: Fabric Weave
// Ultra-dense fabric/weave texture with flowing waves and tears
// a-d = tear intensity, e-g = wave motion, h = wave scale

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

#define TAU 6.28318530

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    float tearAmt = (a + b + c + d) * 0.8;
    float waveAmt = 0.5 + (e + f + g) * 1.0;
    float waveScale = 1.0 + h * 2.0;
    
    // High density fabric - 400 is the sweet spot
    float density = 400.0;
    
    // Large-scale wave displacement
    vec2 wave = vec2(
        sin(uv.y * 8.0 * waveScale + t * 1.5) * cos(uv.x * 6.0 * waveScale + t),
        cos(uv.x * 7.0 * waveScale + t * 1.2) * sin(uv.y * 5.0 * waveScale + t * 0.8)
    ) * waveAmt * 0.02;
    
    // Tear/rip displacement
    float tearNoise = fbm(uv * 3.0 + t * 0.2);
    vec2 tearDisp = vec2(
        fbm(uv * 4.0 + vec2(10.0, 0.0) + t * 0.15) - 0.5,
        fbm(uv * 4.0 + vec2(0.0, 10.0) + t * 0.15) - 0.5
    ) * tearAmt * tearNoise * 0.08;
    
    vec2 wuv = uv + wave + tearDisp;
    
    // Create weave pattern
    vec2 gridUV = wuv * density;
    vec2 cellUV = fract(gridUV);
    vec2 cellID = floor(gridUV);
    
    // Horizontal and vertical threads
    float threadH = smoothstep(0.4, 0.5, cellUV.y) * smoothstep(0.6, 0.5, cellUV.y);
    float threadV = smoothstep(0.4, 0.5, cellUV.x) * smoothstep(0.6, 0.5, cellUV.x);
    
    // Weave pattern - threads go over/under
    float weavePhase = mod(cellID.x + cellID.y, 2.0);
    float thread = weavePhase > 0.5 ? max(threadH, threadV * 0.7) : max(threadV, threadH * 0.7);
    
    // Tear holes in fabric
    float tearHole = smoothstep(0.6, 0.8, tearNoise * tearAmt);
    thread *= 1.0 - tearHole;
    
    // Color gradient across fabric - warm to cool
    float colorPhase = (uv.x + uv.y) * 0.5 + t * 0.03;
    vec3 warmCol = vec3(0.9, 0.35, 0.15);
    vec3 coolCol = vec3(0.15, 0.35, 0.75);
    vec3 midCol = vec3(0.6, 0.25, 0.5);
    
    // Smooth 3-way blend
    float blend = sin(colorPhase) * 0.5 + 0.5;
    vec3 baseCol;
    if (blend < 0.5) {
        baseCol = mix(warmCol, midCol, blend * 2.0);
    } else {
        baseCol = mix(midCol, coolCol, (blend - 0.5) * 2.0);
    }
    
    // Thread direction affects color slightly
    vec3 threadCol = baseCol;
    if (weavePhase > 0.5) {
        threadCol = mix(baseCol, baseCol * 1.2, 0.2);
    } else {
        threadCol = mix(baseCol, baseCol * 0.85, 0.2);
    }
    
    // Stretched threads get hotter
    float stretch = length(wave + tearDisp) * 20.0;
    threadCol = mix(threadCol, vec3(1.0, 0.6, 0.3), smoothstep(0.0, 0.5, stretch) * 0.4);
    
    // Fake 3D shading from wave displacement
    vec3 normal = normalize(vec3(-wave * 30.0, 1.0));
    vec3 light = normalize(vec3(0.5, 0.8, 1.0));
    float diff = max(0.0, dot(normal, light));
    float spec = pow(max(0.0, dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0))), 16.0);
    
    // Build color
    vec3 col = threadCol * thread;
    col *= diff * 0.5 + 0.5;
    col += vec3(1.0, 0.95, 0.9) * spec * thread * 0.3;
    
    // Tear edge glow
    float tearEdge = smoothstep(0.5, 0.65, tearNoise * tearAmt) * (1.0 - tearHole);
    col += vec3(1.0, 0.5, 0.2) * tearEdge * 0.4;
    
    // Subtle fabric texture
    float microTex = noise(gridUV * 0.5) * 0.1 + 0.9;
    col *= microTex;
    
    // Energy boost
    float energy = a + b + c + d + e + f + g;
    col *= 0.7 + energy * 0.3;
    
    // Tone mapping
    col = col / (1.0 + col);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
