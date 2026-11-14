// Рендер на WebGPU: каждый слой это прямоугольник с видео (или шахматкой, если видео не выбрано).
(function () {
  const VM = (window.VM = window.VM || {});

  const SHADER = /* wgsl */ `
struct U {
  center: vec2f,
  extent: vec2f,
  canvas: vec2f,
  rot: f32,
  pad: f32,
  uvScale: vec2f,
  uvOffset: vec2f,
  color: vec4f,
}
@group(0) @binding(0) var<uniform> u: U;

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VOut {
  var c = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));
  let k = c[i];
  let l = k * u.extent;
  let cs = cos(u.rot);
  let sn = sin(u.rot);
  let r = vec2f(l.x * cs - l.y * sn, l.x * sn + l.y * cs);
  let p = u.center + r;
  var o: VOut;
  o.pos = vec4f(p.x / u.canvas.x * 2.0 - 1.0, 1.0 - p.y / u.canvas.y * 2.0, 0.0, 1.0);
  o.uv = (k * 0.5 + vec2f(0.5, 0.5)) * u.uvScale + u.uvOffset;
  return o;
}

@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var ext: texture_external;

@fragment
fn fs_video(v: VOut) -> @location(0) vec4f {
  let c = textureSampleBaseClampToEdge(ext, samp, v.uv);
  return vec4f(c.rgb * u.color.a, c.a * u.color.a);
}

@fragment
fn fs_proc(v: VOut) -> @location(0) vec4f {
  let gx = i32(floor(v.uv.x * 8.0));
  let gy = i32(floor(v.uv.y * 8.0));
  let shade = select(0.55, 1.0, ((gx + gy) & 1) == 0);
  return vec4f(u.color.rgb * shade * u.color.a, u.color.a);
}
`;


  const COMMON = (uniformDecl) => /* wgsl */ `
${uniformDecl}
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

struct V { @builtin(position) pos: vec4f, @location(0) px: vec2f }

@vertex
fn vs(@builtin(vertex_index) i: u32) -> V {
  var c = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: V;
  o.pos = vec4f(c[i], 0.0, 1.0);
  o.px = vec2f((c[i].x * 0.5 + 0.5) * CANVAS.x, (0.5 - c[i].y * 0.5) * CANVAS.y);
  return o;
}

// за пределами кадра — прозрачно
fn S(p: vec2f) -> vec4f {
  let c = textureSampleLevel(tex, samp, p / CANVAS, 0.0);
  let inside = all(p >= vec2f(0.0)) && all(p <= CANVAS);
  return select(vec4f(0.0), c, inside);
}
`;

  const FX_SHADER = COMMON('struct E { canvas: vec2f, dir: vec2f, a: vec4f, b: vec4f, c: vec4f }\n@group(0) @binding(0) var<uniform> e: E;').replaceAll('CANVAS', 'e.canvas') + /* wgsl */ `
@fragment fn fs_comp(v: V) -> @location(0) vec4f { return S(v.px); }

@fragment
fn fs_blur(v: V) -> @location(0) vec4f {
  var acc = vec4f(0.0);
  var ws = 0.0;
  let sigma = max(e.a.x, 0.0001);
  let radius = sigma * 2.5;
  for (var i = -10; i <= 10; i++) {
    let t = f32(i) / 10.0;
    let x = t * 2.5;
    let w = exp(-0.5 * x * x);
    let sp = clamp(v.px + e.dir * (t * radius), vec2f(0.0), e.canvas - vec2f(0.5));
    acc += textureSampleLevel(tex, samp, sp / e.canvas, 0.0) * w;
    ws += w;
  }
  return acc / ws;
}

@fragment
fn fs_rgb(v: V) -> @location(0) vec4f {
  let cc = e.a.z;
  let mode = i32(round(e.a.w));
  let base = S(v.px);
  let r = S(v.px - e.a.xy * (0.0 - cc));
  let g = S(v.px - e.a.xy * (1.0 - cc));
  let b = S(v.px - e.a.xy * (2.0 - cc));
  let a = max(r.a, max(g.a, b.a));
  let sep = vec3f(r.r, g.g, b.b);
  if (mode == 1) {
    let sc = 1.0 - (1.0 - base.rgb) * (1.0 - sep);
    return vec4f(sc, max(base.a, a));
  }
  if (mode == 0) {
    return vec4f(mix(base.rgb, sep, 0.5), max(base.a, a));
  }
  return vec4f(sep, a);
}

@fragment
fn fs_mblur(v: V) -> @location(0) vec4f {
  var acc = vec4f(0.0);
  let center = e.a.xy;
  let dScale = e.a.z;
  let dRot = e.a.w;
  let rel = v.px - center;
  for (var i = 0; i < 9; i++) {
    let f = (f32(i) / 8.0) - 0.5;
    let sc = 1.0 - dScale * f;
    let ang = -dRot * f;
    let cs = cos(ang);
    let sn = sin(ang);
    let r = vec2f(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) * sc;
    let p = center + r - e.dir * f;
    acc += S(p);
  }
  return acc / 9.0;
}

fn rgb2hsv(c: vec3f) -> vec3f {
  let K = vec4f(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  let p = mix(vec4f(c.bg, K.wz), vec4f(c.gb, K.xy), step(c.b, c.g));
  let q = mix(vec4f(p.xyw, c.r), vec4f(c.r, p.yzx), step(p.x, c.r));
  let d = q.x - min(q.w, q.y);
  let e0 = 1.0e-10;
  return vec3f(abs(q.z + (q.w - q.y) / (6.0 * d + e0)), d / (q.x + e0), q.x);
}
fn hsv2rgb(c: vec3f) -> vec3f {
  let K = vec4f(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  let p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, vec3f(0.0), vec3f(1.0)), c.y);
}

@fragment
fn fs_pix(v: V) -> @location(0) vec4f {
  let size = max(e.a.x, 1.0);
  let c = (floor((v.px - e.a.yz) / size) + vec2f(0.5)) * size + e.a.yz;
  return S(c);
}

@fragment
fn fs_zoom(v: V) -> @location(0) vec4f {
  var acc = vec4f(0.0);
  for (var i = 0; i < 16; i++) {
    let t = f32(i) / 15.0;
    acc += S(e.a.yz + (v.px - e.a.yz) * (1.0 - e.a.x * t));
  }
  return acc / 16.0;
}

@fragment
fn fs_spin(v: V) -> @location(0) vec4f {
  var acc = vec4f(0.0);
  let d = v.px - e.a.yz;
  for (var i = 0; i < 16; i++) {
    let ang = e.a.x * (f32(i) / 15.0 - 0.5);
    let cs = cos(ang);
    let sn = sin(ang);
    acc += S(e.a.yz + vec2f(d.x * cs - d.y * sn, d.x * sn + d.y * cs));
  }
  return acc / 16.0;
}

@fragment
fn fs_color(v: V) -> @location(0) vec4f {
  let c = S(v.px);
  if (c.a <= 0.0001) { return c; }
  var rgb = c.rgb / c.a;
  let mode = i32(round(e.a.w));
  if (mode == 1) {
    let lum = dot(rgb, vec3f(0.299, 0.587, 0.114));
    let hiMask = smoothstep(0.45, 1.0, lum);
    let shMask = 1.0 - smoothstep(0.0, 0.55, lum);
    rgb = rgb * mix(1.0, e.b.x, hiMask) * mix(1.0, e.b.y, shMask);
  } else if (mode == 2) {
    var hsv = rgb2hsv(clamp(rgb, vec3f(0.0), vec3f(1.0)));
    hsv.x = fract(hsv.x + e.a.x);
    hsv.y = clamp(hsv.y * e.a.y, 0.0, 1.0);
    hsv.z = clamp(hsv.z * e.a.z, 0.0, 1.0);
    rgb = hsv2rgb(hsv);
  } else if (mode == 3) {
    let uv = v.px / e.canvas * 2.0 - vec2f(1.0);
    let aspect = e.canvas.x / max(e.canvas.y, 1.0);
    let q = vec2f(uv.x * mix(1.0, aspect, e.b.x), uv.y);
    let d = length(q);
    let vig = smoothstep(e.a.x - e.a.y * 0.5, e.a.x + e.a.y * 0.5, d);
    rgb = rgb * (1.0 - vig * e.a.z);
  } else if (mode == 4) {
    rgb = mix(rgb, vec3f(1.0) - rgb, clamp(e.a.x, 0.0, 1.0));
  } else if (mode == 5) {
    rgb = (rgb - vec3f(0.5)) * e.a.y + vec3f(0.5 + e.a.x);
  } else if (mode == 6) {
    rgb = rgb * vec3f(1.0 + 0.3 * e.a.x, 1.0 - 0.15 * e.a.y, 1.0 - 0.3 * e.a.x);
  } else if (mode == 7) {
    let lv = max(e.a.x, 2.0) - 1.0;
    rgb = floor(clamp(rgb, vec3f(0.0), vec3f(1.0)) * lv + vec3f(0.5)) / lv;
  } else if (mode == 8) {
    rgb = vec3f(step(e.a.x, dot(rgb, vec3f(0.299, 0.587, 0.114))));
  } else if (mode == 9) {
    let lum = dot(rgb, vec3f(0.299, 0.587, 0.114));
    let sat = max(max(rgb.r, rgb.g), rgb.b) - min(min(rgb.r, rgb.g), rgb.b);
    rgb = mix(vec3f(lum), rgb, max(e.a.x, 0.0) * (1.0 + e.a.y * (1.0 - sat)));
  } else if (mode == 10) {
    let col = clamp(rgb, vec3f(0.0), vec3f(1.0));
    let keyCol = clamp(e.a.xyz, vec3f(0.0), vec3f(1.0));

    let lumaW = vec3f(0.2126, 0.7152, 0.0722);
    let y = dot(col, lumaW);
    let chroma = vec2f((col.b - y) * 0.5389, (col.r - y) * 0.6350);

    let ky = dot(keyCol, lumaW);
    let kChroma = vec2f((keyCol.b - ky) * 0.5389, (keyCol.r - ky) * 0.6350);
    let kMag = length(kChroma);

    let dRgb = length(col - keyCol) * 0.57735027;
    var dist = dRgb;
    var outRgb = col;

    if (kMag > 0.015) {
      let uKey = kChroma / kMag;
      let proj = dot(chroma, uKey);
      let perp = abs(chroma.x * uKey.y - chroma.y * uKey.x);

      let expectedProj = kMag * clamp(y / max(ky, 0.08), 0.35, 1.35);
      let projDiff = max(0.0, expectedProj - proj);
      let lumaDiff = abs(y - ky);

      let dChroma = length(vec2f(perp * 1.65, projDiff * 1.15)) + lumaDiff * 0.22;
      let chromaWeight = smoothstep(0.015, 0.12, kMag);
      dist = mix(dRgb, dChroma, chromaWeight);

      let despillAmt = e.b.z * chromaWeight;
      if (despillAmt > 0.001 && proj > 0.0) {
        let spill = min(proj, kMag) * despillAmt;
        let newChroma = chroma - uKey * spill;
        let newB = y + newChroma.x / 0.5389;
        let newR = y + newChroma.y / 0.6350;
        let newG = (y - 0.2126 * newR - 0.0722 * newB) / 0.7152;
        outRgb = clamp(vec3f(newR, newG, newB), vec3f(0.0), vec3f(1.0));
      }
    }

    let alphaMask = smoothstep(e.b.x, e.b.x + e.b.y, dist);
    let outA = c.a * alphaMask;
    return vec4f(outRgb * outA, outA);
  } else {
    rgb = max(rgb * e.a.x + vec3f(e.a.z), vec3f(0.0));
    rgb = pow(rgb, vec3f(e.a.y));
  }
  return vec4f(clamp(rgb, vec3f(0.0), vec3f(1.0)) * c.a, c.a);
}

@fragment
fn fs_glow(v: V) -> @location(0) vec4f {
  let base = S(v.px);
  let rad = max(e.a.x, 1.0);
  let inten = e.a.y;
  let thr = e.a.z;
  var acc = vec3f(0.0);
  var ws = 0.0;
  for (var i = 0; i < 16; i++) {
    let ang = f32(i) * 0.39269908;
    let dir = vec2f(cos(ang), sin(ang));
    for (var r = 1; r <= 2; r++) {
      let dist = rad * (f32(r) * 0.5);
      let c = S(v.px + dir * dist);
      let rgb = c.rgb / max(c.a, 0.0001);
      let lum = dot(rgb, vec3f(0.299, 0.587, 0.114));
      let bright = max(0.0, lum - thr) / max(1.0 - thr, 0.05);
      let w = exp(-f32(r) * 0.65);
      acc += rgb * bright * c.a * w;
      ws += w;
    }
  }
  let glowRgb = (acc / max(ws, 0.0001)) * inten;
  let outRgb = base.rgb + glowRgb * base.a;
  return vec4f(clamp(outRgb, vec3f(0.0), vec3f(1.0)), base.a);
}
`;

  // Геометрические эффекты цепочкой: out_n(p) = out_{n-1}(f_n(p)), поэтому координату гоним от последнего эффекта к первому
  const GEO_SHADER = COMMON('struct G { canvas: vec2f, n: f32, pad: f32, ops: array<vec4f, 24>, meshInfo: vec4f, meshBase: array<vec4f, 32>, meshCurr: array<vec4f, 32> }\n@group(0) @binding(0) var<uniform> g: G;').replaceAll('CANVAS', 'g.canvas') + /* wgsl */ `
fn tilemap(p: vec2f, a: vec4f, b: vec4f) -> vec2f {
  let c = a.xy;
  let size = max(a.zw, vec2f(1.0));
  let cs = cos(b.x);
  let sn = sin(b.x);
  let d = p - c;
  let flags = i32(round(b.y));
  let mirror = (flags & 1) != 0;
  let vertoffs = (flags & 2) != 0;
  let cropScale = max(b.w, 0.05);
  let cellSize = max(size / cropScale, vec2f(1.0));
  var u = vec2f(d.x * cs + d.y * sn, -d.x * sn + d.y * cs) / cellSize + vec2f(0.5);
  if (vertoffs) {
    u.y = u.y - select(0.0, b.z, (i32(floor(u.x)) & 1) != 0);
  } else {
    u.x = u.x - select(0.0, b.z, (i32(floor(u.y)) & 1) != 0);
  }
  let ti = floor(u);
  var f = u - ti;
  if (mirror) {
    if ((i32(ti.x) & 1) != 0) { f.x = 1.0 - f.x; }
    if ((i32(ti.y) & 1) != 0) { f.y = 1.0 - f.y; }
  }
  let lo = (f - vec2f(0.5)) * cellSize;
  if (abs(lo.x) > size.x * 0.5 || abs(lo.y) > size.y * 0.5) {
    return vec2f(-100000.0, -100000.0);
  }
  return c + vec2f(lo.x * cs - lo.y * sn, lo.x * sn + lo.y * cs);
}

fn grad2(i: vec2f) -> vec2f {
  let h = fract(sin(vec2f(dot(i, vec2f(127.1, 311.7)), dot(i, vec2f(269.5, 183.3)))) * 43758.5453);
  return normalize(h * 2.0 - 1.0 + vec2f(1e-5, 0.0));
}
fn gnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  let a = dot(grad2(i), f);
  let b = dot(grad2(i + vec2f(1.0, 0.0)), f - vec2f(1.0, 0.0));
  let c = dot(grad2(i + vec2f(0.0, 1.0)), f - vec2f(0.0, 1.0));
  let d = dot(grad2(i + vec2f(1.0, 1.0)), f - vec2f(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}
fn fbm(p0: vec2f, oct: i32, gain: f32) -> f32 {
  var amp = 1.0; var sum = 0.0; var norm = 0.0; var q = p0;
  for (var i = 0; i < 8; i++) {
    if (i >= oct) { break; }
    sum += amp * gnoise(q); norm += amp;
    q = q * 2.03 + vec2f(13.7, 7.9);
    amp *= gain;
  }
  return sum / max(norm, 0.0001);
}
fn warpoff(p: vec2f, a: vec4f, b: vec4f, c: vec4f) -> vec2f {
  var q: vec2f;
  if (b.x > 0.5) {
    q = p / g.canvas.x * (6.0 / max(a.y, 0.01));
  } else {
    let d = p - b.yz;
    let cs = cos(b.w);
    let sn = sin(b.w);
    let loc = vec2f(d.x * cs + d.y * sn, -d.x * sn + d.y * cs);
    let refDim = max(max(c.x, c.y), 1.0);
    q = (loc / refDim + vec2f(0.5)) * (6.0 / max(a.y, 0.01));
  }
  let oct = i32(a.w);
  let dx = fbm(q, oct, a.z);
  let dy = fbm(q + vec2f(41.3, 19.7), oct, a.z);
  return vec2f(dx, dy) * (a.x * g.canvas.x * 1.15);
}

fn waveoff(p: vec2f, a: vec4f, b: vec4f, c: vec4f) -> vec2f {
  let phase = a.x * 6.2831853;
  let dir1 = vec2f(cos(a.y), sin(a.y));
  let dir2 = vec2f(cos(b.x), sin(b.x));
  // В Alight Motion spacing (m1) в единицах ~1% от 1080px (~10.8px)
  let stepPx = max(a.z * (g.canvas.x * 0.01), 4.0);
  let refP = select(p - c.xy, p, b.w > 0.5);
  let coord = dot(refP, dir1) / stepPx;
  var amp = a.w * (g.canvas.x * 0.0025);
  if (b.y > 0.001) {
    let normPos = clamp(dot(p - c.xy, dir1) / max(max(c.z, c.w), 1.0) + 0.5, 0.0, 1.0);
    let dist = abs(normPos - b.z);
    amp *= max(0.0, 1.0 - dist * b.y * 2.0);
  }
  return dir2 * sin(coord * 6.2831853 + phase) * amp;
}

fn rippleoff(p: vec2f, a: vec4f, b: vec4f) -> vec2f {
  let d = p - b.xy;
  let dist = length(d);
  let maxR = max(a.w * b.w, 1.0);
  if (dist >= maxR || dist < 0.001) { return vec2f(0.0); }
  let u = dist / maxR;
  let env = 1.0 - smoothstep(max(0.0, 1.0 - b.z), 1.0, u);
  let w = sin((u * a.x * 6.0 - a.z) * 6.2831853) * a.y * b.w * 0.45 * env;
  return (d / dist) * w;
}

fn pinchoff(p: vec2f, a: vec4f, b: vec4f) -> vec2f {
  let d = p - a.zw;
  let dist = length(d);
  let maxR = max(a.y * b.x, 1.0);
  if (dist >= maxR || dist < 0.001) { return vec2f(0.0); }
  let u = dist / maxR;
  let k = pow(u, max(0.2, 1.0 + a.x * 0.85)) / u;
  return d * (k - 1.0);
}

fn turboff(p: vec2f, a: vec4f, b: vec4f, c: vec4f) -> vec2f {
  let d = p - b.xy;
  let cs = cos(b.z);
  let sn = sin(b.z);
  let loc = vec2f(d.x * cs + d.y * sn, -d.x * sn + d.y * cs);
  let refDim = max(max(c.x, c.y), 1.0);
  let seedOff = vec2f(b.w * 17.3, b.w * 29.1);
  let q = (loc / refDim + vec2f(0.5)) * (5.0 / max(a.y, 0.05)) + seedOff + vec2f(a.z * 0.85, -a.z * 0.65);
  let oct = i32(a.w);
  let dx = fbm(q, oct, 0.55);
  let dy = fbm(q + vec2f(31.7, 53.2), oct, 0.55);
  return vec2f(dx, dy) * (a.x * g.canvas.x * 0.45);
}

fn swirloff(p: vec2f, a: vec4f, b: vec4f) -> vec2f {
  let d = p - a.zw;
  let dist = length(d);
  let maxR = max(a.y * b.x, 1.0);
  if (dist >= maxR || dist < 0.001) { return vec2f(0.0); }
  let u = 1.0 - dist / maxR;
  let ang = a.x * u * u;
  let cs = cos(ang);
  let sn = sin(ang);
  let rotD = vec2f(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
  return rotD - d;
}

fn cross2(a: vec2f, b: vec2f) -> f32 {
  return a.x * b.y - a.y * b.x;
}

fn invBilinear(p: vec2f, a: vec2f, b: vec2f, c: vec2f, d: vec2f) -> vec2f {
  let e = b - a;
  let f = c - a;
  let g0 = a - b - c + d;
  let h = p - a;

  let k2 = cross2(g0, f);
  let k1 = cross2(e, f) + cross2(h, g0);
  let k0 = cross2(h, e);

  if (abs(k2) < 1e-5) {
    if (abs(k1) < 1e-5) { return vec2f(-10.0, -10.0); }
    let v = -k0 / k1;
    let denom = e + g0 * v;
    let dLen = dot(denom, denom);
    if (dLen < 1e-6) { return vec2f(-10.0, -10.0); }
    let u = dot(h - f * v, denom) / dLen;
    return vec2f(u, v);
  }

  var disc = k1 * k1 - 4.0 * k0 * k2;
  if (disc < 0.0) { return vec2f(-10.0, -10.0); }
  disc = sqrt(disc);

  let ik2 = 0.5 / k2;
  var v = (-k1 - disc) * ik2;
  if (v < -0.05 || v > 1.05) {
    v = (-k1 + disc) * ik2;
  }
  let denom = e + g0 * v;
  let dLen = dot(denom, denom);
  if (dLen < 1e-6) { return vec2f(-10.0, -10.0); }
  let u = dot(h - f * v, denom) / dLen;
  return vec2f(u, v);
}

fn getBasePt(idx: i32) -> vec2f {
  let v = g.meshBase[idx >> 1];
  return select(v.xy, v.zw, (idx & 1) == 1);
}

fn getCurrPt(idx: i32) -> vec2f {
  let v = g.meshCurr[idx >> 1];
  return select(v.xy, v.zw, (idx & 1) == 1);
}

fn catmull1D(p0: vec2f, p1: vec2f, p2: vec2f, p3: vec2f, t: f32) -> vec2f {
  let t2 = t * t;
  let t3 = t2 * t;
  return 0.5 * (
    (2.0 * p1) +
    (-p0 + p2) * t +
    (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 +
    (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
  );
}

fn evalGridSmoothCurr(ci: i32, cj: i32, s: f32, t: f32, cols: i32, rows: i32) -> vec2f {
  var rowPts: array<vec2f, 4>;
  for (var dj = -1; dj <= 2; dj++) {
    let r = clamp(cj + dj, 0, rows - 1);
    let c0 = clamp(ci - 1, 0, cols - 1);
    let c1 = clamp(ci, 0, cols - 1);
    let c2 = clamp(ci + 1, 0, cols - 1);
    let c3 = clamp(ci + 2, 0, cols - 1);
    rowPts[dj + 1] = catmull1D(
      getCurrPt(r * cols + c0),
      getCurrPt(r * cols + c1),
      getCurrPt(r * cols + c2),
      getCurrPt(r * cols + c3),
      s
    );
  }
  return catmull1D(rowPts[0], rowPts[1], rowPts[2], rowPts[3], t);
}

fn evalGridSmoothBase(ci: i32, cj: i32, s: f32, t: f32, cols: i32, rows: i32) -> vec2f {
  var rowPts: array<vec2f, 4>;
  for (var dj = -1; dj <= 2; dj++) {
    let r = clamp(cj + dj, 0, rows - 1);
    let c0 = clamp(ci - 1, 0, cols - 1);
    let c1 = clamp(ci, 0, cols - 1);
    let c2 = clamp(ci + 1, 0, cols - 1);
    let c3 = clamp(ci + 2, 0, cols - 1);
    rowPts[dj + 1] = catmull1D(
      getBasePt(r * cols + c0),
      getBasePt(r * cols + c1),
      getBasePt(r * cols + c2),
      getBasePt(r * cols + c3),
      s
    );
  }
  return catmull1D(rowPts[0], rowPts[1], rowPts[2], rowPts[3], t);
}

fn meshwarpoff(p: vec2f, h: vec4f, a: vec4f) -> vec2f {
  let cols = i32(round(g.meshInfo.x));
  let rows = i32(round(g.meshInfo.y));
  if (cols < 2 || rows < 2) {
    return vec2f(-100000.0, -100000.0);
  }

  let d = p - a.xy;
  let cs = cos(h.y);
  let sn = sin(h.y);
  let ext = max(abs(a.zw), vec2f(1.0));
  let loc = vec2f(d.x * cs + d.y * sn, -d.x * sn + d.y * cs) / ext;
  let smoothMode = i32(round(g.meshInfo.z)) == 1;
  let padTol = select(0.002, 0.18, smoothMode);

  for (var cj = 0; cj < 7; cj++) {
    if (cj >= rows - 1) { break; }
    for (var ci = 0; ci < 7; ci++) {
      if (ci >= cols - 1) { break; }
      let i00 = cj * cols + ci;
      let i10 = i00 + 1;
      let i01 = i00 + cols;
      let i11 = i01 + 1;

      let c00 = getCurrPt(i00);
      let c10 = getCurrPt(i10);
      let c01 = getCurrPt(i01);
      let c11 = getCurrPt(i11);

      let bMin = min(min(c00, c10), min(c01, c11)) - vec2f(0.25);
      let bMax = max(max(c00, c10), max(c01, c11)) + vec2f(0.25);
      if (loc.x < bMin.x || loc.x > bMax.x || loc.y < bMin.y || loc.y > bMax.y) {
        continue;
      }

      var st = invBilinear(loc, c00, c10, c01, c11);
      if (st.x < -padTol || st.x > 1.0 + padTol || st.y < -padTol || st.y > 1.0 + padTol) {
        continue;
      }

      var srcNorm = vec2f(0.0);
      if (smoothMode) {
        var s = clamp(st.x, 0.0, 1.0);
        var t = clamp(st.y, 0.0, 1.0);
        let eps = 0.01;
        for (var it = 0; it < 3; it++) {
          let f0 = evalGridSmoothCurr(ci, cj, s, t, cols, rows) - loc;
          let dfds = (evalGridSmoothCurr(ci, cj, s + eps, t, cols, rows) - evalGridSmoothCurr(ci, cj, s - eps, t, cols, rows)) / (2.0 * eps);
          let dfdt = (evalGridSmoothCurr(ci, cj, s, t + eps, cols, rows) - evalGridSmoothCurr(ci, cj, s, t - eps, cols, rows)) / (2.0 * eps);
          let det = dfds.x * dfdt.y - dfds.y * dfdt.x;
          if (abs(det) < 1e-6) { break; }
          let ds = (f0.x * dfdt.y - f0.y * dfdt.x) / det;
          let dt = (dfds.x * f0.y - dfds.y * f0.x) / det;
          s -= clamp(ds, -0.35, 0.35);
          t -= clamp(dt, -0.35, 0.35);
        }
        if (s < -0.002 || s > 1.002 || t < -0.002 || t > 1.002) {
          continue;
        }
        srcNorm = evalGridSmoothBase(ci, cj, clamp(s, 0.0, 1.0), clamp(t, 0.0, 1.0), cols, rows);
      } else {
        let s = clamp(st.x, 0.0, 1.0);
        let t = clamp(st.y, 0.0, 1.0);
        let b00 = getBasePt(i00);
        let b10 = getBasePt(i10);
        let b01 = getBasePt(i01);
        let b11 = getBasePt(i11);
        srcNorm = mix(mix(b00, b10, s), mix(b01, b11, s), t);
      }

      let srcLoc = srcNorm * ext;
      return a.xy + vec2f(srcLoc.x * cs - srcLoc.y * sn, srcLoc.x * sn + srcLoc.y * cs);
    }
  }
  return vec2f(-100000.0, -100000.0);
}

@fragment
fn fs_geo(v: V) -> @location(0) vec4f {
  var p = v.px;
  let n = i32(g.n);
  for (var k = 5; k >= 0; k--) {
    if (k >= n) { continue; }
    let head = g.ops[k * 4];
    let t = i32(head.x);
    let a = g.ops[k * 4 + 1];
    let b = g.ops[k * 4 + 2];
    let c = g.ops[k * 4 + 3];
    if (t == 0) { p = p - a.xy; }
    else if (t == 1) { p = tilemap(p, a, b); }
    else if (t == 2) { p = p + warpoff(p, a, b, c); }
    else if (t == 3) { p = p + waveoff(p, a, b, c); }
    else if (t == 4) { p = p + rippleoff(p, a, b); }
    else if (t == 5) { p = p + pinchoff(p, a, b); }
    else if (t == 7) { p = p + turboff(p, a, b, c); }
    else if (t == 8) { p = p + swirloff(p, a, b); }
    else if (t == 9) { p = meshwarpoff(p, head, a); }
  }
  return S(p);
}
`;

  function parseBg(s) {
    // "#aarrggbb" -> {r,g,b}
    const h = (s || '#ff000000').replace('#', '');
    const v = h.length === 8 ? h.slice(2) : h.padStart(6, '0');
    return {
      r: parseInt(v.slice(0, 2), 16) / 255,
      g: parseInt(v.slice(2, 4), 16) / 255,
      b: parseInt(v.slice(4, 6), 16) / 255,
      a: 1,
    };
  }

  class Renderer {
    static async create(canvas) {
      if (!navigator.gpu) throw new Error('WebGPU недоступен в этом окне');
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('Не найден видеоадаптер для WebGPU');
      const device = await adapter.requestDevice();
      const r = new Renderer(canvas, device);
      r.adapter = adapter; // держим ссылку: иначе сборщик мусора может освободить экземпляр WebGPU
      r.init();
      return r;
    }

    constructor(canvas, device) {
      this.canvas = canvas;
      this.device = device;
      this.maxDraws = 64;
    }

    init() {
      const { device, canvas } = this;
      this.ctx = canvas.getContext('webgpu');
      this.format = navigator.gpu.getPreferredCanvasFormat();
      this.ctx.configure({ device, format: this.format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
      const module = device.createShaderModule({ code: SHADER });
      const make = (fs, format, blend) =>
        device.createRenderPipeline({
          layout: 'auto',
          vertex: { module, entryPoint: 'vs' },
          fragment: { module, entryPoint: fs, targets: [{ format, blend }] },
          primitive: { topology: 'triangle-list' },
        });
      const over = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                     alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } };
      const addBlend = { color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
                         alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } };
      const screenBlend = { color: { srcFactor: 'one', dstFactor: 'one-minus-src', operation: 'add' },
                            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } };
      const multBlend = { color: { srcFactor: 'dst', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } };
      this.pVideo = make('fs_video', this.format, over);
      this.pProc = make('fs_proc', this.format, over);
      this.pVideoBlend = { normal: this.pVideo, add: make('fs_video', this.format, addBlend), screen: make('fs_video', this.format, screenBlend), multiply: make('fs_video', this.format, multBlend) };
      this.OFF = 'rgba8unorm';
      this.pVideoOff = make('fs_video', this.OFF);   // слой -> промежуточная текстура
      this.pProcOff = make('fs_proc', this.OFF);
      const fxm = device.createShaderModule({ code: FX_SHADER });
      const makeFx = (fs, format, blend) =>
        device.createRenderPipeline({
          layout: 'auto',
          vertex: { module: fxm, entryPoint: 'vs' },
          fragment: { module: fxm, entryPoint: fs, targets: [{ format, blend }] },
          primitive: { topology: 'triangle-list' },
        });
      this.fxPipes = {};
      for (const k of ['blur', 'rgb', 'mblur', 'color', 'pix', 'zoom', 'spin', 'glow']) this.fxPipes[k] = makeFx('fs_' + k, this.OFF);
      const gm = device.createShaderModule({ code: GEO_SHADER });
      this.fxPipes.geo = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: gm, entryPoint: 'vs' },
        fragment: { module: gm, entryPoint: 'fs_geo', targets: [{ format: this.OFF }] },
        primitive: { topology: 'triangle-list' },
      });
      this.pComp = makeFx('fs_comp', this.format, over);
      this.pCompBlend = { normal: this.pComp, add: makeFx('fs_comp', this.format, addBlend), screen: makeFx('fs_comp', this.format, screenBlend), multiply: makeFx('fs_comp', this.format, multBlend) };
      this.maxDraws = 64; this.maxSlots = 1024;
      this.sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
      this.ubuf = device.createBuffer({
        size: 2048 * this.maxSlots,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      this.tex = null;
      device.addEventListener('uncapturederror', (e) => console.error('WebGPU:', e.error.message));
    }

    _ensureTex() {
      const w = this.canvas.width, h = this.canvas.height;
      if (this.tex && this.tex.w === w && this.tex.h === h) return;
      if (this.tex) { this.tex.a.destroy(); this.tex.b.destroy(); }
      const mk = () => this.device.createTexture({
        size: [w, h], format: this.OFF, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      this.tex = { w, h, a: mk(), b: mk() };
    }

    _slot(data) {
      const off = this.slot++ * 2048;
      this.device.queue.writeBuffer(this.ubuf, off, data);
      return off;
    }

    _layerUniform(d) {
      return new Float32Array([
        d.center[0], d.center[1], d.extent[0], d.extent[1],
        this.canvas.width, this.canvas.height, d.rot, 0,
        d.uvScale[0], d.uvScale[1], d.uvOffset[0], d.uvOffset[1],
        d.color[0], d.color[1], d.color[2], d.color[3],
      ]);
    }

    _drawLayer(pass, d, pVideo, pProc) {
      const { device } = this;
      const off = this._slot(this._layerUniform(d));
      const e0 = { binding: 0, resource: { buffer: this.ubuf, offset: off, size: 64 } };
      let pipe, bg;
      let ext = null;
      if (d.video) {
        try { ext = device.importExternalTexture({ source: d.video }); } catch (err) { ext = null; } // кадр ещё не готов -> шахматка
      }
      if (ext) {
        pipe = pVideo;
        bg = device.createBindGroup({
          layout: pipe.getBindGroupLayout(0),
          entries: [e0, { binding: 1, resource: this.sampler }, { binding: 2, resource: ext }],
        });
      } else {
        pipe = pProc;
        bg = device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [e0] });
      }
      pass.setPipeline(pipe);
      pass.setBindGroup(0, bg);
      pass.draw(6);
    }

    _fxPass(enc, pipe, srcTex, dstView, load, fx) {
      const { device } = this;
      let data, size;
      if (fx.fs === 'geo') {
        data = new Float32Array(4 + 24 * 4 + 4 + 32 * 4 + 32 * 4);
        data[0] = this.canvas.width; data[1] = this.canvas.height; data[2] = fx.ops.length;
        let meshOp = null;
        fx.ops.forEach((op, k) => {
          const h = op.h || [0, 0, 0];
          data.set([op.t, h[0] || 0, h[1] || 0, h[2] || 0], 4 + k * 16);
          data.set(op.a || [0, 0, 0, 0], 8 + k * 16);
          data.set(op.b || [0, 0, 0, 0], 12 + k * 16);
          data.set(op.c || [0, 0, 0, 0], 16 + k * 16);
          if (op.t === 9 && op.mesh) meshOp = op.mesh;
        });
        if (meshOp && meshOp.basePts && meshOp.currPts) {
          const cols = Math.min(8, Math.max(2, meshOp.cols || 2));
          const rows = Math.min(8, Math.max(2, meshOp.rows || 2));
          data.set([cols, rows, meshOp.mode || 0, 1], 100);
          const count = Math.min(64, cols * rows);
          for (let i = 0; i < count; i++) {
            const bp = meshOp.basePts[i] || [0, 0];
            const cp = meshOp.currPts[i] || [0, 0];
            data[104 + i * 2] = bp[0];
            data[104 + i * 2 + 1] = bp[1];
            data[232 + i * 2] = cp[0];
            data[232 + i * 2 + 1] = cp[1];
          }
        }
        size = 16 + 24 * 16 + 16 + 32 * 16 + 32 * 16;
      } else {
        const dir = fx.dir || [0, 0], a = fx.a || [0, 0, 0, 0], b = fx.b || [0, 0, 0, 0];
        data = new Float32Array([this.canvas.width, this.canvas.height, dir[0], dir[1], a[0], a[1], a[2], a[3], b[0], b[1], b[2], b[3], 0, 0, 0, 0]);
        size = 64;
      }
      const off = this._slot(data);
      const bg = device.createBindGroup({
        layout: pipe.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: this.ubuf, offset: off, size } },
          { binding: 1, resource: this.sampler },
          { binding: 2, resource: srcTex.createView() }],
      });
      const p = enc.beginRenderPass({ colorAttachments: [{ view: dstView, loadOp: load ? 'load' : 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 0 }, storeOp: 'store' }] });
      p.setPipeline(pipe); p.setBindGroup(0, bg); p.draw(3); p.end();
    }

    // draws: [{center, extent, rot, uvScale, uvOffset, color, video|null, fx?: [{fs, dir?, a?, b?}]}]
    // capture=true: вернёт промис с пикселями кадра {w,h,data(RGBA)} — для скриншотов и проверки
    render(draws, bgcolor, capture) {
      const { device } = this;
      this.slot = 0;
      this._ensureTex();
      const enc = device.createCommandEncoder();
      const canvasTex = this.ctx.getCurrentTexture();
      const canvasView = canvasTex.createView();
      let first = true;
      const canvasPass = (fn) => {
        const p = enc.beginRenderPass({ colorAttachments: [{ view: canvasView, clearValue: parseBg(bgcolor),
          loadOp: first ? 'clear' : 'load', storeOp: 'store' }] });
        first = false;
        fn(p);
        p.end();
      };
      canvasPass(() => {}); // фон
      for (const d of draws.slice(0, this.maxDraws)) {
        if (this.slot > this.maxSlots - 24) break;
        const bMode = d.blend || 'normal';
        if (!d.fx || !d.fx.length) {
          const pv = (this.pVideoBlend && this.pVideoBlend[bMode]) || this.pVideo;
          canvasPass((p) => this._drawLayer(p, d, pv, this.pProc)); // быстрый путь без эффектов
          continue;
        }
        let cur = this.tex.a, other = this.tex.b;
        const p0 = enc.beginRenderPass({ colorAttachments: [{ view: cur.createView(), loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 0 }, storeOp: 'store' }] });
        this._drawLayer(p0, d, this.pVideoOff, this.pProcOff);
        p0.end();
        for (const fx of d.fx) {
          this._fxPass(enc, this.fxPipes[fx.fs], cur, other.createView(), false, fx);
          [cur, other] = [other, cur];
        }
        const compPipe = (this.pCompBlend && this.pCompBlend[bMode]) || this.pComp;
        const slotOff = this._slot(new Float32Array([this.canvas.width, this.canvas.height, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
        const bg = device.createBindGroup({
          layout: compPipe.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: this.ubuf, offset: slotOff, size: 64 } },
            { binding: 1, resource: this.sampler }, { binding: 2, resource: cur.createView() }],
        });
        canvasPass((p) => { p.setPipeline(compPipe); p.setBindGroup(0, bg); p.draw(3); });
      }
      let shot = null;
      if (capture) {
        const w = canvasTex.width, h = canvasTex.height, bpr = Math.ceil((w * 4) / 256) * 256;
        const buf = device.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        enc.copyTextureToBuffer({ texture: canvasTex }, { buffer: buf, bytesPerRow: bpr }, [w, h]);
        shot = { buf, w, h, bpr };
      }
      device.queue.submit([enc.finish()]);
      if (!shot) return undefined;
      const bgra = this.format.startsWith('bgra');
      return shot.buf.mapAsync(GPUMapMode.READ).then(() => {
        const src = new Uint8Array(shot.buf.getMappedRange());
        const data = new Uint8ClampedArray(shot.w * shot.h * 4);
        for (let y = 0; y < shot.h; y++) {
          for (let x = 0; x < shot.w; x++) {
            const si = y * shot.bpr + x * 4, di = (y * shot.w + x) * 4;
            data[di] = bgra ? src[si + 2] : src[si]; data[di + 1] = src[si + 1]; data[di + 2] = bgra ? src[si] : src[si + 2]; data[di + 3] = 255;
          }
        }
        shot.buf.unmap(); shot.buf.destroy();
        return { w: shot.w, h: shot.h, data };
      });
    }
  }

  VM.Renderer = Renderer;
})();
