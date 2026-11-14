// Описание эффектов Alight Motion: имена, параметры, диапазоны, и расчёт проходов для рендера.
// Смысл параметров взят из справки Alight Motion (Oscillate, Tiles); остальное — приблизительно (помечено supported:'approx').
(function () {
  const VM = (window.VM = window.VM || {});
  const PREFIX = 'com.alightcreative.effects.';

  const f = (name, label, min, max, step, def, hint) => ({ name, ty: 'float', label, min, max, step, def, hint });
  const b = (name, label, def, hint) => ({ name, ty: 'bool', label, def, hint });
  const e = (name, label, options, def, hint) => ({ name, ty: 'int', label, options, def, hint });
  const n = (name, label, min, max, def, hint) => ({ name, ty: 'int', label, min, max, step: 1, def, hint });

  // supported: 'yes' — считается как в приложении; 'approx' — похоже, но формулы подобраны на глаз; 'no' — в предпросмотре пока не применяется
  const META = {
    oscillate3: {
      title: 'Колебание', en: 'Oscillate', supported: 'yes',
      params: [
        n('direction', 'Направление (служебное)', 0, 3, 0),
        f('angle', 'Угол', -3600, 3600, 1, 45, 'Направление качания, по часовой. 0° — по горизонтали, 90° — по вертикали'),
        f('freq', 'Частота, Гц', 0, 16, 0.01, 2, 'Циклов в секунду. Считается накопительно, поэтому анимацией частоты можно разгонять и замедлять'),
        f('mag', 'Амплитуда, px', 0, 4000, 0.5, 25, 'Максимальное смещение слоя от исходной позиции'),
        e('type', 'Волна', ['Синус', 'Треугольник'], 0, 'Синус плавнее у разворота, треугольник — с постоянной скоростью'),
        f('phase', 'Фаза', 0, 1000, 0.01, 0, 'Сдвиг начала цикла. При частоте 0 можно анимировать вручную'),
      ],
    },
    tile: {
      title: 'Плитка', en: 'Tiles', supported: 'yes',
      params: [
        f('scale', 'Обрезка (crop)', 0.05, 20, 0.01, 1, 'Обрезка краёв тайла (>1 обрезает внутрь, <1 добавляет зазор)'),
        f('phase', 'Сдвиг рядов', -100, 100, 0.01, 0, 'Сдвигает каждый второй ряд; 0.5 — на пол-плитки'),
        b('mirror', 'Зеркало', false, 'Каждая вторая плитка отражается — края слоя не рвутся'),
        b('vertoffs', 'Сдвиг по вертикали', false, 'Сдвиг действует на колонки, а не на ряды'),
        f('angle', 'Угол плитки', -1800, 1800, 1, 0, 'Поворот сетки плиток в градусах'),
      ],
    },
    fractalwarp4: {
      title: 'Фрактальное искажение', en: 'Fractal Warp', supported: 'yes',
      params: [
        f('mag', 'Сила', 0, 1, 0.001, 0.05, 'Амплитуда смещения пикселей (как в Alight Motion)'),
        f('scale', 'Масштаб узора', 0.05, 10, 0.01, 1),
        f('intensity', 'Интенсивность', 0, 1, 0.01, 0.75, 'Затухание амплитуды по октавам (persistence)'),
        b('screenSpace', 'В координатах экрана', false, 'Привязать шум к экрану, а не к координатам слоя'),
        n('octaves', 'Октавы', 1, 8, 6, 'Число слоёв шума'),
      ],
    },
    motionblur4: {
      title: 'Размытие движения', en: 'Motion Blur', supported: 'yes',
      params: [
        f('tune', 'Настройка', 0, 4, 0.01, 1, 'Множитель выдержки размытия движения'),
        b('usePos', 'Учитывать позицию', true),
        b('useScale', 'Учитывать масштаб', true),
        b('useAngle', 'Учитывать угол', true),
      ],
    },
    gaussianblur: {
      title: 'Размытие по Гауссу', en: 'Gaussian Blur', supported: 'yes',
      params: [f('strength', 'Сила', 0, 1, 0.001, 0.05, 'Сила размытия в единицах Alight Motion')],
    },
    rgbsep: {
      title: 'RGB-разделение', en: 'RGB Separation', supported: 'yes',
      params: [
        f('strength', 'Сила', 0, 1, 0.001, 0.05, 'Сдвиг каналов в единицах Alight Motion'),
        f('angle', 'Угол', -3600, 3600, 1, 0),
        e('centerChannel', 'Неподвижный канал', ['Красный', 'Зелёный', 'Синий'], 1),
        e('mode', 'Режим', ['Обычный (Normal)', 'Экран (Screen)', 'Сдвиг каналов'], 2, 'Режим смешивания каналов Alight Motion'),
      ],
    },
    randomdisplace: {
      title: 'Случайное смещение', en: 'Random Displacement', supported: 'yes',
      params: [
        f('mag', 'Амплитуда, px', 0, 2000, 1, 50, 'Максимальное случайное смещение слоя'),
        f('evolution', 'Эволюция', 0, 100, 0.01, 0, 'Изменение случайного положения во времени'),
        f('seed', 'Зерно (Seed)', 0, 1000, 1, 0),
        f('scatter', 'Разброс (Scatter)', 0, 1, 0.01, 0.5, 'Резкость перескоков между точками'),
      ],
    },
    shake2: {
      title: 'Тряска', en: 'Shake', supported: 'yes',
      params: [
        f('mag', 'Амплитуда, px', 0, 2000, 1, 50),
        f('freq', 'Частота, Гц', 0, 30, 0.05, 5),
        f('evolution', 'Эволюция', 0, 100, 0.01, 0),
        f('seed', 'Зерно (Seed)', 0, 1000, 1, 0),
        f('angle', 'Угол', -3600, 3600, 1, 0),
        f('slack', 'Плавность (Slack)', 0, 1, 0.01, 0.5),
        f('zshake', 'Z-тряска (масштаб)', 0, 5, 0.01, 0),
      ],
    },
    jitter: {
      title: 'Дрожание', en: 'Jitter', supported: 'yes',
      params: [
        f('angle', 'Угол', -3600, 3600, 1, 45),
        f('freq', 'Частота, Гц', 0, 60, 0.1, 30),
        f('mag', 'Амплитуда, px', 0, 2000, 1, 25),
        f('seed', 'Зерно (Seed)', 0, 1000, 1, 0),
        f('slack', 'Плавность', 0, 1, 0.01, 0),
        f('zjitter', 'Z-дрожание', 0, 5, 0.01, 0),
      ],
    },
    swing2: {
      title: 'Покачивание', en: 'Swing', supported: 'yes',
      params: [
        f('freq', 'Частота, Гц', 0, 16, 0.01, 2),
        f('a1', 'Угол 1', -360, 360, 0.5, -10),
        f('a2', 'Угол 2', -360, 360, 0.5, 10),
        f('phase', 'Фаза', 0, 1000, 0.01, 0),
        e('type', 'Волна', ['Синус', 'Треугольник'], 0),
      ],
    },
    wavewarp2: {
      title: 'Волновое искажение', en: 'Wave Warp', supported: 'yes',
      params: [
        f('phase', 'Фаза', -100, 100, 0.01, 0, 'Сдвиг фазы волны (1.0 = полный цикл)'),
        f('a1d', 'Направление волны', -3600, 3600, 1, 0, 'Угол распространения волны в градусах'),
        f('m1', 'Интервал (Spacing)', 0.5, 200, 0.1, 20, 'Длина волны в единицах Alight Motion'),
        f('m2', 'Амплитуда (Magnitude)', 0, 200, 0.1, 4, 'Размах волны в единицах Alight Motion'),
        f('a2d', 'Угол сдвига (Warp Angle)', -3600, 3600, 1, 90, 'Направление смещения пикселей (90° — поперёк волны)'),
        f('damping', 'Затухание (Damping)', 0, 1, 0.01, 0),
        f('dampingSpace', 'Область затухания', 0, 1, 0.01, 0),
        f('dampingOrigin', 'Центр затухания', 0, 1, 0.01, 0.5),
        b('screenSpace', 'В координатах экрана', false),
      ],
    },
    scaleassist: {
      title: 'Помощник масштаба', en: 'Scale Assist', supported: 'yes',
      params: [
        f('scale', 'Масштаб', 0.05, 5, 0.01, 1, 'Равномерный масштаб вокруг точки опоры (Pivot)'),
        f('stretch', 'Сжатие / Растяжение', -0.9, 2, 0.01, 0, 'Сохраняет объём: при >0 вытягивает по Y и сжимает по X'),
        f('angle', 'Ось сжатия', -360, 360, 1, 0),
      ],
    },
    circularripple2: {
      title: 'Круговая рябь', en: 'Circular Ripple', supported: 'yes',
      params: [
        f('frequency', 'Частота', 0, 20, 0.05, 1),
        f('strength', 'Сила', -1, 1, 0.005, 0.05),
        f('phase', 'Фаза', -100, 100, 0.01, 0),
        f('radius', 'Радиус', 0, 3, 0.01, 0.8),
        f('feather', 'Мягкость краёв', 0, 1, 0.01, 0.1),
      ],
    },
    pinchbulge2: {
      title: 'Сжатие / Выпуклость', en: 'Pinch / Bulge', supported: 'yes',
      params: [
        f('strength', 'Сила', -2, 2, 0.01, 0, 'Отрицательное — сжатие внутрь, положительное — выпуклость'),
        f('radius', 'Радиус', 0.05, 4, 0.01, 1),
      ],
    },
    opticcompesation: {
      title: 'Оптическая компенсация', en: 'Optics Compensation', supported: 'yes',
      params: [
        f('distortion', 'Искажение', -20, 20, 0.05, 0),
        f('strength', 'Сила', -5, 5, 0.01, 0),
        f('separation', 'Хроматический сдвиг', 0, 2, 0.01, 0),
        f('scale', 'Масштаб', 0.1, 5, 0.01, 1),
        f('alpha', 'Прозрачность', 0, 1, 0.01, 1),
      ],
    },
    transform: {
      title: 'Преобразование', en: 'Transform', supported: 'yes',
      params: [
        f('scale', 'Масштаб', 0, 10, 0.01, 1),
        f('angle', 'Поворот', -3600, 3600, 1, 0),
        f('alpha', 'Прозрачность', 0, 1, 0.01, 1),
        f('fill', 'Заполнение', 0, 1, 0.01, 1),
        b('maskToLayer', 'Обрезать по слою', false),
      ],
    },
    transform2: {
      title: 'Преобразование 2', en: 'Transform 2', supported: 'yes',
      params: [
        f('posx', 'Сдвиг X, px', -4000, 4000, 1, 0),
        f('posy', 'Сдвиг Y, px', -4000, 4000, 1, 0),
        f('posz', 'Зум (Z)', 0.05, 10, 0.01, 1),
        f('angle', 'Поворот', -3600, 3600, 1, 0),
        b('xinv', 'Инверсия X', false),
        b('yinv', 'Инверсия Y', false),
        b('zinv', 'Инверсия Z', false),
        b('ainv', 'Инверсия угла', false),
      ],
    },
    exposure: {
      title: 'Экспозиция / Гамма', en: 'Exposure / Gamma', supported: 'yes',
      params: [
        f('exposure', 'Экспозиция', -5, 5, 0.01, 0),
        f('gamma', 'Гамма', 0.1, 5, 0.01, 1),
        f('offset', 'Сдвиг (Offset)', -1, 1, 0.01, 0),
      ],
    },
    highlightshadow: {
      title: 'Света и тени', en: 'Highlights & Shadows', supported: 'yes',
      params: [
        f('highlights', 'Света', 0, 3, 0.01, 1),
        f('shadows', 'Тени', 0, 3, 0.01, 1),
      ],
    },
    gaussianblurplus: {
      title: 'Размытие по Гауссу+', en: 'Gaussian Blur+', supported: 'yes',
      params: [
        f('strength', 'Сила', 0, 1, 0.001, 0.05),
        b('mode', 'Режим', false),
        f('fill', 'Заполнение', 0, 1, 0.01, 0),
      ],
    },
    lensblur2: {
      title: 'Размытие объектива', en: 'Lens Blur', supported: 'yes',
      params: [
        f('strength', 'Сила', 0, 1, 0.001, 0.05),
        f('radius', 'Радиус боке', 0, 1, 0.01, 0.15),
      ],
    },
    rays: {
      title: 'Лучи', en: 'Rays', supported: 'approx',
      params: [
        f('strength', 'Сила', 0, 2, 0.01, 0.2),
        f('intensity', 'Интенсивность', 0, 2, 0.01, 0.2),
        f('threshold', 'Порог яркости', 0, 1, 0.01, 0.6),
        f('blend', 'Смешивание', 0, 1, 0.01, 0),
      ],
    },
    noisefade: {
      title: 'Исчезновение шумом', en: 'Noise Fade', supported: 'approx',
      params: [
        f('PROGRESS', 'Прогресс', 0, 1, 0.005, 0),
        f('scale', 'Масштаб шума', 0.05, 10, 0.01, 1),
        f('angle', 'Угол', -3600, 3600, 1, 0),
        f('alpha', 'Прозрачность', 0, 1, 0.01, 1),
        f('hardness', 'Жёсткость', 0, 1, 0.01, 1),
      ],
    },
    fade: {
      title: 'Затухание (Fade)', en: 'Fade In / Out', supported: 'yes',
      params: [
        f('inTime', 'Появление, с', 0, 30, 0.01, 0.3),
        f('outTime', 'Исчезновение, с', 0, 30, 0.01, 0),
      ],
    },
    pulsesize: {
      title: 'Пульсация размера', en: 'Pulse Size', supported: 'yes',
      params: [
        f('freq', 'Частота, Гц', 0, 20, 0.05, 2, 'Ударов в секунду'),
        f('grow', 'Увеличение', 0, 3, 0.01, 1.25, 'Максимальный множитель масштаба'),
        f('shrink', 'Сжатие', 0.1, 2, 0.01, 0.9, 'Минимальный множитель масштаба'),
        f('phase', 'Фаза', 0, 100, 0.01, 0),
        e('type', 'Волна', ['Синус', 'Треугольник'], 0),
      ],
    },
    flip: {
      title: 'Отражение (Flip)', en: 'Flip Layer', supported: 'yes',
      params: [
        b('flipX', 'По горизонтали (X)', true),
        b('flipY', 'По вертикали (Y)', false),
      ],
    },
    hueshift: {
      title: 'Оттенок и насыщенность', en: 'Hue Shift / Saturation', supported: 'yes',
      params: [
        f('hue', 'Сдвиг оттенка, °', -360, 360, 1, 0),
        f('sat', 'Насыщенность', 0, 3, 0.01, 1),
        f('val', 'Яркость', 0, 3, 0.01, 1),
      ],
    },
    vignette: {
      title: 'Виньетка', en: 'Vignette', supported: 'yes',
      params: [
        f('size', 'Размер', 0.1, 2, 0.01, 0.75),
        f('roundness', 'Округлость', 0, 1, 0.01, 0.7),
        f('feather', 'Мягкость', 0.05, 1.5, 0.01, 0.45),
        f('strength', 'Затемнение', 0, 1, 0.01, 0.6),
      ],
    },
    invert: {
      title: 'Инверсия', en: 'Invert', supported: 'yes', idGuess: true,
      params: [f('amount', 'Сила', 0, 1, 0.01, 1, 'Доля инвертированного цвета: 1 — полный негатив')],
    },
    brightnesscontrast: {
      title: 'Яркость / Контраст', en: 'Brightness / Contrast', supported: 'yes', idGuess: true,
      params: [
        f('brightness', 'Яркость', -1, 1, 0.01, 0),
        f('contrast', 'Контраст', 0, 3, 0.01, 1, '1 — без изменений'),
      ],
    },
    colortemperature: {
      title: 'Цветовая температура', en: 'Color Temperature', supported: 'approx', idGuess: true,
      params: [
        f('temperature', 'Температура', -1, 1, 0.01, 0, 'Отрицательная — холоднее (синий), положительная — теплее (оранжевый)'),
        f('tint', 'Оттенок (зелёный ↔ пурпур)', -1, 1, 0.01, 0),
      ],
    },
    directionalblur: {
      title: 'Направленное размытие', en: 'Directional Blur', supported: 'approx', idGuess: true,
      params: [
        f('strength', 'Сила', 0, 1, 0.001, 0.05),
        f('angle', 'Угол', -3600, 3600, 1, 0, '0° — по горизонтали, 90° — по вертикали'),
      ],
    },
    zoomblur: {
      title: 'Размытие зумом', en: 'Zoom Blur', supported: 'approx', idGuess: true,
      params: [
        f('strength', 'Сила', 0, 1, 0.005, 0.1),
        f('offx', 'Центр X, px', -2000, 2000, 1, 0, 'Смещение центра зума от центра слоя'),
        f('offy', 'Центр Y, px', -2000, 2000, 1, 0),
      ],
    },
    spinblur: {
      title: 'Размытие вращением', en: 'Spin Blur', supported: 'approx', idGuess: true,
      params: [
        f('angle', 'Угол, °', 0, 180, 0.5, 10, 'Полный размах размытия в градусах'),
        f('offx', 'Центр X, px', -2000, 2000, 1, 0),
        f('offy', 'Центр Y, px', -2000, 2000, 1, 0),
      ],
    },
    pixelate: {
      title: 'Пикселизация', en: 'Pixelate', supported: 'yes', idGuess: true,
      params: [f('size', 'Размер блока, px', 1, 300, 1, 16)],
    },
    posterize: {
      title: 'Постеризация', en: 'Posterize', supported: 'yes', idGuess: true,
      params: [f('levels', 'Уровней на канал', 2, 32, 1, 6)],
    },
    threshold: {
      title: 'Порог', en: 'Threshold', supported: 'yes', idGuess: true,
      params: [f('level', 'Уровень яркости', 0, 1, 0.005, 0.5, 'Ярче порога — белое, темнее — чёрное')],
    },
    saturationvibrance: {
      title: 'Насыщенность / Красочность', en: 'Saturation / Vibrance', supported: 'approx', idGuess: true,
      params: [
        f('saturation', 'Насыщенность', 0, 3, 0.01, 1, '0 — чёрно-белое, 1 — без изменений'),
        f('vibrance', 'Красочность', -1, 1, 0.01, 0, 'Усиливает в первую очередь блёклые цвета'),
      ],
    },
    pulseopacity: {
      title: 'Пульсация прозрачности', en: 'Pulse Opacity', supported: 'yes', idGuess: true,
      params: [
        f('freq', 'Частота, Гц', 0, 20, 0.05, 2),
        f('min', 'Минимум', 0, 1, 0.01, 0.3, 'Наименьшая непрозрачность слоя'),
        f('phase', 'Фаза', 0, 100, 0.01, 0),
        e('type', 'Волна', ['Синус', 'Треугольник'], 0),
      ],
    },
    flicker: {
      title: 'Мерцание', en: 'Flicker', supported: 'yes', idGuess: true,
      params: [
        f('amount', 'Сила', 0, 1, 0.01, 0.5, 'Насколько сильно слой гаснет на мерцающих кадрах'),
        f('freq', 'Частота, Гц', 0, 60, 0.1, 24),
        f('seed', 'Зерно (Seed)', 0, 1000, 1, 0),
      ],
    },
    autoshake: {
      title: 'Авто-тряска (AM)', en: 'Auto-Shake', supported: 'yes',
      params: [
        f('mag', 'Амплитуда, px', 0, 2000, 1, 45, 'Сила смещения по осям'),
        f('freq', 'Частота, Гц', 0, 30, 0.05, 4, 'Скорость колебаний шума Перлина'),
        f('evolution', 'Эволюция', 0, 100, 0.01, 0, 'Фазовый сдвиг траектории'),
        f('seed', 'Зерно (Seed)', 0, 1000, 1, 1),
        f('angle', 'Угол, °', -3600, 3600, 1, 0, 'Основная ось тряски'),
        f('slack', 'Плавность (Slack)', 0, 1, 0.01, 0.35, 'Соотношение поперечной и продольной амплитуды'),
        f('zshake', 'Z-тряска (зум)', 0, 2, 0.01, 0.08, 'Пульсация масштаба в такт тряске'),
      ],
    },
    turbulentdisplace: {
      title: 'Турбулентное смещение', en: 'Turbulent Displace', supported: 'yes',
      params: [
        f('strength', 'Сила (Amount)', -1, 1, 0.005, 0.08, 'Амплитуда смещения по шуму'),
        f('scale', 'Размер (Scale)', 0.05, 10, 0.01, 1.2, 'Масштаб ячеек турбулентности'),
        f('evolution', 'Эволюция', 0, 100, 0.01, 0, 'Анимация течения турбулентности'),
        n('octaves', 'Сложность (Octaves)', 1, 8, 3, 'Количество октав фрактального шума'),
        f('seed', 'Зерно (Seed)', 0, 1000, 1, 0),
      ],
    },
    swirl: {
      title: 'Вихрь (Swirl)', en: 'Swirl', supported: 'yes',
      params: [
        f('strength', 'Угол закручивания', -10, 10, 0.05, 1.5, 'Сила закручивания вокруг центра'),
        f('radius', 'Радиус', 0.05, 3, 0.01, 0.85, 'Зона действия вихря'),
      ],
    },
    glow: {
      title: 'Свечение (Glow)', en: 'Glow', supported: 'yes',
      params: [
        f('radius', 'Радиус', 0, 1, 0.005, 0.12, 'Радиус рассеивания света'),
        f('intensity', 'Интенсивность', 0, 4, 0.02, 1.2, 'Яркость свечения'),
        f('threshold', 'Порог яркости', 0, 1, 0.01, 0.55, 'Какие светлые участки начинают светиться'),
      ],
    },
    chromakey: {
      title: 'Хромакей (Chroma Key)', en: 'Chroma Key', supported: 'yes',
      params: [
        f('keyR', 'Красный (R)', 0, 1, 0.01, 0, 'Красный канал ключевого цвета'),
        f('keyG', 'Зелёный (G)', 0, 1, 0.01, 1, 'Зелёный канал ключевого цвета'),
        f('keyB', 'Синий (B)', 0, 1, 0.01, 0, 'Синий канал ключевого цвета'),
        f('tolerance', 'Допуск', 0.01, 1, 0.01, 0.22, 'Насколько близкие к ключу цвета вырезать'),
        f('feather', 'Мягкость края', 0, 0.5, 0.01, 0.08, 'Плавность перехода прозрачности'),
        f('despill', 'Подавление цвета (Spill)', 0, 1, 0.01, 0.5, 'Убирает цветной рефлекс ключа с краёв объекта'),
      ],
    },
  };

  function hueDegToRgb01(deg) {
    const h = (((Number(deg) || 0) % 360) + 360) % 360;
    const x = 1 - Math.abs(((h / 60) % 2) - 1);
    if (h < 60) return [1, x, 0];
    if (h < 120) return [x, 1, 0];
    if (h < 180) return [0, 1, x];
    if (h < 240) return [0, x, 1];
    if (h < 300) return [x, 0, 1];
    return [1, 0, x];
  }

  const keyOf = (id) => id.replace(PREFIX, '');
  const metaOf = (id) => META[keyOf(id)] || null;

  function hash1(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }
  function valueNoise1D(x, seed) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    const a = hash1(i + seed * 57.0) * 2 - 1;
    const b = hash1(i + 1 + seed * 57.0) * 2 - 1;
    return a + (b - a) * u;
  }

  VM.Effects = {
    META,
    metaOf,
    title(id) {
      const m = metaOf(id);
      if (m) return m.title;
      return keyOf(id).replace(/\d+$/, '').replace(/^./, (c) => c.toUpperCase());
    },
    subtitle(id) { const m = metaOf(id); return m ? m.en : id; },
    list() { return Object.keys(META).map((k) => ({ id: PREFIX + k, title: META[k].title, en: META[k].en })); },
    make(id) {
      const m = metaOf(id);
      return {
        id, attrs: {}, off: false,
        props: m.params.map((p) => ({ name: p.name, ty: p.ty, constant: p.def, kfs: [] })),
      };
    },

    // Вычисляет модификаторы трансформации слоя (сдвиг, масштаб, поворот, альфа) от эффектов типа swing2 / transform / fade
    layerMod(L, lt) {
      const dur = Math.max(0.001, (L.end - L.start) / 1000);
      const elapsed = lt * dur;
      const remain = (1 - lt) * dur;
      let dx = 0, dy = 0, sx = 1, sy = 1, drot = 0, alpha = 1;
      for (const fx of L.effects) {
        if (fx.off) continue;
        const key = keyOf(fx.id);
        const get = (name, def) => {
          const p = VM.getProp(fx.props, name);
          const v = p ? VM.evalProp(p, lt) : undefined;
          return v === undefined || Array.isArray(v) ? def : Number(v);
        };
        if (key === 'swing2') {
          const freq = get('freq', 2);
          const a1 = get('a1', -10);
          const a2 = get('a2', 10);
          const ph = 2 * Math.PI * (lt * dur * freq + get('phase', 0));
          const w = get('type', 0) === 1 ? (2 / Math.PI) * Math.asin(Math.sin(ph)) : Math.sin(ph);
          drot += ((a1 + a2) * 0.5 + (a2 - a1) * 0.5 * w) * (Math.PI / 180);
        } else if (key === 'scaleassist') {
          const sc = Math.max(0.01, get('scale', 1));
          const st = get('stretch', 0);
          const k = Math.max(0.15, 1 + st);
          sx *= sc / Math.sqrt(k);
          sy *= sc * Math.sqrt(k);
        } else if (key === 'transform') {
          const sc = get('scale', 1);
          sx *= sc; sy *= sc;
          drot += (get('angle', 0) * Math.PI) / 180;
          alpha *= Math.max(0, Math.min(1, get('alpha', 1)));
        } else if (key === 'transform2') {
          const z = Math.max(0.05, get('posz', 1));
          const invZ = get('zinv', 0) ? 1 / z : z;
          sx *= invZ; sy *= invZ;
          dx += get('posx', 0) * (get('xinv', 0) ? -1 : 1);
          dy += get('posy', 0) * (get('yinv', 0) ? -1 : 1);
          drot += ((get('angle', 0) * (get('ainv', 0) ? -1 : 1)) * Math.PI) / 180;
        } else if (key === 'pulsesize') {
          const freq = get('freq', 2);
          const grow = get('grow', 1.25);
          const shrink = get('shrink', 0.9);
          const ph = 2 * Math.PI * (lt * dur * freq + get('phase', 0));
          const w = get('type', 0) === 1 ? (2 / Math.PI) * Math.asin(Math.sin(ph)) : Math.sin(ph);
          const m = shrink + (grow - shrink) * (w * 0.5 + 0.5);
          sx *= m; sy *= m;
        } else if (key === 'autoshake') {
          const z = get('zshake', 0);
          if (z > 0) {
            const freq = get('freq', 4);
            const ev = get('evolution', 0);
            const seed = get('seed', 1);
            const nz = valueNoise1D(lt * dur * freq + ev * 3.0, seed + 23.4);
            const m = Math.max(0.2, 1 + nz * z);
            sx *= m;
            sy *= m;
          }
        } else if (key === 'flip') {
          if (get('flipX', 1)) sx *= -1;
          if (get('flipY', 0)) sy *= -1;
        } else if (key === 'fade') {
          const inT = get('inTime', 0);
          const outT = get('outTime', 0);
          if (inT > 0 && elapsed < inT) alpha *= Math.max(0, elapsed / inT);
          if (outT > 0 && remain < outT) alpha *= Math.max(0, remain / outT);
        } else if (key === 'pulseopacity') {
          const ph = 2 * Math.PI * (lt * dur * get('freq', 2) + get('phase', 0));
          const w = get('type', 0) === 1 ? (2 / Math.PI) * Math.asin(Math.sin(ph)) : Math.sin(ph);
          const mn = Math.max(0, Math.min(1, get('min', 0.3)));
          alpha *= mn + (1 - mn) * (w * 0.5 + 0.5);
        } else if (key === 'flicker') {
          const step = Math.floor(elapsed * Math.max(0, get('freq', 24)));
          const am = Math.max(0, Math.min(1, get('amount', 0.5)));
          alpha *= 1 - am * hash1(step + get('seed', 0) * 57.0);
        } else if (key === 'noisefade') {
          const prog = Math.max(0, Math.min(1, get('PROGRESS', 0)));
          const al = Math.max(0, Math.min(1, get('alpha', 1)));
          alpha *= (1 - prog) * al;
        }
      }
      return { dx, dy, sx, sy, drot, alpha };
    },

    // Проходы рендера для слоя в момент lt (нормализованное время слоя).
    // rect: { center:[x,y], extent:[hx,hy], rot } в пикселях сцены.
    passes(L, lt, scene, rect) {
      const out = [];
      const W = scene.width || 1080;
      const H = scene.height || W;
      const fps = scene.fps || 60;
      const dur = Math.max(0.001, (L.end - L.start) / 1000);
      const dt = Math.min(0.25, 1 / (fps * dur));
      let geoShift = [0, 0];

      // подряд идущие геометрические эффекты сливаются в один проход (до 6 штук)
      const geo = (op) => {
        const last = out[out.length - 1];
        if (last && last.fs === 'geo' && last.ops.length < 6) last.ops.push(op);
        else out.push({ fs: 'geo', ops: [op] });
      };

      if (L.cornerWarp && (L.cornerWarp.delta || 0) > 0.0005) {
        const cw = L.cornerWarp;
        const cols = cw.cols || 2;
        const rows = cw.rows || 2;
        let basePts = cw.basePts;
        let currPts = cw.currPts;
        if ((!basePts || !currPts) && cw.quad) {
          basePts = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
          currPts = [cw.quad.tl, cw.quad.tr, cw.quad.bl, cw.quad.br];
        }
        if (basePts && currPts && basePts.length === cols * rows) {
          geo({
            t: 9,
            h: [rect.rot, cw.mode || 0, cw.delta || 0],
            a: [rect.center[0], rect.center[1], rect.extent[0], rect.extent[1]],
            mesh: {
              cols,
              rows,
              mode: cw.mode || 0,
              basePts,
              currPts,
            },
          });
        }
      }

      const evalOsc = (fx, tNorm) => {
        const g = (name, def) => {
          const p = VM.getProp(fx.props, name);
          const v = p ? VM.evalProp(p, tNorm) : undefined;
          return v === undefined || Array.isArray(v) ? def : Number(v);
        };
        const mag = g('mag', 0);
        if (!(mag > 0)) return [0, 0];
        const pf = VM.getProp(fx.props, 'freq');
        let cycles = g('phase', 0);
        const N = 128;
        const lt0 = Math.max(0, Math.min(1, tNorm));
        for (let i = 0; i < N; i++) {
          const x = ((i + 0.5) / N) * lt0;
          const fr = pf ? Number(VM.evalProp(pf, x)) : 2;
          cycles += (isFinite(fr) ? fr : 0) * (lt0 / N) * dur;
        }
        const ph = 2 * Math.PI * cycles;
        const wave = g('type', 0) === 1 ? (2 / Math.PI) * Math.asin(Math.sin(ph)) : Math.sin(ph);
        const ang = (g('angle', 45) * Math.PI) / 180;
        return [Math.cos(ang) * mag * wave, Math.sin(ang) * mag * wave];
      };

      const evalDisp = (fx, key, tNorm) => {
        const g = (name, def) => {
          const p = VM.getProp(fx.props, name);
          const v = p ? VM.evalProp(p, tNorm) : undefined;
          return v === undefined || Array.isArray(v) ? def : Number(v);
        };
        const mag = g('mag', 0);
        if (!(mag > 0)) return [0, 0];
        const seed = g('seed', 0);
        if (key === 'randomdisplace') {
          const ev = g('evolution', 0);
          const scatter = Math.max(0.05, g('scatter', 0.5));
          const stepT = Math.floor((ev * 12 + tNorm * dur * 10) / scatter);
          const nx = valueNoise1D(stepT * 0.7 + ev * 4, seed + 1.3);
          const ny = valueNoise1D(stepT * 0.7 + ev * 4, seed + 9.7);
          return [nx * mag, ny * mag];
        }
        const freq = g('freq', key === 'jitter' ? 30 : 5);
        const ev = g('evolution', 0);
        const phase = tNorm * dur * freq + ev * 3.0;
        const ang = (g('angle', 0) * Math.PI) / 180;
        const slack = Math.max(0, Math.min(1, g('slack', key === 'jitter' ? 0.35 : 0.5)));
        const n1 = valueNoise1D(phase, seed + 2.1);
        const n2 = valueNoise1D(phase, seed + 14.7) * (0.25 + slack * 0.75);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        return [(ca * n1 - sa * n2) * mag, (sa * n1 + ca * n2) * mag];
      };

      for (let idx = 0; idx < L.effects.length; idx++) {
        const fx = L.effects[idx];
        if (fx.off) continue;
        const key = keyOf(fx.id);
        const get = (name, def) => {
          const p = VM.getProp(fx.props, name);
          const v = p ? VM.evalProp(p, lt) : undefined;
          return v === undefined || Array.isArray(v) ? def : Number(v);
        };
        if (key === 'oscillate3') {
          const d0 = evalOsc(fx, lt);
          const dPrev = evalOsc(fx, Math.max(0, lt - dt));
          geoShift[0] += d0[0] - dPrev[0];
          geoShift[1] += d0[1] - dPrev[1];
          if (Math.hypot(d0[0], d0[1]) <= 0.001) continue;
          geo({ t: 0, a: [d0[0], d0[1], 0, 0] });
        } else if (key === 'randomdisplace' || key === 'shake2' || key === 'jitter' || key === 'autoshake') {
          const d0 = evalDisp(fx, key, lt);
          const dPrev = evalDisp(fx, key, Math.max(0, lt - dt));
          geoShift[0] += d0[0] - dPrev[0];
          geoShift[1] += d0[1] - dPrev[1];
          if (Math.hypot(d0[0], d0[1]) <= 0.001) continue;
          geo({ t: 0, a: [d0[0], d0[1], 0, 0] });
        } else if (key === 'tile') {
          const cropScale = Math.max(0.05, get('scale', 1));
          const tileAng = (get('angle', 0) * Math.PI) / 180;
          const flags = (get('mirror', 0) ? 1 : 0) + (get('vertoffs', 0) ? 2 : 0);
          geo({
            t: 1,
            a: [rect.center[0], rect.center[1], rect.extent[0] * 2, rect.extent[1] * 2],
            b: [rect.rot + tileAng, flags, get('phase', 0), cropScale],
          });
        } else if (key === 'fractalwarp4') {
          const mag = get('mag', 0);
          if (!(mag > 0)) continue;
          const scr = get('screenSpace', 0) ? 1 : 0;
          geo({
            t: 2,
            a: [mag, get('scale', 1), get('intensity', 0.75), Math.round(get('octaves', 6))],
            b: [scr, rect.center[0], rect.center[1], rect.rot],
            c: [rect.extent[0] * 2, rect.extent[1] * 2, 0, 0],
          });
        } else if (key === 'wavewarp2') {
          const m2 = get('m2', 0);
          if (Math.abs(m2) <= 0.01) continue;
          geo({
            t: 3,
            a: [get('phase', 0), (get('a1d', 0) * Math.PI) / 180, get('m1', 20), m2],
            b: [(get('a2d', 90) * Math.PI) / 180, get('damping', 0), get('dampingOrigin', 0.5), get('screenSpace', 0) ? 1 : 0],
            c: [rect.center[0], rect.center[1], rect.extent[0] * 2, rect.extent[1] * 2, get('dampingSpace', 0)],
          });
        } else if (key === 'circularripple2') {
          const str = get('strength', 0);
          if (Math.abs(str) <= 0.0005) continue;
          geo({
            t: 4,
            a: [get('frequency', 1), str, get('phase', 0), Math.max(0.05, get('radius', 0.8))],
            b: [rect.center[0], rect.center[1], Math.max(0.01, get('feather', 0.1)), Math.min(W, H) * 0.5],
          });
        } else if (key === 'pinchbulge2' || key === 'opticcompesation') {
          const str = key === 'pinchbulge2' ? get('strength', 0) : -get('distortion', 0) * 0.08 + get('strength', 0);
          const rad = key === 'pinchbulge2' ? Math.max(0.05, get('radius', 1)) : 1.25;
          if (Math.abs(str) <= 0.001) continue;
          geo({
            t: 5,
            a: [str, rad, rect.center[0], rect.center[1]],
            b: [Math.min(W, H) * 0.5, 0, 0, 0],
          });
        } else if (key === 'turbulentdisplace') {
          const str = get('strength', 0);
          if (Math.abs(str) <= 0.0005) continue;
          geo({
            t: 7,
            a: [str, Math.max(0.05, get('scale', 1.2)), get('evolution', 0), Math.round(get('octaves', 3))],
            b: [rect.center[0], rect.center[1], rect.rot, get('seed', 0)],
            c: [rect.extent[0] * 2, rect.extent[1] * 2, 0, 0],
          });
        } else if (key === 'swirl') {
          const str = get('strength', 0);
          if (Math.abs(str) <= 0.001) continue;
          geo({
            t: 8,
            a: [str, Math.max(0.05, get('radius', 0.85)), rect.center[0], rect.center[1]],
            b: [Math.min(W, H) * 0.5, 0, 0, 0],
          });
        } else if (key === 'glow') {
          const inten = get('intensity', 0);
          const rad = get('radius', 0.12);
          if (inten > 0.01 && rad > 0.001) {
            out.push({ fs: 'glow', a: [rad * Math.min(W, H) * 0.09, inten, get('threshold', 0.55), 0] });
          }
        } else if (key === 'chromakey') {
          const hasRgb = VM.getProp(fx.props, 'keyR') && VM.getProp(fx.props, 'keyG') && VM.getProp(fx.props, 'keyB');
          let kr, kg, kb;
          if (hasRgb) {
            kr = Math.max(0, Math.min(1, get('keyR', 0)));
            kg = Math.max(0, Math.min(1, get('keyG', 1)));
            kb = Math.max(0, Math.min(1, get('keyB', 0)));
          } else {
            [kr, kg, kb] = hueDegToRgb01(get('hue', 120));
          }
          out.push({
            fs: 'color',
            a: [kr, kg, kb, 10],
            b: [
              Math.max(0.005, get('tolerance', 0.22)),
              Math.max(0.001, get('feather', 0.08)),
              Math.max(0, Math.min(1, get('despill', 0.5))),
              0,
            ],
          });
        } else if (key === 'motionblur4') {
          const tune = get('tune', 1);
          if (!(tune > 0.01)) continue;
          const tPrev = Math.max(0, lt - dt);
          const vecAt = (name, def) => {
            const p = VM.getProp(L.transform, name);
            const v = p ? VM.evalProp(p, lt) : undefined;
            const vp = p ? VM.evalProp(p, tPrev) : undefined;
            const a = Array.isArray(v) ? v : typeof v === 'number' ? [v, v] : def;
            const b = Array.isArray(vp) ? vp : typeof vp === 'number' ? [vp, vp] : a;
            return [a, b];
          };
          let vx = geoShift[0], vy = geoShift[1];
          if (get('usePos', 1)) {
            const [p1, p0] = vecAt('location', rect.center);
            vx += p1[0] - p0[0];
            vy += p1[1] - p0[1];
          }
          let dScale = 0, dRot = 0;
          if (get('useScale', 1)) {
            const [s1, s0] = vecAt('scale', [1, 1]);
            dScale = ((s1[0] - s0[0]) + (s1[1] - s0[1])) * 0.5;
          }
          if (get('useAngle', 1)) {
            const pr = VM.getProp(L.transform, 'rotation');
            const r1 = pr ? Number(VM.evalProp(pr, lt)) || 0 : 0;
            const r0 = pr ? Number(VM.evalProp(pr, tPrev)) || 0 : 0;
            dRot = ((r1 - r0) * Math.PI) / 180;
          }
          const maxExt = Math.max(rect.extent[0], rect.extent[1]);
          const speed = Math.hypot(vx, vy) + Math.abs(dScale) * maxExt + Math.abs(dRot) * maxExt;
          if (speed * tune > 0.25) {
            out.push({
              fs: 'mblur',
              dir: [vx * tune * 0.55, vy * tune * 0.55],
              a: [rect.center[0], rect.center[1], dScale * tune * 0.55, dRot * tune * 0.55],
            });
          }
        } else if (key === 'gaussianblur' || key === 'gaussianblurplus' || key === 'lensblur2') {
          // В Alight Motion strength=0.15 соответствует ~18px на 1080p (коэффициент ~0.115 от меньшей стороны)
          const mul = key === 'lensblur2' ? 0.145 : 0.115;
          const sigma = get('strength', 0) * Math.min(W, H) * mul;
          if (!(sigma > 0.15)) continue;
          out.push({ fs: 'blur', dir: [1, 0], a: [sigma, 0, 0, 0] });
          out.push({ fs: 'blur', dir: [0, 1], a: [sigma, 0, 0, 0] });
        } else if (key === 'rgbsep') {
          // В Alight Motion strength=0.12 смещает каналы примерно на ~13px на 1080p (0.10 * W)
          const ofs = get('strength', 0) * W * 0.105;
          if (!(ofs > 0.05)) continue;
          const ang = (get('angle', 0) * Math.PI) / 180;
          out.push({
            fs: 'rgb',
            a: [Math.cos(ang) * ofs, Math.sin(ang) * ofs, get('centerChannel', 1), get('mode', 2)],
          });
        } else if (key === 'exposure') {
          const exp = get('exposure', 0);
          const gam = Math.max(0.05, get('gamma', 1));
          const off = get('offset', 0);
          if (Math.abs(exp) > 0.001 || Math.abs(gam - 1) > 0.001 || Math.abs(off) > 0.001) {
            out.push({ fs: 'color', a: [Math.pow(2, exp), 1 / gam, off, 0], b: [1, 1, 0, 0] });
          }
        } else if (key === 'highlightshadow') {
          const hi = get('highlights', 1);
          const sh = get('shadows', 1);
          if (Math.abs(hi - 1) > 0.001 || Math.abs(sh - 1) > 0.001) {
            out.push({ fs: 'color', a: [1, 1, 0, 1], b: [hi, sh, 0, 0] });
          }
        } else if (key === 'invert') {
          const am = Math.max(0, Math.min(1, get('amount', 1)));
          if (am > 0.002) out.push({ fs: 'color', a: [am, 0, 0, 4], b: [0, 0, 0, 0] });
        } else if (key === 'brightnesscontrast') {
          const br = get('brightness', 0), co = get('contrast', 1);
          if (Math.abs(br) > 0.002 || Math.abs(co - 1) > 0.002) out.push({ fs: 'color', a: [br, co, 0, 5], b: [0, 0, 0, 0] });
        } else if (key === 'colortemperature') {
          const tp = get('temperature', 0), tn = get('tint', 0);
          if (Math.abs(tp) > 0.002 || Math.abs(tn) > 0.002) out.push({ fs: 'color', a: [tp, tn, 0, 6], b: [0, 0, 0, 0] });
        } else if (key === 'directionalblur') {
          const sigma = get('strength', 0) * Math.min(W, H) * 0.115;
          if (sigma > 0.15) {
            const ang = (get('angle', 0) * Math.PI) / 180;
            out.push({ fs: 'blur', dir: [Math.cos(ang), Math.sin(ang)], a: [sigma, 0, 0, 0] });
          }
        } else if (key === 'pixelate') {
          const sz = Math.max(1, Math.round(get('size', 16)));
          if (sz > 1) out.push({ fs: 'pix', a: [sz, rect.center[0], rect.center[1], 0] });
        } else if (key === 'posterize') {
          out.push({ fs: 'color', a: [Math.max(2, Math.round(get('levels', 6))), 0, 0, 7], b: [0, 0, 0, 0] });
        } else if (key === 'threshold') {
          out.push({ fs: 'color', a: [get('level', 0.5), 0, 0, 8], b: [0, 0, 0, 0] });
        } else if (key === 'saturationvibrance') {
          const sa = get('saturation', 1), vi = get('vibrance', 0);
          if (Math.abs(sa - 1) > 0.002 || Math.abs(vi) > 0.002) out.push({ fs: 'color', a: [sa, vi, 0, 9], b: [0, 0, 0, 0] });
        } else if (key === 'zoomblur') {
          const k = get('strength', 0);
          if (k > 0.001) out.push({ fs: 'zoom', a: [Math.min(k, 0.95), rect.center[0] + get('offx', 0), rect.center[1] + get('offy', 0), 0] });
        } else if (key === 'spinblur') {
          const ang = (get('angle', 0) * Math.PI) / 180;
          if (ang > 0.0005) out.push({ fs: 'spin', a: [ang, rect.center[0] + get('offx', 0), rect.center[1] + get('offy', 0), 0] });
        } else if (key === 'rays') {
          const str = Math.max(get('strength', 0), get('intensity', 0));
          if (str > 0.01) {
            out.push({ fs: 'color', a: [1 + str * 0.45, 1, str * 0.05, 0], b: [1, 1, 0, 0] });
          }
        } else if (key === 'hueshift') {
          const hue = ((get('hue', 0) % 360) + 360) % 360;
          const sat = Math.max(0, get('sat', 1));
          const val = Math.max(0, get('val', 1));
          if (Math.abs(hue) > 0.1 || Math.abs(sat - 1) > 0.005 || Math.abs(val - 1) > 0.005) {
            out.push({ fs: 'color', a: [hue / 360, sat, val, 2], b: [0, 0, 0, 0] });
          }
        } else if (key === 'vignette') {
          const str = Math.max(0, Math.min(1, get('strength', 0.6)));
          if (str > 0.005) {
            out.push({
              fs: 'color',
              a: [get('size', 0.75), Math.max(0.05, get('feather', 0.45)), str, 3],
              b: [get('roundness', 0.7), 0, 0, 0],
            });
          }
        }
      }
      return out;
    },
  };
})();
