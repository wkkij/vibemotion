use crate::model::*;
use roxmltree::Node;
use std::collections::BTreeMap;

pub fn parse_scene(text: &str) -> Result<Scene, String> {
    let doc = roxmltree::Document::parse(text).map_err(|e| format!("XML: {e}"))?;
    let root = doc.root_element();
    if root.tag_name().name() != "scene" {
        return Err(format!("корневой тег <{}>, ожидался <scene>", root.tag_name().name()));
    }
    let mut scene = Scene {
        title: attr_s(root, "title"),
        width: attr_f(root, "width"),
        height: attr_f(root, "height"),
        export_width: attr_f(root, "exportWidth"),
        export_height: attr_f(root, "exportHeight"),
        fps: attr_f(root, "fps"),
        total_time_ms: attr_f(root, "totalTime"),
        bgcolor: attr_s(root, "bgcolor"),
        media: vec![],
        layers: vec![],
        unknown: vec![],
    };
    for c in root.children().filter(|n| n.is_element()) {
        match c.tag_name().name() {
            "media" => scene.media.push(Media {
                uri: attr_s(c, "uri"),
                filename: attr_s(c, "filename"),
                width: attr_f(c, "width"),
                height: attr_f(c, "height"),
                duration_raw: attr_f(c, "duration"),
            }),
            "shape" => scene.layers.push(parse_layer(c)),
            other => scene.unknown.push(other.to_string()),
        }
    }
    Ok(scene)
}

fn parse_layer(n: Node) -> Layer {
    let mut layer = Layer {
        id: attr_s(n, "id"),
        label: attr_s(n, "label"),
        kind: attr_s(n, "s"),
        start_ms: attr_f(n, "startTime"),
        end_ms: attr_f(n, "endTime"),
        attrs: all_attrs(n),
        transform: vec![],
        effects: vec![],
        properties: vec![],
        children: vec![],
        unknown: vec![],
    };
    for c in n.children().filter(|x| x.is_element()) {
        match c.tag_name().name() {
            "transform" => {
                layer.transform = c
                    .children()
                    .filter(|x| x.is_element())
                    .map(parse_prop)
                    .collect()
            }
            "effect" => layer.effects.push(Effect {
                id: attr_s(c, "id"),
                attrs: all_attrs(c),
                props: c
                    .children()
                    .filter(|x| x.is_element() && x.tag_name().name() == "property")
                    .map(parse_prop)
                    .collect(),
            }),
            "property" => layer.properties.push(parse_prop(c)),
            "shape" => layer.children.push(parse_layer(c)),
            other => layer.unknown.push(other.to_string()),
        }
    }
    layer
}

fn parse_prop(n: Node) -> Property {
    let name = n.attribute("name").unwrap_or_else(|| n.tag_name().name()).to_string();
    let ty = attr_s(n, "type");
    let constant = n.attribute("value").map(|v| parse_value(&ty, v));
    let mut keyframes: Vec<Keyframe> = n
        .children()
        .filter(|c| c.is_element() && c.tag_name().name() == "kf")
        .map(|k| Keyframe {
            t: attr_f(k, "t"),
            v: parse_value(&ty, k.attribute("v").unwrap_or("")),
            easing: parse_easing(k.attribute("e")),
        })
        .collect();
    keyframes.sort_by(|a, b| a.t.total_cmp(&b.t)); // в файле порядок перемешан
    Property { name, ty, constant, keyframes }
}

fn parse_value(ty: &str, s: &str) -> Value {
    match ty {
        "float" => s.parse().map(Value::Float).unwrap_or_else(|_| Value::Text(s.into())),
        "int" => s.parse().map(Value::Int).unwrap_or_else(|_| Value::Text(s.into())),
        "bool" => Value::Bool(s == "true"),
        _ => infer_value(s),
    }
}

fn infer_value(s: &str) -> Value {
    let parts: Vec<Option<f64>> = s.split(',').map(|p| p.trim().parse().ok()).collect();
    if parts.iter().all(|p| p.is_some()) {
        let v: Vec<f64> = parts.into_iter().flatten().collect();
        if v.len() == 1 {
            Value::Float(v[0])
        } else {
            Value::Vec(v)
        }
    } else {
        Value::Text(s.to_string())
    }
}

fn parse_easing(e: Option<&str>) -> Easing {
    match e {
        None => Easing::Linear,
        Some(s) => {
            let p: Vec<&str> = s.split_whitespace().collect();
            if p.first() == Some(&"cubicBezier") && p.len() == 5 {
                let n: Vec<f64> = p[1..].iter().filter_map(|x| x.parse().ok()).collect();
                if n.len() == 4 {
                    return Easing::CubicBezier(n[0], n[1], n[2], n[3]);
                }
            }
            Easing::Unknown(s.to_string())
        }
    }
}

fn attr_s(n: Node, k: &str) -> String {
    n.attribute(k).unwrap_or("").to_string()
}

fn attr_f(n: Node, k: &str) -> f64 {
    n.attribute(k).and_then(|s| s.parse().ok()).unwrap_or(0.0)
}

fn all_attrs(n: Node) -> BTreeMap<String, String> {
    n.attributes().map(|a| (a.name().to_string(), a.value().to_string())).collect()
}
