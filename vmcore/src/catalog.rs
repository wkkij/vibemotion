//! Каталог эффектов: подписи, диапазоны и значения по умолчанию для UI.
//! id и имена параметров взяты из samples/shake.xml; диапазоны выведены
//! из значений в файле и требуют сверки с самим Alight Motion.

#[derive(Debug, Clone, Copy)]
pub enum Kind {
    Float { min: f64, max: f64, step: f64 },
    Int { min: i64, max: i64 },
    Bool,
}

#[derive(Debug, Clone, Copy)]
pub struct ParamDef {
    pub name: &'static str,
    pub label: &'static str,
    pub kind: Kind,
    pub default: f64, // bool: 0.0 / 1.0
}

#[derive(Debug, Clone, Copy)]
pub struct EffectDef {
    pub id: &'static str,
    pub label: &'static str,
    pub category: &'static str,
    pub params: &'static [ParamDef],
}

const fn f(name: &'static str, label: &'static str, min: f64, max: f64, step: f64, default: f64) -> ParamDef {
    ParamDef { name, label, kind: Kind::Float { min, max, step }, default }
}
const fn i(name: &'static str, label: &'static str, min: i64, max: i64, default: f64) -> ParamDef {
    ParamDef { name, label, kind: Kind::Int { min, max }, default }
}
const fn b(name: &'static str, label: &'static str, default: bool) -> ParamDef {
    ParamDef { name, label, kind: Kind::Bool, default: if default { 1.0 } else { 0.0 } }
}

pub const EFFECTS: &[EffectDef] = &[
    EffectDef { id: "com.alightcreative.effects.gaussianblur", label: "Размытие по Гауссу", category: "Размытие",
        params: &[f("strength", "Сила", 0.0, 0.5, 0.001, 0.0)] },
    EffectDef { id: "com.alightcreative.effects.motionblur4", label: "Размытие движения", category: "Размытие",
        params: &[f("tune", "Тонкая настройка", 0.0, 2.0, 0.01, 1.0),
                  b("usePos", "Учитывать позицию", true),
                  b("useScale", "Учитывать масштаб", true),
                  b("useAngle", "Учитывать поворот", true)] },
    EffectDef { id: "com.alightcreative.effects.rgbsep", label: "RGB-разделение", category: "Цвет",
        params: &[f("strength", "Сила", 0.0, 0.5, 0.001, 0.0),
                  f("angle", "Угол", -360.0, 360.0, 0.1, 0.0),
                  i("centerChannel", "Центральный канал", 0, 2, 1.0),
                  i("mode", "Режим", 0, 3, 2.0)] },
    EffectDef { id: "com.alightcreative.effects.tile", label: "Плитка", category: "Стилизация",
        params: &[f("scale", "Масштаб", 0.1, 4.0, 0.01, 1.0),
                  f("phase", "Фаза", 0.0, 1.0, 0.01, 0.0),
                  f("angle", "Угол", -360.0, 360.0, 0.1, 0.0),
                  b("mirror", "Зеркало", true),
                  b("vertoffs", "Вертикальный сдвиг", false)] },
    EffectDef { id: "com.alightcreative.effects.oscillate3", label: "Колебание", category: "Движение",
        params: &[i("direction", "Направление", 0, 5, 0.0),
                  i("type", "Тип волны", 0, 5, 0.0),
                  f("angle", "Угол", -360.0, 360.0, 0.1, 0.0),
                  f("freq", "Частота", 0.0, 20.0, 0.01, 5.0),
                  f("mag", "Амплитуда", 0.0, 200.0, 0.1, 20.0),
                  f("phase", "Фаза", 0.0, 1.0, 0.01, 0.0)] },
    EffectDef { id: "com.alightcreative.effects.fractalwarp4", label: "Фрактальная деформация", category: "Искажение",
        params: &[f("mag", "Сила", 0.0, 0.3, 0.001, 0.05),
                  f("scale", "Масштаб", 0.1, 4.0, 0.01, 1.0),
                  f("intensity", "Интенсивность", 0.0, 2.0, 0.01, 0.75),
                  f("octaves", "Октавы", 1.0, 10.0, 1.0, 6.0),
                  b("screenSpace", "В экранных координатах", false)] },
];

pub fn find(id: &str) -> Option<&'static EffectDef> {
    EFFECTS.iter().find(|e| e.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parse::parse_scene;

    #[test]
    fn sample_effects_are_in_catalog() {
        let scene = parse_scene(include_str!("../samples/shake.xml")).unwrap();
        for l in &scene.layers {
            for e in &l.effects {
                let def = find(&e.id).unwrap_or_else(|| panic!("нет в каталоге: {}", e.id));
                for p in &e.props {
                    assert!(def.params.iter().any(|d| d.name == p.name), "{}: параметр {}", e.id, p.name);
                }
            }
        }
    }
}
