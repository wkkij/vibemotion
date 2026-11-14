use std::{env, fs, process};
use vm_core::model::*;
use vm_core::parse::parse_scene;

fn main() {
    let path = env::args().nth(1).unwrap_or_else(|| {
        eprintln!("использование: cargo run -- samples/shake.xml");
        process::exit(1)
    });
    let text = fs::read_to_string(&path).unwrap_or_else(|e| {
        eprintln!("не прочитался файл: {e}");
        process::exit(1)
    });
    let scene = parse_scene(&text).unwrap_or_else(|e| {
        eprintln!("ошибка разбора: {e}");
        process::exit(1)
    });

    println!("Сцена: \"{}\"  {}x{} -> экспорт {}x{}  {} fps  {} мс  фон {}",
        scene.title, scene.width, scene.height, scene.export_width, scene.export_height,
        scene.fps, scene.total_time_ms, scene.bgcolor);
    println!("Медиа: {}", scene.media.len());
    for m in &scene.media {
        println!("  {}  {}x{}", m.filename, m.width, m.height);
    }
    println!("Слоёв: {}", scene.layers.len());
    for l in &scene.layers {
        print_layer(l, 0);
    }
    if !scene.unknown.is_empty() {
        println!("Нераспознанные теги сцены: {:?}", scene.unknown);
    }
}

fn print_layer(l: &Layer, depth: usize) {
    let pad = "  ".repeat(depth);
    println!("{pad}Слой {} [{}] {}..{} мс, эффектов: {}",
        l.id, l.kind, l.start_ms, l.end_ms, l.effects.len());
    for e in &l.effects {
        let short = e.id.rsplit('.').next().unwrap_or(&e.id);
        println!("{pad}  - {short}");
        for p in &e.props {
            let mid = p.eval(0.5);
            println!("{pad}      {} ({}), ключей: {}, при t=0.5: {:?}",
                p.name, p.ty, p.keyframes.len(), mid);
        }
    }
    if !l.unknown.is_empty() {
        println!("{pad}  нераспознанные теги: {:?}", l.unknown);
    }
    for c in &l.children {
        print_layer(c, depth + 1);
    }
}
