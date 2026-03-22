// Shader 53: Swift-Hohenberg Patterns (from 04-swift-hohenberg.html)
// Procedural Turing-like spot/stripe patterns
//
// a = pattern scale   b = spot vs stripe mix
// c = pattern speed   d = domain warp
// e = hue offset      f = contrast
// g = edge glow       h = brightness

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

float param(float p, float lo, float hi) { return mix(lo, hi, p); }

vec2 hash2(vec2 p) {
    p = vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));
    return fract(sin(p)*43758.5453);
}
float noise(vec2 p) {
    vec2 i=floor(p),f=fract(p);
    vec2 u=f*f*(3.0-2.0*f);
    float a=dot(hash2(i)-0.5,f);
    float b=dot(hash2(i+vec2(1,0))-0.5,f-vec2(1,0));
    float c=dot(hash2(i+vec2(0,1))-0.5,f-vec2(0,1));
    float d=dot(hash2(i+vec2(1,1))-0.5,f-vec2(1,1));
    return mix(mix(a,b,u.x),mix(c,d,u.x),u.y)+0.5;
}
float fbm(vec2 p) {
    float v=0.0,a=0.5;
    for(int i=0;i<5;i++){v+=a*noise(p);p*=2.0;a*=0.5;}
    return v;
}

vec3 hsv2rgb(vec3 c) {
    vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0);
    vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www);
    return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (uv - 0.5) * vec2(iResolution.x/iResolution.y, 1.0);

    float patScale = param(a, 5.0, 25.0);
    float spotStripe = param(b, 0.0, 1.0);
    float patSpd   = param(c, 0.1, 1.0);
    float warp     = param(d, 0.0, 2.0);
    float hueOff   = param(e, 0.0, 1.0);
    float contrast = param(f, 0.5, 2.0);
    float edgeG    = param(g, 0.0, 1.0);
    float bright   = param(h, 0.5, 1.5);

    float t = iTime * patSpd;

    // Domain warp
    vec2 wp = p * patScale;
    float n1 = noise(wp * 0.2 + vec2(t * 0.3, 0.0));
    float n2 = noise(wp * 0.2 + vec2(0.0, t * 0.2));
    wp += vec2(n1 - 0.5, n2 - 0.5) * warp * 3.0;

    // Swift-Hohenberg-like pattern: spots form from interference of waves
    float pattern = 0.0;
    for (float i = 0.0; i < 6.0; i++) {
        float angle = i * 3.14159265 / 3.0 + t * 0.1 * (1.0 + spotStripe * 0.5);
        // For stripes: fewer angles, for spots: more angles
        if (spotStripe < 0.5 && i > 2.0) {
            angle = i * 3.14159265 / 3.0 * 2.0;
        }
        vec2 dir = vec2(cos(angle), sin(angle));
        pattern += cos(dot(wp, dir) + t * 0.5);
    }
    pattern /= 6.0;

    // Add fbm modulation for organic variation
    float organic = fbm(wp * 0.3 + t * 0.1);
    pattern = pattern * 0.7 + organic * 0.3;

    // Threshold for spot pattern
    float spots = smoothstep(-0.1 * contrast, 0.1 * contrast, pattern);

    // Edge detection
    float eps = 0.05;
    float pL = 0.0, pR = 0.0;
    for (float i = 0.0; i < 6.0; i++) {
        float angle = i * 3.14159265 / 3.0 + t * 0.1 * (1.0 + spotStripe * 0.5);
        if (spotStripe < 0.5 && i > 2.0) angle = i * 3.14159265 / 3.0 * 2.0;
        vec2 dir = vec2(cos(angle), sin(angle));
        pL += cos(dot(wp + vec2(eps, 0.0), dir) + t * 0.5);
        pR += cos(dot(wp - vec2(eps, 0.0), dir) + t * 0.5);
    }
    float edge = abs(pL - pR) / 6.0 * 10.0;

    vec3 col1 = hsv2rgb(vec3(fract(hueOff), 0.7, 0.8 * bright));
    vec3 col2 = hsv2rgb(vec3(fract(hueOff + 0.5), 0.6, 0.3 * bright));
    vec3 col = mix(col2, col1, spots);
    col += vec3(0.4, 0.6, 1.0) * edge * edgeG * 0.3;


    fragColor = vec4(col, 1.0);
}
