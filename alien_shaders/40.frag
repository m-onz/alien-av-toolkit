// Shader 40: Domain Warp Fluid (ported from domain-warp-fluid.html)
// Triple domain warping with fbm — hypnotic fluid patterns
//
// a = warp intensity
// b = speed
// c = scale / zoom
// d = rotation speed
// e = hue offset
// f = vein brightness
// g = contrast / saturation
// h = shadow depth

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

vec3 mod289v3(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289v4(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 perm(vec4 x){return mod289v4(((x*34.0)+1.0)*x);}

float noise(vec3 p){
    vec3 aa=floor(p);
    vec3 dd=p-aa;
    dd=dd*dd*(3.0-2.0*dd);
    vec4 bb=aa.xxyy+vec4(0,1,0,1);
    vec4 k1=perm(bb.xyxy);
    vec4 k2=perm(k1.xyxy+bb.zzww);
    vec4 cc=k2+aa.zzzz;
    vec4 k3=perm(cc);
    vec4 k4=perm(cc+1.0);
    vec4 o1=fract(k3*(1.0/41.0));
    vec4 o2=fract(k4*(1.0/41.0));
    vec4 o3=o2*dd.z+o1*(1.0-dd.z);
    vec2 o4=o3.yw*dd.x+o3.xz*(1.0-dd.x);
    return o4.y*dd.y+o4.x*(1.0-dd.y);
}

float fbm(vec3 p){
    float v=0.0,amp=0.5;
    vec3 shift=vec3(100.0);
    for(int i=0;i<5;i++){
        v+=amp*noise(p);
        p=p*2.0+shift;
        amp*=0.5;
    }
    return v;
}

float warpedFbm(vec3 p, float t, float warpAmt){
    vec3 q = vec3(
        fbm(p + vec3(0.0, 0.0, t*0.1)),
        fbm(p + vec3(5.2, 1.3, t*0.12)),
        fbm(p + vec3(2.1, 7.8, t*0.08))
    );
    vec3 r = vec3(
        fbm(p + warpAmt*q + vec3(1.7, 9.2, t*0.15)),
        fbm(p + warpAmt*q + vec3(8.3, 2.8, t*0.13)),
        fbm(p + warpAmt*q + vec3(3.1, 5.7, t*0.11))
    );
    return fbm(p + warpAmt*r + vec3(t*0.05));
}

vec3 palette(float t, float hueOff){
    vec3 aa=vec3(0.5);
    vec3 bb=vec3(0.5);
    vec3 cc=vec3(1.0);
    vec3 dd=vec3(hueOff, hueOff+0.1, hueOff+0.2);
    return aa+bb*cos(6.28318*(cc*t+dd));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 uv = (fragCoord - 0.5*iResolution.xy) / iResolution.y;

    float warpAmt   = param(a, 2.0, 6.0);
    float speed     = param(b, 0.3, 2.0);
    float scale     = param(c, 1.5, 5.0);
    float rotSpeed  = param(d, 0.0, 0.3);
    float hueOff    = param(e, 0.0, 1.0);
    float veinBri   = param(f, 0.0, 1.0);
    float contrast  = param(g, 0.8, 2.0);
    float shadow    = param(h, 0.2, 0.8);

    float t = iTime * speed;

    float angle = t * rotSpeed;
    mat2 rot = mat2(cos(angle),-sin(angle),sin(angle),cos(angle));
    uv = rot * uv;

    vec3 p = vec3(uv * scale, 0.0);

    float f1 = warpedFbm(p, t, warpAmt);
    float f2 = warpedFbm(p + vec3(3.3, 7.7, 1.1), t * 1.1 + 10.0, warpAmt);

    vec3 col1 = palette(f1 + t*0.05, hueOff);
    vec3 col2 = palette(f2 + t*0.07 + 0.33, hueOff);

    float blend1 = smoothstep(0.3, 0.7, f1);
    vec3 col = mix(col1, col2, blend1);

    // Veins from gradient approximation
    col += vec3(0.6, 0.2, 0.8) * veinBri * smoothstep(0.4, 0.6, abs(f1 - f2) * 5.0) * 0.4;

    col *= shadow + (1.0-shadow) * f1;

    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, contrast);
    col = pow(max(col, 0.0), vec3(0.9)) * 1.3;


    fragColor = vec4(col, 1.0);
}
