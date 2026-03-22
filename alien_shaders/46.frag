// Shader 46: Raymarched Blobs (ported from raymarched-blobs.html)
// Iridescent blob ecosystem with smooth merging
//
// a = blob count (fewer to more)
// b = merge smoothness
// c = deformation amount
// d = camera orbit speed
// e = color cycle speed
// f = iridescence
// g = specular
// h = glow

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

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
    return mix(b, a, h) - k*h*(1.0-h);
}

// Sin-based displacement replacing fbm (no hash lookups)
float sinDisp(vec3 p) {
    float v = sin(p.x + p.z * 0.7) * 0.3;
    v += sin(p.y * 1.3 + p.x * 0.5) * 0.25;
    v += sin(p.z * 1.7 + p.y * 0.4) * 0.2;
    v += sin((p.x + p.y + p.z) * 0.8) * 0.15;
    return v * 0.5 + 0.5;
}

float blobScene(vec3 p, float t, float blobN, float smth, float deform) {
    float d = 1e10;
    for(float i=0.0;i<8.0;i++){
        if(i>=blobN) break;
        float phase=i*0.785398+t*0.3*(1.0+i*0.1);
        float phase2=i*1.2+t*0.2;
        vec3 center=vec3(
            sin(phase)*1.5*sin(phase2*0.7),
            cos(phase*0.8+i)*1.0*cos(phase2*0.5),
            sin(phase*0.6+i*2.0)*1.5*cos(phase2*0.3)
        );
        float radius=0.35+0.15*sin(t*0.5+i*1.7);
        float disp=sinDisp(p*2.0+t*0.2+i*3.0)*deform;
        d=smin(d,length(p-center)-radius+disp,smth);
    }
    float cRadius=0.6+0.2*sin(t*0.7);
    float cDisp=sinDisp(p*3.0+t*0.15)*deform*1.3;
    d=smin(d,length(p)-cRadius+cDisp,smth*1.3);
    return d;
}

vec3 calcNormal(vec3 p, float t, float bn, float sm, float df) {
    float ep=0.005;
    vec3 n=vec3(0.0);
    vec3 k;
    k=vec3( 1,-1,-1); n+=k*blobScene(p+k*ep,t,bn,sm,df);
    k=vec3(-1,-1, 1); n+=k*blobScene(p+k*ep,t,bn,sm,df);
    k=vec3(-1, 1,-1); n+=k*blobScene(p+k*ep,t,bn,sm,df);
    k=vec3( 1, 1, 1); n+=k*blobScene(p+k*ep,t,bn,sm,df);
    return normalize(n);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv=(fragCoord-0.5*iResolution.xy)/iResolution.y;
    float t=iTime;

    float blobN   = param(a, 3.0, 8.0);
    float smth  = param(b, 0.2, 1.0);
    float deform  = param(c, 0.05, 0.3);
    float camSpd  = param(d, 0.05, 0.4);
    float colSpd  = param(e, 0.1, 1.0);
    float iridAmt = param(f, 0.2, 0.9);
    float specAmt = param(g, 0.3, 1.5);
    float glowAmt = param(h, 0.05, 0.3);

    float camAngle=t*camSpd;
    vec3 ro=vec3(sin(camAngle)*5.0,2.0*sin(t*0.1),cos(camAngle)*5.0);
    vec3 ww=normalize(-ro);
    vec3 uu=normalize(cross(ww,vec3(0,1,0)));
    vec3 vv=cross(uu,ww);
    vec3 rd=normalize(uv.x*uu+uv.y*vv+1.8*ww);

    float totalDist=0.0;
    float lastDist=1.0;
    bool hit=false;
    vec3 p;
    for(int i=0;i<50;i++){
        p=ro+rd*totalDist;
        lastDist=blobScene(p,t,blobN,smth,deform);
        if(lastDist<0.004){hit=true;break;}
        if(totalDist>10.0)break;
        totalDist+=lastDist*0.9;
    }

    vec3 col=vec3(0.0);
    if(hit){
        vec3 n=calcNormal(p,t,blobN,smth,deform);
        vec3 ref=reflect(rd,n);
        float fresnel=pow(1.0-max(0.0,dot(-rd,n)),3.0);

        vec3 baseColor=0.5+0.5*cos(vec3(0,1,2)*2.0+p.x*0.5+p.y*0.7+p.z*0.3+t*colSpd);
        vec3 l1=vec3(0.41,0.82,0.41);
        float diff=max(0.0,dot(n,l1));
        float diff2=max(0.0,dot(n,vec3(-0.67,0.33,-0.67)))*0.3;
        float spec=pow(max(0.0,dot(ref,l1)),32.0);

        col=baseColor*(diff*0.6+diff2+0.2);
        col+=spec*vec3(1.0,0.9,0.8)*specAmt;

        vec3 iridescence=0.5+0.5*cos(vec3(1,2,3)*fresnel*6.0+t*0.5);
        col=mix(col,iridescence,fresnel*iridAmt);
        col+=baseColor*max(0.0,dot(rd,l1))*0.15;
    }

    float glow=exp(-lastDist*3.0)*glowAmt;
    col+=(0.5+0.5*cos(vec3(0.5,1.5,2.5)+t*0.4))*glow;
    col=col/(1.0+col);
    col=pow(col,vec3(0.85));

    fragColor=vec4(col,1.0);
}
