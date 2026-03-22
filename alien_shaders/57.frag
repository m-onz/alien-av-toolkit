// Shader 57: DLA Coral Growth (from 08-dla-coral.html)
// Procedural branching dendrite/coral patterns via fbm
// a=branch density b=growth speed c=scale d=branch thickness e=hue f=tip glow g=depth color h=bright

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
vec2 hash2(vec2 p) { p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
float noise(vec2 p) {
    vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    float a=dot(hash2(i)-0.5,f),b=dot(hash2(i+vec2(1,0))-0.5,f-vec2(1,0));
    float c=dot(hash2(i+vec2(0,1))-0.5,f-vec2(0,1)),d=dot(hash2(i+vec2(1,1))-0.5,f-vec2(1,1));
    return mix(mix(a,b,u.x),mix(c,d,u.x),u.y)+0.5;
}
float fbm(vec2 p) { float v=0.0,a=0.5; for(int i=0;i<6;i++){v+=a*noise(p);p*=2.0;a*=0.5;} return v; }
vec3 hsv2rgb(vec3 c) { vec4 K=vec4(1,2./3.,1./3.,3); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (uv - 0.5) * vec2(iResolution.x/iResolution.y, 1.0);
    float density = param(a, 0.3, 0.8);
    float growSpd = param(b, 0.1, 1.0);
    float scale = param(c, 3.0, 10.0);
    float thick = param(d, 0.3, 0.7);
    float hueOff = param(e, 0.0, 1.0);
    float tipGlow = param(f, 0.5, 3.0);
    float depthCol = param(g, 0.0, 1.0);
    float bright = param(h, 0.5, 1.5);
    float t = iTime * growSpd;
    p *= scale;
    // DLA approximation: use fbm with thresholding and radial growth
    float dist = length(p);
    float growthRadius = t * 0.5 + 1.0;
    // Branching pattern from angular noise
    float angle = atan(p.y, p.x);
    float branch = fbm(vec2(angle * 3.0, dist * 2.0) + t * 0.1);
    // More detail at smaller scales
    branch += fbm(vec2(angle * 6.0, dist * 4.0) + t * 0.15) * 0.5;
    branch += fbm(vec2(angle * 12.0, dist * 8.0) + t * 0.2) * 0.25;
    branch = branch / 1.75;
    // Radial growth mask
    float growMask = smoothstep(growthRadius, growthRadius - 0.5, dist);
    // Dendrite threshold
    float dendrite = smoothstep(1.0 - density, 1.0 - density + thick * 0.3, branch) * growMask;
    // Growth tip: where mask meets pattern
    float tip = smoothstep(growthRadius - 0.3, growthRadius, dist) * dendrite;
    // Color: depth-based
    float depthFade = dist / max(growthRadius, 0.1);
    vec3 deepCol = hsv2rgb(vec3(fract(0.75 + hueOff), 0.8, 0.3));
    vec3 surfCol = hsv2rgb(vec3(fract(0.0 + hueOff), 0.7, 0.8));
    vec3 col = mix(surfCol, deepCol, depthFade * depthCol) * dendrite * bright;
    // Tip glow
    col += hsv2rgb(vec3(fract(0.15 + hueOff), 0.3, 1.0)) * tip * tipGlow;
    // Background
    col += vec3(0.0, 0.005, 0.015) * (1.0 - dendrite);
    fragColor = vec4(col, 1.0);
}
