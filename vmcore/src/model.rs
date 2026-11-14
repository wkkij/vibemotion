use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Float(f64),
    Int(i64),
    Bool(bool),
    Vec(Vec<f64>),
    Text(String),
}

#[derive(Debug, Clone, PartialEq)]
pub enum Easing {
    Linear,
    CubicBezier(f64, f64, f64, f64),
    /// Неизвестная кривая: сохраняем как есть, ведём себя как Linear.
    Unknown(String),
}

#[derive(Debug, Clone)]
pub struct Keyframe {
    pub t: f64, // нормализованное время (0..1 в пределах слоя), бывают значения вне диапазона
    pub v: Value,
    pub easing: Easing,
}

#[derive(Debug, Clone)]
pub struct Property {
    pub name: String,
    pub ty: String,
    pub constant: Option<Value>,
    pub keyframes: Vec<Keyframe>, // отсортированы по t
}

#[derive(Debug, Clone)]
pub struct Effect {
    pub id: String,
    pub props: Vec<Property>,
    pub attrs: BTreeMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct Layer {
    pub id: String,
    pub label: String,
    pub kind: String, // атрибут s, например ".rect"
    pub start_ms: f64,
    pub end_ms: f64,
    pub attrs: BTreeMap<String, String>, // все атрибуты как есть (ничего не теряем)
    pub transform: Vec<Property>,
    pub effects: Vec<Effect>,
    pub properties: Vec<Property>,
    pub children: Vec<Layer>,
    pub unknown: Vec<String>, // имена нераспознанных дочерних тегов
}

#[derive(Debug, Clone)]
pub struct Media {
    pub uri: String,
    pub filename: String,
    pub width: f64,
    pub height: f64,
    pub duration_raw: f64,
}

#[derive(Debug, Clone)]
pub struct Scene {
    pub title: String,
    pub width: f64,
    pub height: f64,
    pub export_width: f64,
    pub export_height: f64,
    pub fps: f64,
    pub total_time_ms: f64,
    pub bgcolor: String,
    pub media: Vec<Media>,
    pub layers: Vec<Layer>,
    pub unknown: Vec<String>,
}

// ---------- интерполяция ----------

impl Easing {
    pub fn apply(&self, u: f64) -> f64 {
        match self {
            Easing::CubicBezier(x1, y1, x2, y2) => cubic_bezier(*x1, *y1, *x2, *y2, u),
            _ => u,
        }
    }
}

/// CSS-подобная кривая: по x ищем параметр s бисекцией, возвращаем y(s).
fn cubic_bezier(x1: f64, y1: f64, x2: f64, y2: f64, u: f64) -> f64 {
    let bx = |s: f64| 3.0 * (1.0 - s).powi(2) * s * x1 + 3.0 * (1.0 - s) * s * s * x2 + s.powi(3);
    let by = |s: f64| 3.0 * (1.0 - s).powi(2) * s * y1 + 3.0 * (1.0 - s) * s * s * y2 + s.powi(3);
    let (mut lo, mut hi) = (0.0, 1.0);
    for _ in 0..40 {
        let mid = (lo + hi) / 2.0;
        if bx(mid) < u {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    by((lo + hi) / 2.0)
}

fn lerp(a: &Value, b: &Value, k: f64) -> Value {
    match (a, b) {
        (Value::Float(x), Value::Float(y)) => Value::Float(x + (y - x) * k),
        (Value::Vec(x), Value::Vec(y)) if x.len() == y.len() => {
            Value::Vec(x.iter().zip(y).map(|(p, q)| p + (q - p) * k).collect())
        }
        _ => a.clone(), // int/bool/text: ступенька
    }
}

impl Property {
    pub fn eval(&self, t: f64) -> Option<Value> {
        let kfs = &self.keyframes;
        if kfs.is_empty() {
            return self.constant.clone();
        }
        if t <= kfs[0].t {
            return Some(kfs[0].v.clone());
        }
        let last = kfs.last().unwrap();
        if t >= last.t {
            return Some(last.v.clone());
        }
        let i = kfs.windows(2).position(|w| t >= w[0].t && t < w[1].t)?;
        let (a, b) = (&kfs[i], &kfs[i + 1]);
        let u = (t - a.t) / (b.t - a.t);
        // ПРЕДПОЛОЖЕНИЕ: кривая e на ключе a описывает отрезок от a к b.
        // Проверяется сравнением с рендером Alight Motion.
        Some(lerp(&a.v, &b.v, a.easing.apply(u)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn prop(kfs: Vec<(f64, f64)>) -> Property {
        Property {
            name: "x".into(),
            ty: "float".into(),
            constant: None,
            keyframes: kfs
                .into_iter()
                .map(|(t, v)| Keyframe { t, v: Value::Float(v), easing: Easing::Linear })
                .collect(),
        }
    }

    #[test]
    fn linear_midpoint() {
        let p = prop(vec![(0.0, 0.0), (1.0, 10.0)]);
        assert_eq!(p.eval(0.5), Some(Value::Float(5.0)));
    }

    #[test]
    fn clamps_outside_range() {
        let p = prop(vec![(0.0, 2.0), (1.0, 4.0)]);
        assert_eq!(p.eval(-5.0), Some(Value::Float(2.0)));
        assert_eq!(p.eval(9.0), Some(Value::Float(4.0)));
    }

    #[test]
    fn bezier_endpoints() {
        let e = Easing::CubicBezier(0.25, 0.1, 0.25, 1.0);
        assert!((e.apply(0.0)).abs() < 1e-6);
        assert!((e.apply(1.0) - 1.0).abs() < 1e-6);
    }
}
