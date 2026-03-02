// Shader 23: Ink Splash
// Bang-triggered ink splatter that spreads outward
// a-g = splash envelopes (0->1 spreads ink)
// h = texture detail (0 = smooth, 1 = rough)

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

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec3 hash3(float p) {
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p, float detail) {
    float f = 0.0;
    float amp = 0.5;
    int octaves = 2 + int(detail * 3.0);
    for (int i = 0; i < 5; i++) {
        if (i >= octaves) break;
        f += amp * noise(p);
        p *= 2.0;
        amp *= 0.5;
    }
    return f;
}

vec4 renderSplash(vec2 uv, float env, float chId, float detail, float t) {
    if (env < 0.001 || env > 0.98) return vec4(0.0);
    
    vec3 rnd = hash3(chId * 137.0 + 42.0);
    vec2 center = (rnd.xy - 0.5) * 0.4;
    vec2 p = uv - center;
    
    float angle = atan(p.y, p.x);
    float r = length(p);
    
    float edge = fbm(vec2(angle * 2.5, chId * 8.0), detail) * 0.5 + 0.5;
    float splashRadius = env * 0.7 * (0.6 + edge * 0.5);
    
    float splash = smoothstep(splashRadius, splashRadius - 0.08, r);
    float texture = fbm(p * 6.0 + chId * 8.0, detail);
    splash *= 0.8 + texture * 0.2;
    
    float fade = 1.0 - env * 0.4;
    float alpha = splash * fade;
    
    // Unique color per splash with iridescent shifting
    vec3 baseHue = 0.5 + 0.5 * cos(6.28318 * (chId * 0.15 + vec3(0.0, 0.33, 0.67)));
    
    // Edge iridescence
    float edgeDist = abs(r - splashRadius * 0.9);
    vec3 edgeIrid = 0.5 + 0.5 * cos(6.28318 * (angle * 0.5 + t * 0.1 + vec3(0.0, 0.33, 0.67)));
    float edgeMask = smoothstep(0.1, 0.0, edgeDist) * splash;
    
    // Metallic sheen based on texture
    float sheen = pow(texture, 2.0) * 0.8;
    vec3 sheenCol = mix(baseHue, vec3(1.0), sheen);
    
    // Warm/cool variation across splash
    vec3 warmCol = vec3(1.0, 0.5, 0.3);
    vec3 coolCol = vec3(0.3, 0.5, 1.0);
    vec3 tempCol = mix(coolCol, warmCol, fbm(p * 3.0 + chId, detail));
    
    vec3 splashCol = mix(baseHue, tempCol, 0.4);
    splashCol = mix(splashCol, sheenCol, sheen * 0.5);
    splashCol = mix(splashCol, edgeIrid, edgeMask * 0.6);
    
    return vec4(splashCol * alpha, alpha);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    
    vec3 col = vec3(0.0);
    float totalAlpha = 0.0;
    
    vec4 s0 = renderSplash(uv, a, 0.0, h, t);
    vec4 s1 = renderSplash(uv, b, 1.0, h, t);
    vec4 s2 = renderSplash(uv, c, 2.0, h, t);
    vec4 s3 = renderSplash(uv, d, 3.0, h, t);
    vec4 s4 = renderSplash(uv, e, 4.0, h, t);
    vec4 s5 = renderSplash(uv, f, 5.0, h, t);
    vec4 s6 = renderSplash(uv, g, 6.0, h, t);
    
    // Blend splashes with additive color mixing
    col += s0.rgb; totalAlpha += s0.a;
    col += s1.rgb; totalAlpha += s1.a;
    col += s2.rgb; totalAlpha += s2.a;
    col += s3.rgb; totalAlpha += s3.a;
    col += s4.rgb; totalAlpha += s4.a;
    col += s5.rgb; totalAlpha += s5.a;
    col += s6.rgb; totalAlpha += s6.a;
    
    // Where splashes overlap, create iridescent blend
    if (totalAlpha > 1.0) {
        vec3 overlapIrid = 0.5 + 0.5 * cos(6.28318 * (totalAlpha * 0.5 + t * 0.05 + vec3(0.0, 0.33, 0.67)));
        col = mix(col, col * overlapIrid, min(totalAlpha - 1.0, 1.0) * 0.3);
    }
    
    // Subtle specular highlights
    float spec = pow(max(0.0, fbm(uv * 8.0 + t * 0.1, h)), 4.0) * totalAlpha;
    col += vec3(1.0, 0.95, 0.9) * spec * 0.3;
    
    // Tone mapping
    col = col / (1.0 + col);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
