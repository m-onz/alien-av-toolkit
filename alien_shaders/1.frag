// Shader 37: Corrupted Data
// Glitchy, grimey digital corruption with scan lines
// a-d = corruption intensity, e-g = glitch rate, h = noise density

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

float hash_f(float nn) { return fract(sin(nn) * 43758.5453); }
float hash2_f(vec2 pp) { return fract(sin(dot(pp, vec2(127.1, 311.7))) * 43758.5453); }

float noise_f(vec2 pp) {
    vec2 ii = floor(pp);
    vec2 ff = fract(pp);
    ff = ff * ff * (3.0 - 2.0 * ff);
    return mix(mix(hash2_f(ii), hash2_f(ii + vec2(1.0, 0.0)), ff.x),
               mix(hash2_f(ii + vec2(0.0, 1.0)), hash2_f(ii + vec2(1.0, 1.0)), ff.x), ff.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float tt = iTime;
    
    float corruption = (a + b + c + d) * 0.6;
    float glitchRate = 2.0 + (e + f + g) * 5.0;
    float noiseDensity = 50.0 + h * 150.0;
    
    // Glitch time - jumps randomly
    float glitchTime = floor(tt * glitchRate);
    float glitchPhase = hash_f(glitchTime);
    
    // Horizontal tear/displacement
    float tearY = hash_f(glitchTime * 7.0) * 2.0 - 1.0;
    float tearHeight = 0.05 + hash_f(glitchTime * 13.0) * 0.15;
    float inTear = smoothstep(tearHeight, 0.0, abs(uv.y - tearY)) * corruption;
    
    vec2 glitchUV = uv;
    glitchUV.x += (hash_f(glitchTime * 3.0) - 0.5) * 0.3 * inTear;
    glitchUV.x += (hash_f(floor(uv.y * 20.0) + glitchTime) - 0.5) * 0.1 * corruption;
    
    // Block corruption
    vec2 blockUV = floor(glitchUV * 15.0);
    float blockGlitch = step(0.85 - corruption * 0.3, hash2_f(blockUV + vec2(glitchTime)));
    glitchUV += vec2(hash2_f(blockUV) - 0.5, hash2_f(blockUV + vec2(1.0)) - 0.5) * 0.1 * blockGlitch;
    
    // Wave distortion - wavy screen warp
    float waveAmt = corruption * 0.03;
    glitchUV.x += sin(glitchUV.y * 40.0 + tt * 8.0) * waveAmt;
    glitchUV.y += sin(glitchUV.x * 30.0 + tt * 6.0) * waveAmt * 0.5;
    
    // Feedback zoom effect - layers zooming in
    vec2 feedbackUV = glitchUV;
    float feedbackAccum = 0.0;
    for (int fb = 0; fb < 5; fb++) {
        float scale = 1.0 + float(fb) * 0.08;
        float fade = 1.0 - float(fb) * 0.18;
        vec2 fbUV = feedbackUV * scale;
        fbUV += vec2(sin(tt * 0.5 + float(fb)), cos(tt * 0.4 + float(fb))) * 0.02;
        feedbackAccum += noise_f(fbUV * noiseDensity * 0.3) * fade;
    }
    feedbackAccum *= 0.3;
    
    // Base noise layers
    float n1 = noise_f(glitchUV * noiseDensity + vec2(tt * 0.5));
    float n2 = noise_f(glitchUV * noiseDensity * 0.5 - vec2(tt * 0.3));
    float n3 = noise_f(glitchUV * noiseDensity * 2.0 + vec2(tt * 0.7, -tt * 0.4));
    
    // Scan lines
    float scanLine = sin(fragCoord.y * 1.5) * 0.5 + 0.5;
    scanLine = pow(scanLine, 0.3);
    
    // Thick scan line bands
    float scanBand = sin(uv.y * 30.0 + tt * 2.0) * 0.5 + 0.5;
    scanBand = smoothstep(0.4, 0.6, scanBand);
    
    // RGB channel separation
    float rOffset = (hash_f(glitchTime * 11.0) - 0.5) * 0.02 * corruption;
    float bOffset = (hash_f(glitchTime * 17.0) - 0.5) * 0.02 * corruption;
    
    vec2 rUV = glitchUV + vec2(rOffset, 0.0);
    vec2 bUV = glitchUV + vec2(bOffset, 0.0);
    float rNoise = noise_f(rUV * noiseDensity);
    float gNoise = n1;
    float bNoise = noise_f(bUV * noiseDensity);
    
    // Dark grimey color palette
    vec3 darkCol = vec3(0.02, 0.01, 0.03);
    vec3 midCol = vec3(0.15, 0.08, 0.12);
    vec3 accentCol = vec3(0.4, 0.15, 0.2);
    vec3 glitchCol = vec3(0.0, 0.8, 0.6);
    
    // Build base
    float baseNoise = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
    vec3 col = mix(darkCol, midCol, baseNoise);
    
    // Add feedback layer
    col += midCol * feedbackAccum;
    
    // Add grime texture
    float grime = noise_f(glitchUV * 200.0) * noise_f(glitchUV * 80.0 + vec2(tt * 0.1));
    col = mix(col, darkCol, grime * 0.5);
    
    // VHS tracking lines - horizontal bands that drift
    float trackingY = mod(uv.y + tt * 0.1, 0.3) / 0.3;
    float tracking = smoothstep(0.0, 0.05, trackingY) * smoothstep(0.15, 0.1, trackingY);
    tracking *= corruption * 0.5;
    col = mix(col, col * 0.3, tracking);
    
    // Interlace jitter - odd/even line offset
    float interlace = mod(fragCoord.y, 2.0);
    vec2 interlaceUV = glitchUV + vec2(interlace * 0.003 * corruption, 0.0);
    float interlaceNoise = noise_f(interlaceUV * noiseDensity);
    col = mix(col, col * (0.8 + interlaceNoise * 0.4), 0.3);
    
    // Data moshing - blocky smear
    vec2 moshBlock = floor(glitchUV * 8.0);
    float moshTrigger = step(0.9 - corruption * 0.15, hash2_f(moshBlock + vec2(floor(tt * 0.5))));
    vec2 moshDir = vec2(hash2_f(moshBlock * 3.0) - 0.5, hash2_f(moshBlock * 5.0) - 0.5) * 0.2;
    vec2 moshedUV = glitchUV + moshDir * moshTrigger;
    float moshNoise = noise_f(moshedUV * noiseDensity * 0.5);
    col = mix(col, vec3(moshNoise * 0.3, moshNoise * 0.15, moshNoise * 0.2), moshTrigger * 0.6);
    
    // Chromatic aberration
    col.r = mix(col.r, rNoise * 0.4, corruption * 0.5);
    col.b = mix(col.b, bNoise * 0.5, corruption * 0.5);
    
    // Glitch color bursts
    float glitchBurst = step(0.92 - corruption * 0.1, hash2_f(blockUV * 3.0 + vec2(glitchTime)));
    col = mix(col, glitchCol, glitchBurst * 0.7);
    col = mix(col, accentCol, blockGlitch * 0.4);
    
    // Scan line overlay
    col *= 0.7 + scanLine * 0.3;
    col = mix(col, col * 0.6, scanBand * 0.3);
    
    // Horizontal tear highlight
    col += accentCol * inTear * 0.5;
    
    // Random bright pixels (dead pixels)
    float deadPixel = step(0.997, hash2_f(floor(fragCoord.xy * 0.5) + vec2(glitchTime * 0.1)));
    col += vec3(1.0) * deadPixel;
    
    // Bit crush / posterize effect
    float bitDepth = 8.0 - corruption * 5.0;
    col = floor(col * bitDepth) / bitDepth;
    
    // Rolling shutter - diagonal wave
    float rollShutter = sin(uv.x * 10.0 + uv.y * 15.0 + tt * 4.0) * 0.5 + 0.5;
    rollShutter = smoothstep(0.4, 0.6, rollShutter) * corruption * 0.2;
    col = mix(col, col * 0.5, rollShutter);
    
    // Vignette - dark edges
    float vig = 1.0 - length(uv) * 0.8;
    vig = max(0.0, vig);
    col *= vig;
    
    // Flicker
    float flicker = 0.9 + 0.1 * sin(tt * 30.0 + hash_f(glitchTime) * 100.0);
    col *= flicker;
    
    // Energy boost
    float totalEnergy = a + b + c + d + e + f + g;
    col *= 0.6 + totalEnergy * 0.4;
    
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
