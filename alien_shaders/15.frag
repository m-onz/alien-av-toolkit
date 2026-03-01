// Shader 15: Shockwave Distortion
// Bang-triggered distortion wave that warps outward
// a-g = shockwave envelopes (0->1 expands wave)
// h = intensity/brightness (0-1)

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

vec2 shockwaveDistort(vec2 uv, float env) {
    if (env < 0.001 || env > 0.98) return uv;
    
    float radius = env * 1.8;
    float thickness = 0.12;
    float dist = length(uv);
    
    float wave = smoothstep(radius - thickness, radius, dist) * 
                 smoothstep(radius + thickness, radius, dist);
    
    float strength = wave * (1.0 - env) * 0.25;
    vec2 dir = normalize(uv + 0.001);
    
    return uv + dir * strength;
}

float shockwaveRing(vec2 uv, float env) {
    if (env < 0.001 || env > 0.98) return 0.0;
    float radius = env * 1.8;
    float dist = length(uv);
    return smoothstep(0.03, 0.0, abs(dist - radius)) * (1.0 - env);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    vec2 distortedUV = uv;
    distortedUV = shockwaveDistort(distortedUV, a);
    distortedUV = shockwaveDistort(distortedUV, b);
    distortedUV = shockwaveDistort(distortedUV, c);
    distortedUV = shockwaveDistort(distortedUV, d);
    distortedUV = shockwaveDistort(distortedUV, e);
    distortedUV = shockwaveDistort(distortedUV, f);
    distortedUV = shockwaveDistort(distortedUV, g);
    
    float pattern = sin(distortedUV.x * 30.0) * sin(distortedUV.y * 30.0);
    pattern = pattern * 0.5 + 0.5;
    
    float intensity = pattern * 0.15;
    intensity += shockwaveRing(uv, a);
    intensity += shockwaveRing(uv, b);
    intensity += shockwaveRing(uv, c);
    intensity += shockwaveRing(uv, d);
    intensity += shockwaveRing(uv, e);
    intensity += shockwaveRing(uv, f);
    intensity += shockwaveRing(uv, g);
    
    float brightness = 0.5 + h * 0.5;
    vec3 col = vec3(intensity * brightness);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
