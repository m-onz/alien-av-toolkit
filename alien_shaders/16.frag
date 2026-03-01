// Shader 16: Strobe Flash
// Bang-triggered hard flash with decay
// a-g = flash envelopes (1 = full flash, decays to 0)
// h = warmth (0 = cool white, 1 = warm white)

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

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    float flash = 0.0;
    flash += a * a;
    flash += b * b;
    flash += c * c;
    flash += d * d;
    flash += e * e;
    flash += f * f;
    flash += g * g;
    
    vec3 coolWhite = vec3(0.95, 0.97, 1.0);
    vec3 warmWhite = vec3(1.0, 0.95, 0.85);
    vec3 tint = mix(coolWhite, warmWhite, h);
    
    float vig = 1.0 - dot(uv, uv) * 0.2;
    vec3 col = tint * flash * vig;
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
