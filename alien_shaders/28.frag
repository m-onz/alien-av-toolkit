// Shader 28: Raymarched Blobs
// Organic blob ecosystem with smooth merging
// a-d = blob count/size, e-g = deformation, h = camera orbit speed

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

float smin_f(float x1, float x2, float kk) {
    float hv = clamp(0.5 + 0.5 * (x2 - x1) / kk, 0.0, 1.0);
    return mix(x2, x1, hv) - kk * hv * (1.0 - hv);
}

float hash_f(float nn) { return fract(sin(nn) * 43758.5453); }

float noise3_f(vec3 pp) {
    vec3 ii = floor(pp);
    vec3 ff = fract(pp);
    ff = ff * ff * (3.0 - 2.0 * ff);
    float nn = dot(ii, vec3(1.0, 57.0, 113.0));
    return mix(mix(mix(hash_f(nn), hash_f(nn + 1.0), ff.x),
                   mix(hash_f(nn + 57.0), hash_f(nn + 58.0), ff.x), ff.y),
               mix(mix(hash_f(nn + 113.0), hash_f(nn + 114.0), ff.x),
                   mix(hash_f(nn + 170.0), hash_f(nn + 171.0), ff.x), ff.y), ff.z);
}

float fbm_f(vec3 pp) {
    float vv = 0.0, amp = 0.5;
    for (int ii = 0; ii < 4; ii++) {
        vv += amp * noise3_f(pp);
        pp *= 2.0;
        amp *= 0.5;
    }
    return vv;
}

vec3 getBlobCenter(int blobIdx, float tt) {
    float fi = float(blobIdx);
    float phase = fi * 0.785398 + tt * 0.3 * (1.0 + fi * 0.1);
    float phase2 = fi * 1.2 + tt * 0.2;
    return vec3(
        sin(phase) * 1.3 * sin(phase2 * 0.7),
        cos(phase * 0.8 + fi) * 0.8 * cos(phase2 * 0.5),
        sin(phase * 0.6 + fi * 2.0) * 1.3 * cos(phase2 * 0.3)
    );
}

float scene_f(vec3 pp, float tt, float deform) {
    float dist = 1e10;
    
    for (int ii = 0; ii < 6; ii++) {
        float fi = float(ii);
        vec3 center = getBlobCenter(ii, tt);
        float radius = 0.3 + 0.12 * sin(tt * 0.5 + fi * 1.7);
        float disp = fbm_f(pp * 2.0 + vec3(tt * 0.2 + fi * 3.0)) * deform;
        dist = smin_f(dist, length(pp - center) - radius + disp, 0.5);
    }
    
    float cRadius = 0.5 + 0.15 * sin(tt * 0.7);
    float cDisp = fbm_f(pp * 3.0 + vec3(tt * 0.15)) * deform;
    dist = smin_f(dist, length(pp) - cRadius + cDisp, 0.7);
    
    return dist;
}

float trailField(vec3 pp, float tt) {
    float field = 0.0;
    
    // Trail for each blob - render past positions
    for (int ii = 0; ii < 6; ii++) {
        float fi = float(ii);
        
        // Sample multiple past positions
        for (int trail = 1; trail < 12; trail++) {
            float trailT = float(trail) * 0.15;
            float pastTime = tt - trailT;
            vec3 pastCenter = getBlobCenter(ii, pastTime);
            
            float fade = 1.0 - trailT / 1.8;
            fade = fade * fade;
            
            float trailRadius = (0.2 + 0.08 * sin(pastTime * 0.5 + fi * 1.7)) * fade;
            float dd = length(pp - pastCenter);
            field += trailRadius * trailRadius / (dd * dd + 0.01) * fade;
        }
    }
    
    // Central blob trail
    for (int trail = 1; trail < 8; trail++) {
        float trailT = float(trail) * 0.12;
        float fade = 1.0 - trailT / 1.0;
        fade = fade * fade;
        float trailRadius = 0.35 * fade;
        float dd = length(pp);
        field += trailRadius * trailRadius / (dd * dd + 0.01) * fade * 0.5;
    }
    
    return field;
}

vec3 calcNormal_f(vec3 pp, float tt, float deform) {
    vec2 eps = vec2(0.002, 0.0);
    return normalize(vec3(
        scene_f(pp + eps.xyy, tt, deform) - scene_f(pp - eps.xyy, tt, deform),
        scene_f(pp + eps.yxy, tt, deform) - scene_f(pp - eps.yxy, tt, deform),
        scene_f(pp + eps.yyx, tt, deform) - scene_f(pp - eps.yyx, tt, deform)
    ));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float tt = iTime;
    
    float deform = 0.1 + (e + f + g) * 0.15;
    float camSpeed = 0.15 + h * 0.3;
    
    float camAngle = tt * camSpeed;
    vec3 ro = vec3(sin(camAngle) * 4.5, 1.5 * sin(tt * 0.1), cos(camAngle) * 4.5);
    vec3 ta = vec3(0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.8 * ww);
    
    float totalDist = 0.0;
    vec3 pp = ro;
    bool hitSurface = false;
    
    for (int ii = 0; ii < 60; ii++) {
        pp = ro + rd * totalDist;
        float stepDist = scene_f(pp, tt, deform);
        if (stepDist < 0.003) { hitSurface = true; break; }
        if (totalDist > 15.0) break;
        totalDist += stepDist;
    }
    
    // Trail feedback effect - sample trail along ray
    vec3 trailSamplePos = ro + rd * 5.0;
    float trail = trailField(trailSamplePos, tt);
    
    // Multiple depth samples for volumetric trail
    for (int ss = 1; ss < 6; ss++) {
        float sampleDist = 3.0 + float(ss) * 1.5;
        vec3 samplePos = ro + rd * sampleDist;
        trail += trailField(samplePos, tt) * (1.0 - float(ss) * 0.15);
    }
    
    trail = smoothstep(0.3, 2.0, trail);
    
    // Trail color - follows blob color palette
    float trailPhase = trail * 0.5 + uv.y * 0.2 + tt * 0.03;
    vec3 trailWarm = vec3(0.5, 0.15, 0.1);
    vec3 trailMid = vec3(0.3, 0.1, 0.35);
    vec3 trailCool = vec3(0.1, 0.15, 0.4);
    
    float trailBlend = sin(trailPhase * 2.0) * 0.5 + 0.5;
    vec3 trailCol;
    if (trailBlend < 0.5) {
        trailCol = mix(trailWarm, trailMid, trailBlend * 2.0);
    } else {
        trailCol = mix(trailMid, trailCool, (trailBlend - 0.5) * 2.0);
    }
    
    // Dark base with trail glow
    vec3 bgCol = vec3(0.02, 0.01, 0.03);
    bgCol += trailCol * trail * 0.6;
    
    vec3 col = bgCol;
    
    if (hitSurface) {
        vec3 nn = calcNormal_f(pp, tt, deform);
        vec3 light = normalize(vec3(1.0, 2.0, 1.0));
        float diffuse = max(0.0, dot(nn, light));
        float fresnel = pow(1.0 - max(0.0, dot(-rd, nn)), 3.0);
        float spec = pow(max(0.0, dot(reflect(rd, nn), light)), 32.0);
        
        // Surface texture from noise
        float surfaceTex = noise3_f(pp * 8.0 + tt * 0.2) * 0.3 + 0.85;
        float microTex = noise3_f(pp * 25.0) * 0.15 + 0.92;
        
        // Color gradient based on position and normal
        float colorPhase = dot(nn, pp) * 0.5 + tt * 0.03;
        vec3 warmCol = vec3(1.0, 0.4, 0.2);
        vec3 midCol = vec3(0.6, 0.2, 0.5);
        vec3 coolCol = vec3(0.2, 0.4, 0.9);
        
        float blend3 = sin(colorPhase * 2.0) * 0.5 + 0.5;
        vec3 baseCol;
        if (blend3 < 0.5) {
            baseCol = mix(warmCol, midCol, blend3 * 2.0);
        } else {
            baseCol = mix(midCol, coolCol, (blend3 - 0.5) * 2.0);
        }
        
        // Iridescent fresnel
        vec3 irid = 0.5 + 0.5 * cos(6.28318 * (fresnel * 2.0 + tt * 0.1 + vec3(0.0, 0.33, 0.67)));
        baseCol = mix(baseCol, irid, fresnel * 0.4);
        
        // Apply lighting
        vec3 litCol = baseCol * (diffuse * 0.5 + 0.3);
        litCol += vec3(1.0, 0.95, 0.9) * spec * 0.5;
        litCol += irid * fresnel * 0.2;
        
        // Apply textures
        litCol *= surfaceTex * microTex;
        
        float ao = 1.0;
        for (int jj = 1; jj <= 3; jj++) {
            float fj = float(jj) * 0.1;
            ao -= (fj - scene_f(pp + nn * fj, tt, deform)) * 0.25 / float(jj);
        }
        litCol *= max(0.3, ao);
        
        col = litCol;
    }
    
    float glowVal = exp(-scene_f(ro + rd * totalDist, tt, deform) * 3.0) * 0.1;
    vec3 glowCol = vec3(0.8, 0.4, 0.6) * glowVal;
    col += glowCol;
    
    float totalEnergy = a + b + c + d + e + f + g;
    col *= 0.7 + totalEnergy * 0.3;
    
    // Tone mapping
    col = col / (1.0 + col);
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
