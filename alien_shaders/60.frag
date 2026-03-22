// Shader 60: Black Hole Simulation
// Gravitational lensing, accretion disk, photon sphere, Doppler beaming
//
// a = mass (event horizon size)    b = disk brightness    c = disk width
// d = rotation speed               e = lensing strength   f = star density
// g = turbulence                   h = brightness

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
#define TAU 6.28318530718

float param(float p, float lo, float hi) { return mix(lo, hi, p); }
float hash_f(float n) { return fract(sin(n) * 43758.5453); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float mass    = param(a, 0.06, 0.2);
    float diskBri = param(b, 0.5, 2.0);
    float diskW   = param(c, 0.05, 0.25);
    float rotSpd  = param(d, 0.2, 2.0);
    float lensStr = param(e, 0.5, 3.0);
    float starDen = param(f, 0.3, 1.5);
    float turb    = param(g, 0.0, 1.0);
    float bright  = param(h, 0.5, 2.0);

    float t = iTime;
    float r = length(uv);
    float ang = atan(uv.y, uv.x);
    float rs = mass;

    // --- Gravitational lensing ---
    float bend = lensStr * rs * rs / (r * r + rs * 0.1);
    vec2 lensedUV = uv * (1.0 + bend);
    float lr = length(lensedUV);
    float la = atan(lensedUV.y, lensedUV.x);

    vec3 col = vec3(0.0);

    // --- Background star field (through lensing) ---
    vec2 sg = floor(lensedUV * 25.0 * starDen);
    float sh = hash_f(dot(sg, vec2(127.1, 311.7)));
    vec2 sp = (sg + 0.5 + (vec2(hash_f(sh * 7.3), hash_f(sh * 13.7)) - 0.5) * 0.7) / (25.0 * starDen);
    float sd = length(lensedUV - sp);
    float star = smoothstep(0.004, 0.0, sd) * step(0.88, sh);
    star *= 0.6 + 0.4 * sin(t * 2.5 + sh * 40.0);
    col += vec3(star * 0.8, star * 0.85, star);

    // Smaller denser star layer
    vec2 sg2 = floor(lensedUV * 60.0 * starDen);
    float sh2 = hash_f(dot(sg2, vec2(269.5, 183.3)));
    vec2 sp2 = (sg2 + 0.5 + (vec2(hash_f(sh2 * 11.3), hash_f(sh2 * 17.1)) - 0.5) * 0.6) / (60.0 * starDen);
    float sd2 = length(lensedUV - sp2);
    float star2 = smoothstep(0.002, 0.0, sd2) * step(0.92, sh2);
    col += vec3(0.4, 0.45, 0.5) * star2;

    // --- Accretion disk ---
    float diskInner = rs * 2.5;
    float diskOuter = diskInner + diskW * 3.0;

    // Ring-shaped mask
    float diskMask = smoothstep(diskInner - 0.01, diskInner + 0.02, lr) *
                     smoothstep(diskOuter + 0.02, diskOuter - 0.01, lr);

    // Keplerian rotation: inner orbits faster
    float orbitalSpeed = rotSpd / (lr * lr * 0.5 + 0.1);
    float diskAngle = la + t * orbitalSpeed;

    // Logarithmic spiral arms
    float spiral = sin(diskAngle * 3.0 - log(max(lr, 0.01)) * 8.0) * 0.5 + 0.5;
    spiral = pow(spiral, 0.7);

    // Turbulence in the disk
    float turbNoise = sin(diskAngle * 11.0 + lr * 30.0 + t * 3.0) * 0.3
                    + sin(diskAngle * 17.0 - lr * 20.0 + t * 1.7) * 0.2;
    spiral += turbNoise * turb;
    spiral = max(spiral, 0.0);

    // Inner disk brighter
    float radialBri = 1.0 / (lr / rs + 0.5);

    // Doppler beaming: approaching side brighter
    float doppler = 1.0 + 0.6 * sin(la + t * rotSpd * 0.5);

    // Temperature gradient: hot inner (white) to cool outer (deep red)
    float temp = clamp((lr - diskInner) / max(diskOuter - diskInner, 0.01), 0.0, 1.0);
    vec3 hotCol = vec3(1.0, 0.95, 0.85);
    vec3 warmCol = vec3(1.0, 0.5, 0.1);
    vec3 coolCol = vec3(0.6, 0.15, 0.02);
    vec3 diskCol = mix(mix(hotCol, warmCol, smoothstep(0.0, 0.4, temp)),
                       coolCol, smoothstep(0.4, 1.0, temp));

    col += diskCol * spiral * radialBri * doppler * diskBri * diskMask * 0.8;

    // --- Photon sphere (thin bright ring) ---
    float photonR = rs * 1.5;
    float photonDist = (lr - photonR) / rs;
    col += vec3(1.0, 0.8, 0.5) * exp(-photonDist * photonDist * 50.0) * 0.8;

    // --- Einstein ring glow ---
    float einsteinR = rs * 2.2;
    float eDist = (r - einsteinR) / rs;
    col += vec3(0.8, 0.6, 0.3) * exp(-eDist * eDist * 10.0) * 0.3;

    // --- Event horizon shadow ---
    float shadow = smoothstep(rs * 1.3, rs * 0.5, r);
    col *= (1.0 - shadow);

    // --- Horizon edge glow ---
    float hDist = (r - rs * 1.1) / rs;
    float edgeGlow = exp(-hDist * hDist * 30.0) * step(rs * 0.8, r);
    col += vec3(0.9, 0.5, 0.15) * edgeGlow * 0.4;

    // --- Gravitational redshift near horizon ---
    float redshift = exp(-(r - rs) * 10.0 / rs) * step(rs, r);
    col = mix(col, col * vec3(1.2, 0.6, 0.3), redshift * 0.4);

    // Tone map
    col *= bright;
    col = col / (1.0 + col * 0.5);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
