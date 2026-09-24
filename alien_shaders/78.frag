// generated shader — genome seed 1040453083
// PARAM MAP (all inputs 0.0-1.0 from Pd):
//   a = plasma.freq [2..12]
//   b = two_tone.hueB [0..1]
//   c = domain.warp [0.2..2.5]
//   d = (unused)
//   e = (unused)
//   f = (unused)
//   g = (unused)
//   h = EVENT (shift_hue) — transient rupture
/////////////////////////start Pd Header
uniform vec3 iResolution;
uniform float iTime;
uniform float iGlobalTime;
uniform vec4 iMouse;
uniform float a, b, c, d, e, f, g, h;
void mainImage(out vec4 fragColor, in vec2 fragCoord);
void main() { mainImage(gl_FragColor, gl_FragCoord.xy); }
/////////////////////////end Pd Header

float param(float p, float lo, float hi){ return mix(lo, hi, p); }
float saturate(float x){ return clamp(x, 0.0, 1.0); }
float div_safe(float a, float b){ return a / (abs(b) < 1e-4 ? (b<0.0?-1e-4:1e-4) : b); }
float pow_safe(float a, float b){ return pow(max(a, 0.0), b); }
float log_safe(float a){ return log(max(a, 1e-4)); }
float hash(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.13); p3+=dot(p3,p3.yzx+3.333); return fract((p3.x+p3.y)*p3.z); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float v=0.0,a=0.5; mat2 m=mat2(0.8,0.6,-0.6,0.8);
  for(int i=0;i<5;i++){ v+=a*noise(p); p=m*p*2.0+10.0; a*=0.5; } return v; }
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0);
  vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y); }
vec2 rot(vec2 p, float r){ float s=sin(r),c=cos(r); return mat2(c,-s,s,c)*p; }
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b*cos(6.28318*(c*t+d)); }
float vor(vec2 p){ vec2 n=floor(p),f=fract(p); float md=1.0;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){ vec2 g=vec2(i,j);
    vec2 o=vec2(hash(n+g),hash(n+g+3.7)); float d=length(g+o-f); md=min(md,d);} return md; }
#define PI 3.14159265359
#define TAU 6.28318530718

void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
  float t = iTime;
  vec2 q = vec2(fbm(uv*1+t*0.1), fbm(uv*1+vec2(5.2,1.3)-t*0.1));
  uv += param(c, 0.2, 2.5)*(q-0.5);
  float _pf=param(a, 2, 12);
  float f = 0.5+0.25*(sin(uv.x*_pf+t)+sin(uv.y*_pf-t*1.1)) + 0.25*sin((uv.x+uv.y)*_pf*0.7+t*0.5);
  f = 1.0 - f;
  f = floor(f*3.7528)/3.7528;
  f = saturate(f);
  vec3 _ca=hsv2rgb(vec3(0.505,0.8,1.0)); vec3 _cb=hsv2rgb(vec3(param(b, 0, 1),0.8,1.0));
  vec3 col = mix(_cb*0.15, _ca, smoothstep(0.2,0.8,f));
  col = mix(col, col.gbr, h);
  float _vig = 1.0 - 0.4*dot(uv,uv);
  col *= _vig;
  fragColor = vec4(clamp(col,0.0,1.0),1.0);
}
