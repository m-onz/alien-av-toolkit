// Shader 54: Kuramoto Chimera (from 07-kuramoto-chimera.html)
// Oscillator phase field with sync/desync chimera regions
//
// a = coupling strength      b = natural frequency spread
// c = chimera scale           d = animation speed
// e = hue offset              f = coherence glow
// g = phase gradient viz      h = brightness

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

#define PI 3.14159265
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

vec3 hsv2rgb(vec3 c) {
    vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0);
    vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www);
    return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (uv - 0.5) * vec2(iResolution.x/iResolution.y, 1.0);

    float coupling  = param(a, 0.0, 2.0);
    float freqSpread= param(b, 0.5, 4.0);
    float chimScale = param(c, 3.0, 12.0);
    float speed     = param(d, 0.3, 2.0);
    float hueOff    = param(e, 0.0, 1.0);
    float cohGlow   = param(f, 0.3, 2.0);
    float gradViz   = param(g, 0.0, 1.0);
    float bright    = param(h, 0.5, 1.5);

    float t = iTime * speed;
    vec2 sp = p * chimScale;

    // Each "oscillator" has a natural frequency from noise
    float natFreq = (noise(sp * 0.5) - 0.5) * freqSpread;

    // Phase: natural frequency + coupling to neighbors creates chimera
    // Synchronized regions: phase varies smoothly
    // Desynchronized: phase varies chaotically
    float syncField = noise(sp * 0.3 + vec2(t * 0.1, 0.0));

    // Chimera: some regions sync (coupling > threshold), others don't
    float syncThresh = 0.3 + 0.2 * sin(t * 0.2);
    float isSync = smoothstep(syncThresh - 0.1, syncThresh + 0.1, syncField);

    // Phase in synced region: smooth wave
    float syncPhase = sin(sp.x * 0.5 + sp.y * 0.3 + t * natFreq * 0.3) * PI;

    // Phase in desynced region: noisy/chaotic
    float desyncPhase = noise(sp * 2.0 + vec2(t * 2.0, t * 1.3)) * PI * 2.0;

    float phase = mix(desyncPhase, syncPhase, isSync * coupling * 0.5);

    // Order parameter: local coherence
    float coherence = isSync;

    // Color from phase
    float hue = fract(phase / (2.0 * PI) + hueOff);
    float val = bright * (0.4 + 0.6 * coherence);

    vec3 col = hsv2rgb(vec3(hue, 0.75 - coherence * 0.2, val));

    // Coherence glow (sync regions brighter)
    col += vec3(0.1, 0.15, 0.3) * coherence * cohGlow;

    // Phase gradient visualization
    float eps = 0.02;
    float phaseR = mix(
        noise((sp+vec2(eps,0.0))*2.0+vec2(t*2.0,t*1.3))*PI*2.0,
        sin((sp.x+eps)*0.5+sp.y*0.3+t*natFreq*0.3)*PI,
        isSync*coupling*0.5
    );
    float phaseGrad = abs(phaseR - phase) / eps;
    col += vec3(1.0, 0.5, 0.2) * smoothstep(5.0, 20.0, phaseGrad) * gradViz * 0.3;


    fragColor = vec4(col, 1.0);
}
