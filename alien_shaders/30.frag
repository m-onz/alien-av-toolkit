// Shader 30: Bendy Tubes
// Raymarched twisting tubes with metallic shading
// a-d = tube bend amount, e-g = twist speed, h = tube count

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

float hash_f(float nn) { return fract(sin(nn) * 43758.5453); }

float noise_f(vec3 pp) {
    vec3 ii = floor(pp);
    vec3 ff = fract(pp);
    ff = ff * ff * (3.0 - 2.0 * ff);
    float nn = dot(ii, vec3(1.0, 57.0, 113.0));
    return mix(mix(mix(hash_f(nn), hash_f(nn + 1.0), ff.x),
                   mix(hash_f(nn + 57.0), hash_f(nn + 58.0), ff.x), ff.y),
               mix(mix(hash_f(nn + 113.0), hash_f(nn + 114.0), ff.x),
                   mix(hash_f(nn + 170.0), hash_f(nn + 171.0), ff.x), ff.y), ff.z);
}

float sdTube(vec3 pp, vec3 tubeStart, vec3 tubeEnd, float radius) {
    vec3 pa = pp - tubeStart;
    vec3 ba = tubeEnd - tubeStart;
    float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * hh) - radius;
}

float scene_f(vec3 pp, float tt, float bendAmt, int numTubes) {
    float dd = 1e10;
    
    for (int ii = 0; ii < 8; ii++) {
        if (ii >= numTubes) break;
        float fi = float(ii);
        
        // Tube path - bendy curve
        float phase = fi * TAU / float(numTubes) + tt * 0.2;
        float bendPhase = tt * 0.3 + fi * 0.7;
        
        // Multiple segments per tube for bendiness
        for (int seg = 0; seg < 6; seg++) {
            float segT = float(seg) / 6.0;
            float nextT = float(seg + 1) / 6.0;
            
            float zStart = -2.0 + segT * 4.0;
            float zEnd = -2.0 + nextT * 4.0;
            
            vec3 tubeStart = vec3(
                sin(phase + zStart * 0.5 + bendPhase) * (0.8 + bendAmt * 0.5),
                cos(phase * 1.3 + zStart * 0.4 + bendPhase * 0.7) * (0.6 + bendAmt * 0.4),
                zStart
            );
            vec3 tubeEnd = vec3(
                sin(phase + zEnd * 0.5 + bendPhase) * (0.8 + bendAmt * 0.5),
                cos(phase * 1.3 + zEnd * 0.4 + bendPhase * 0.7) * (0.6 + bendAmt * 0.4),
                zEnd
            );
            
            float radius = 0.08 + 0.03 * sin(tt + fi * 2.0 + segT * 3.0);
            dd = min(dd, sdTube(pp, tubeStart, tubeEnd, radius));
        }
    }
    
    return dd;
}

vec3 calcNormal_f(vec3 pp, float tt, float bendAmt, int numTubes) {
    vec2 eps = vec2(0.003, 0.0);
    return normalize(vec3(
        scene_f(pp + eps.xyy, tt, bendAmt, numTubes) - scene_f(pp - eps.xyy, tt, bendAmt, numTubes),
        scene_f(pp + eps.yxy, tt, bendAmt, numTubes) - scene_f(pp - eps.yxy, tt, bendAmt, numTubes),
        scene_f(pp + eps.yyx, tt, bendAmt, numTubes) - scene_f(pp - eps.yyx, tt, bendAmt, numTubes)
    ));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float tt = iTime;
    
    float bendAmt = 0.5 + (a + b + c + d) * 0.5;
    float twistSpeed = 0.3 + (e + f + g) * 0.4;
    int numTubes = 4 + int(h * 4.0);
    
    // Camera
    float camAngle = tt * twistSpeed * 0.3;
    vec3 ro = vec3(sin(camAngle) * 3.5, 1.0 * sin(tt * 0.15), cos(camAngle) * 3.5 - 1.0);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.5 * ww);
    
    float totalDist = 0.0;
    vec3 pp = ro;
    bool hitSurface = false;
    
    for (int ii = 0; ii < 80; ii++) {
        pp = ro + rd * totalDist;
        float stepDist = scene_f(pp, tt, bendAmt, numTubes);
        if (stepDist < 0.002) { hitSurface = true; break; }
        if (totalDist > 12.0) break;
        totalDist += stepDist * 0.8;
    }
    
    vec3 col = vec3(0.02, 0.01, 0.03);
    
    if (hitSurface) {
        vec3 nn = calcNormal_f(pp, tt, bendAmt, numTubes);
        vec3 light1 = normalize(vec3(1.0, 2.0, 1.5));
        vec3 light2 = normalize(vec3(-1.0, 0.5, -0.5));
        
        float diff1 = max(0.0, dot(nn, light1));
        float diff2 = max(0.0, dot(nn, light2)) * 0.3;
        
        vec3 refl = reflect(rd, nn);
        float spec1 = pow(max(0.0, dot(refl, light1)), 64.0);
        float spec2 = pow(max(0.0, dot(refl, light2)), 32.0) * 0.5;
        
        float fresnel = pow(1.0 - max(0.0, dot(-rd, nn)), 3.0);
        
        // Color based on position along tube
        float colorPhase = pp.z * 0.3 + tt * 0.05 + atan(pp.y, pp.x) * 0.2;
        vec3 warmCol = vec3(1.0, 0.4, 0.2);
        vec3 midCol = vec3(0.6, 0.2, 0.55);
        vec3 coolCol = vec3(0.2, 0.45, 0.9);
        
        float blend3 = sin(colorPhase * 2.0) * 0.5 + 0.5;
        vec3 baseCol;
        if (blend3 < 0.5) {
            baseCol = mix(warmCol, midCol, blend3 * 2.0);
        } else {
            baseCol = mix(midCol, coolCol, (blend3 - 0.5) * 2.0);
        }
        
        // Iridescent fresnel
        vec3 irid = 0.5 + 0.5 * cos(TAU * (fresnel * 2.0 + tt * 0.1 + vec3(0.0, 0.33, 0.67)));
        baseCol = mix(baseCol, irid, fresnel * 0.5);
        
        col = baseCol * (diff1 * 0.5 + diff2 * 0.2 + 0.2);
        col += vec3(1.0, 0.95, 0.9) * (spec1 + spec2) * 0.5;
        col += irid * fresnel * 0.2;
        
        // Depth fog
        float fog = exp(-totalDist * 0.1);
        col *= fog;
    }
    
    float totalEnergy = a + b + c + d + e + f + g;
    col *= 0.7 + totalEnergy * 0.3;
    
    col = col / (1.0 + col);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
