/* vibemotion i18n: English by default, Russian via switcher.
   Source strings in the code are Russian; this layer maps fragments RU -> EN
   for text nodes, tooltips, placeholders and dialogs, and restores RU on switch. */
(function () {
  'use strict';
  const D = {
    // ---- main screen / header ----
    'Моушн-редактор и предпросмотр проектов Alight Motion на WebGPU': 'Motion editor and Alight Motion project preview on WebGPU',
    'Настройки интерфейса и автосохранения': 'Interface and autosave settings',
    'Настройки интерфейса и рендера': 'Interface and render settings',
    'Настройки интерфейса и предпросмотра': 'Interface and preview settings',
    'Настройки': 'Settings',
    'Новый проект': 'New project',
    'Автосохранение каждые': 'Autosave every',
    'Название проекта (например, Эдит #1)': 'Project name (e.g. Edit #1)',
    'Разрешение и частота кадров': 'Resolution and frame rate',
    'Вертикальный': 'Vertical', 'Квадрат': 'Square', 'Горизонтальный': 'Horizontal', 'Пост': 'Post',
    'Создать проект': 'Create project',
    'Импортировать XML-проект Alight Motion': 'Import an Alight Motion XML project',
    'Импорт XML': 'Import XML',
    'Ваши проекты': 'Your projects',
    'Поиск по проектам…': 'Search projects…',
    'Проектов пока нет': 'No projects yet',
    'Создайте пустой проект выше или импортируйте готовый XML из Alight Motion — он сохранится автоматически.': 'Create an empty project above or import a ready XML from Alight Motion — it is saved automatically.',
    'Вернуться на главный экран проектов': 'Back to the projects screen',
    'Проекты': 'Projects',
    'Проект не открыт': 'No project open',
    'Нажмите, чтобы переименовать проект': 'Click to rename the project',
    'Статус автосохранения проекта': 'Project autosave status',
    'Частота кадров проекта (FPS)': 'Project frame rate (FPS)',
    'Частота кадров проекта': 'Project frame rate',
    'Ступенчатый предпросмотр (пониженный FPS для эффекта stop-motion / tweenslop)': 'Stepped preview (reduced FPS for a stop-motion / tweenslop look)',
    'Ступенчатый FPS предпросмотра': 'Stepped preview FPS',
    'Шаг': 'Step', 'Плавно': 'Smooth',
    'Сохранить проект сейчас (Ctrl+S)': 'Save project now (Ctrl+S)',
    'Сохранить': 'Save',
    'Включить или выключить рендер эффектов': 'Toggle effects rendering',
    'Эффекты': 'Effects',
    'Открыть XML': 'Open XML',
    'Видео, фото или музыка (можно перетащить в окно)': 'Video, photo or music (you can drag into the window)',
    'Добавить медиа': 'Add media',
    'Файлы проекта': 'Project files',
    'Перетащите XML, видео, фото или аудио прямо в окно. Медиа добавится новым слоем на позицию курсора.': 'Drag XML, video, photo or audio into the window. Media is added as a new layer at the playhead.',
    'Слой': 'Layer', 'Опора': 'Pivot', 'Файл': 'File',
    'В начало (Home)': 'To start (Home)',
    'Кадр назад (←)': 'Frame back (←)',
    'Пуск / пауза (Пробел)': 'Play / pause (Space)',
    'Кадр вперёд (→)': 'Frame forward (→)',
    'Громкость предпросмотра (M — выключить/включить звук)': 'Preview volume (M — mute/unmute)',
    'Выключить / включить звук (M)': 'Mute / unmute (M)',
    'К предыдущей метке ( [ )': 'To previous marker ( [ )',
    'Поставить метку бита на курсоре (B). На паузе повторное нажатие в том же месте убирает метку': 'Add a beat marker at the playhead (B). When paused, pressing again at the same spot removes it',
    'Бит': 'Beat',
    'Добавить ключевой кадр выбранному параметру или свойству слоя на текущей позиции курсора (K)': 'Add a keyframe to the selected parameter or layer property at the playhead (K)',
    '+ Ключ': '+ Key',
    'К следующей метке ( ] )': 'To next marker ( ] )',
    'Меток битов в проекте': 'Beat markers in project',
    'Убрать все метки (можно вернуть через Ctrl+Z)': 'Clear all markers (Ctrl+Z to undo)',
    'Уменьшить масштаб': 'Zoom out', 'Увеличить масштаб': 'Zoom in',
    'Вместить весь проект': 'Fit whole project', 'Вместить': 'Fit',
    'Откройте XML или перетащите медиафайлы': 'Open an XML or drag media files here',
    'Пробел': 'Space', 'пуск': 'play', 'разрезать': 'split', 'дублировать': 'duplicate', 'кадр': 'frame',
    'метка бита': 'beat marker', 'к метке': 'to marker', 'отмена': 'undo', 'Тянуть': 'Drag', 'тянуть': 'drag',
    'без магнита': 'no snap', 'эффекты': 'effects', 'Ctrl+колесо': 'Ctrl+wheel', 'масштаб': 'zoom',
    // ---- settings page ----
    'Тема оформления': 'Theme', 'Тёмная или светлая палитра редактора': 'Dark or light editor palette',
    'Тёмная (по умолчанию)': 'Dark (default)', 'Светлая': 'Light', 'Тёмная': 'Dark',
    'Язык интерфейса': 'Interface language', 'Английский или русский': 'English or Russian',
    'Зацикливание таймлайна': 'Timeline looping', 'Повторять воспроизведение с начала после конца проекта': 'Restart playback from the start after the project ends',
    'Сетка прозрачности под сценой': 'Transparency grid behind the stage', 'Показывать шахматку за прозрачными участками слоя': 'Show a checkerboard behind transparent areas',
    'Интервал автосохранения': 'Autosave interval', 'Автоматически сохранять открытый проект и медиафайлы': 'Automatically save the open project and media',
    'Каждые 30 сек': 'Every 30 sec', 'Раз в 1 минуту': 'Every 1 minute', 'Раз в 3 минуты': 'Every 3 minutes', 'Раз в 5 минут': 'Every 5 minutes', 'Выключено': 'Off',
    'Подсказки клавиш внизу': 'Shortcut hints at the bottom', 'Отображать строку быстрых сочетаний под таймлайном': 'Show the shortcut bar under the timeline',
    'Закрыть': 'Close', 'Назад': 'Back', 'Версия': 'Version', 'Внешний вид': 'Appearance', 'Воспроизведение': 'Playback', 'Сохранение': 'Saving', 'Общие': 'General',
    // ---- app.js ----
    'Видео': 'Video', 'Фото': 'Photo', 'Музыка': 'Music', 'Без названия': 'Untitled',
    'Сохранение…': 'Saving…', 'Сохранено в ': 'Saved at ', 'Ошибка сохранения': 'Save error',
    'Не удалось сохранить проект: ': 'Could not save project: ',
    'Автосохранение выкл': 'Autosave off', 'выкл': 'off', ' сек': ' sec', ' мин назад': ' min ago', ' ч назад': ' h ago', ' мин': ' min',
    'Проект загружен': 'Project loaded', 'Открыт проект: ': 'Project opened: ', 'Создан новый проект: ': 'New project created: ',
    'Открыт XML: ': 'XML opened: ', ' · слоёв ': ' · layers ', 'Ошибка: ': 'Error: ',
    'Файл не открывается: ': 'File cannot be opened: ', 'Фото не поддерживается: ': 'Photo not supported: ',
    'Загружаю: ': 'Loading: ', 'Добавлено файлов: ': 'Files added: ', 'Пока пусто': 'Nothing here yet',
    'Заменить': 'Replace', 'Выбрать файл': 'Choose file', 'Файл «': 'File «', '» заменён на ': '» replaced with ',
    ' во всех слоях, где он используется': ' in all layers that use it',
    ' · прокси 540p': ' · 540p proxy', ' · кодирую прокси…': ' · encoding proxy…',
    'файла нет — показывается шахматка': 'no file — checkerboard shown', 'слоёв: ': 'layers: ',
    'Метка бита: ': 'Beat marker: ', 'Метка убрана: ': 'Marker removed: ', 'Метка уже есть: ': 'Marker already exists: ',
    'Дальше меток нет': 'No more markers ahead', 'Раньше меток нет': 'No earlier markers', 'Убрано меток: ': 'Markers removed: ',
    ' (Ctrl+Z вернёт)': ' (Ctrl+Z restores)', 'Метка убрана': 'Marker removed',
    'У выбранного слоя нет эффектов для копирования': 'The selected layer has no effects to copy',
    'Скопировано эффектов: ': 'Effects copied: ', ' (Ctrl+Shift+V — вставить на выделенные слои)': ' (Ctrl+Shift+V — paste onto selected layers)',
    'Выберите слой (или несколько слоёв через Ctrl/Shift) для вставки эффектов': 'Select a layer (or several with Ctrl/Shift) to paste effects',
    'Вставлено эффектов (': 'Effects pasted (', ') на слоёв: ': ') onto layers: ',
    'У слоя нет подключённого видеофайла': 'The layer has no video file attached',
    'Аудио': 'Audio', 'Звук отделён в дорожку: ': 'Audio split into a track: ',
    'Поставьте курсор внутрь слоя, чтобы разрезать его': 'Place the playhead inside the layer to split it',
    'Слой разрезан на отметке ': 'Layer split at ', ' (копия)': ' (copy)', 'Слой продублирован': 'Layer duplicated',
    'Название слоя:': 'Layer name:', 'Слой выровнен по центру кадра': 'Layer centered in frame', 'Слой растянут на весь кадр': 'Layer stretched to full frame',
    'Нечего отменять': 'Nothing to undo', 'Отменено (шагов в истории: ': 'Undone (history steps: ', 'Нечего повторять': 'Nothing to redo', 'Повторено': 'Redone',
    'Выбор цвета пипеткой отменён': 'Eyedropper cancelled', 'Выделение области применено': 'Area selection applied',
    'Позиция': 'Position', 'Опора (Pivot)': 'Pivot', 'Масштаб': 'Scale', 'Поворот': 'Rotation', 'Размер': 'Size', 'Прозрачность': 'Opacity',
    ' · часть': ' · part', 'Часть вырезана в новый слой и привязана к «': 'Part cut into a new layer and parented to «',
    'Ключ удалён (': 'Key removed (', ') на ': ') at ', 'Ключ поставлен (': 'Key set (', ' с (осталось ключей: ': ' s (keys left: ',
    'Нет слоёв для добавления ключа': 'No layers to add a key to', 'У выбранного слоя нет параметров для анимации': 'The selected layer has no animatable parameters',
    'Ключ обновлён (': 'Key updated (', 'Ключ добавлен (': 'Key added (', ' с (всего: ': ' s (total: ',
    'Убрать ключ в текущей точке': 'Remove key at the current point', 'Добавить ещё один ключ в текущей точке': 'Add another key at the current point',
    'Начать анимацию: поставить первый ключ в текущей точке': 'Start animating: set the first key at the current point',
    'Открыть график ключей и кривых Безье': 'Open keyframe and Bézier curve graph',
    'Слой не выбран': 'No layer selected', 'Нажмите на слой в полосе внизу — здесь появятся его свойства, эффекты и файл.': 'Click a layer in the strip below — its properties, effects and file appear here.',
    'Время: ': 'Time: ', ' · старт с ': ' · starts at ', ' с файла': ' s into file',
    'Показать слой': 'Show layer', 'Скрыть слой': 'Hide layer', 'Разрезать слой по позиции курсора (S)': 'Split layer at playhead (S)', 'Разрезать': 'Split',
    'Создать копию слоя (Ctrl+D)': 'Duplicate layer (Ctrl+D)', 'Дублировать': 'Duplicate',
    'Вынести аудиодорожку на отдельный слой и отключить звук у видео': 'Move the audio to a separate layer and mute the video', 'Отделить звук': 'Detach audio',
    'Поставить слой точно в центр холста': 'Put the layer exactly at canvas center', 'По центру': 'Center',
    'Растянуть слой по размеру кадра': 'Stretch layer to the frame size', 'На весь кадр': 'Fill frame',
    'Удалить': 'Delete', 'Режим наложения': 'Blend mode', 'Обычный': 'Normal', 'Сложение': 'Add', 'Экран': 'Screen', 'Умножение': 'Multiply',
    'Как слой смешивается с тем, что под ним': 'How the layer blends with what is below it',
    'Звук слоя': 'Layer audio', 'Громкость': 'Volume',
    'Поставить / убрать ключ громкости в текущей точке (для затухания звука в конце)': 'Set / remove a volume key at the current point (for fading audio out)',
    'График затухания громкости': 'Volume fade graph', 'Выкл': 'Off', 'Вкл': 'On', 'Включить / выключить звук слоя': 'Toggle layer audio',
    'Параметры сейчас': 'Current values', 'Нет параметров': 'No parameters', 'Не поддержано пока: ': 'Not supported yet: ',
    'Только для визуальных слоёв': 'Visual layers only', 'Для аудиодорожки точка опоры и риггинг не применяются.': 'Pivot and rigging do not apply to audio tracks.',
    'Риггинг и иерархия (Parenting)': 'Rigging and hierarchy (Parenting)', 'Родитель:': 'Parent:', 'Нет (основной слой / торс)': 'None (main layer / torso)',
    'Слой привязан к родителю': 'Layer parented', 'Привязка к родителю снята': 'Parent link removed',
    'Перемещение': 'Move', 'Перетаскивание слоя и точки опоры на сцене': 'Drag the layer and pivot on stage',
    'Выделить часть': 'Select part', 'Выделить голову/руку/волосы рамкой прямо на сцене': 'Box-select a head/arm/hair right on stage',
    'Деформация (сетка)': 'Warp (mesh)', 'Сетка точек по всему объекту (от 3×3 до 8×8) — тяните любую точку или область': 'A point mesh over the whole object (3×3 to 8×8) — drag any point or area',
    'Протяните рамку на сцене, чтобы выделить часть объекта (Shift — квадрат)': 'Drag a box on stage to select part of the object (Shift — square)',
    'Сетка деформации активна: тяните любую точку или ячейку (Ctrl — выбор точек, Alt — симметрия)': 'Warp mesh active: drag any point or cell (Ctrl — pick points, Alt — symmetry)',
    'Режим перемещения (розовую опору можно тянуть прямо на сцене)': 'Move mode (the pink pivot can be dragged on stage)',
    'Сетка (': 'Mesh (', ' т.)': ' pts)', 'Сетка деформации: ': 'Warp mesh: ', ' точек)': ' points)',
    'Кривизна:': 'Curvature:', 'Плавная кривая': 'Smooth curve', 'Точная сетка': 'Exact mesh', 'Мягкий захват соседей': 'Soft neighbor falloff',
    'По контуру объекта': 'Follow outline', 'Разместить сетку точек по силуэту объекта на текущем кадре': 'Place the mesh points along the object silhouette on the current frame',
    'Точки сетки расставлены по контуру объекта': 'Mesh points placed along the object outline',
    'Весь кадр': 'Whole frame', 'Расставить сетку равномерно по всему прямоугольнику слоя': 'Spread the mesh evenly over the layer rectangle',
    'Сетка выровнена по всему слою': 'Mesh aligned to the whole layer', 'Сбросить': 'Reset', 'Деформация сброшена': 'Warp reset',
    'Деформация · ': 'Warp · ', ': растяг ': ': stretch ', ' (Shift — ось, Alt — симметрия)': ' (Shift — axis, Alt — symmetry)',
    'Точка опоры (сустав) и нарезка': 'Pivot point (joint) and slicing', 'Клик — поставить опору; протяните рамку (Shift — квадрат) — выделить часть объекта': 'Click — set pivot; drag a box (Shift — square) — select part of the object',
    'Выделена область — можно вырезать её в отдельный дочерний слой': 'Area selected — you can cut it into a separate child layer', 'Область: ': 'Area: ',
    'Выделите часть (голову/руку) рамкой выше или на сцене': 'Select a part (head/arm) with the box above or on stage',
    'Вырезать в новый слой': 'Cut to new layer', 'Создаст отдельный слой для этой части с опорой в суставе и привяжет к текущему слою': 'Creates a separate layer for this part with the pivot at the joint and parents it to the current layer',
    'Выделение области сброшено': 'Area selection reset',
    'Опора X (−1 лево … +1 право)': 'Pivot X (−1 left … +1 right)', 'Опора Y (−1 верх … +1 низ)': 'Pivot Y (−1 top … +1 bottom)',
    'Сбросить в центр (0, 0)': 'Reset to center (0, 0)', 'Поворот объекта': 'Object rotation', 'Угол (°) · на сцене тяните за угол': 'Angle (°) · drag a corner on stage',
    'Графики и кривые Безье (Curves)': 'Graphs and Bézier curves (Curves)', 'Сейчас в слое': 'Currently in layer', '✓ файл подключён': '✓ file attached',
    'Заменить файл в этом слое…': 'Replace file in this layer…', 'В слое «': 'In layer «', '» теперь ': '» is now ',
    'Замена действует только на этот слой. Чтобы заменить файл сразу во всех слоях — «Заменить» в списке файлов слева.': 'Replacement affects this layer only. To replace the file in all layers use “Replace” in the file list on the left.',
    'Или взять из файлов проекта': 'Or pick from project files', '(нет файла) ': '(no file) ',
    'Поворот (°)': 'Rotation (°)', 'Позиция Y (вверх-вниз)': 'Position Y (up-down)', 'Позиция X (влево-вправо)': 'Position X (left-right)',
    'Масштаб X': 'Scale X', 'Масштаб Y': 'Scale Y', 'Прозрачность (затемнение)': 'Opacity (fade)',
    'Поставить ключевой кадр в текущей позиции курсора': 'Set a keyframe at the playhead', 'Ключ #': 'Key #',
    'Линейно': 'Linear', 'Плавно (Ease In-Out)': 'Smooth (Ease In-Out)', 'Резкий вылет (Whip)': 'Sharp whip (Whip)', 'Перелёт (Overshoot)': 'Overshoot', 'Отскок (Rebound)': 'Rebound',
    'Удалить этот ключ': 'Delete this key', 'Двойной клик по графику или «+ Ключ» создаст кривую анимации': 'Double-click the graph or “+ Key” to create an animation curve',
    ' · Enter — применить': ' · Enter — apply', ' с · кадр ': ' s · frame ',
    'Область выделена ровно! Нажмите «Сбросить» во вкладке «Опора», чтобы вернуть целиком': 'Area selected! Press “Reset” in the Pivot tab to restore the whole object',
    'Точка (': 'Point (', 'Ячейка (': 'Cell (',
    'только что': 'just now', 'Открыт': 'Opened', ' · слоёв: ': ' · layers: ', ' · медиа: ': ' · media: ', 'Обновлён ': 'Updated ',
    'Переименовать': 'Rename', 'Новое название проекта:': 'New project name:', 'Дублировать проект': 'Duplicate project', 'Удалить проект': 'Delete project', 'Удалить проект «': 'Delete project «',
    'Все': 'All', 'Обычные': 'Regular', 'XML-проекты': 'XML projects', 'XML-проектов пока нет': 'No XML projects yet', 'Ничего не найдено': 'Nothing found',
    'Обычные проекты': 'Regular projects', 'XML-проекты (Alight Motion)': 'XML projects (Alight Motion)', 'Ошибка чтения XML: ': 'XML read error: ', 'Название проекта:': 'Project name:',
    'Цвет выбран: ': 'Color picked: ', 'Пипетка: кликните по нужному цвету на сцене (Esc — отмена)': 'Eyedropper: click a color on stage (Esc — cancel)',
    'Пресет «': 'Preset «', '» (': '» (', ' эф.) скопирован в буфер — нажмите Ctrl+Shift+V на нужном слое': ' fx) copied — press Ctrl+Shift+V on a layer',
    'Сначала выберите слой для применения пресета': 'Select a layer to apply the preset to first', 'Выберите видео или фото слой для применения эффектов': 'Select a video or photo layer to apply effects',
    '» применён на слоёв: ': '» applied to layers: ',
    'общий звук выключен (кнопка M / громкость 0)': 'master audio is muted (M / volume 0)', 'в проекте нет слоёв со звуком (или они скрыты / без звука)': 'no layers with audio in the project (hidden or muted)',
    'не удалось прочитать звук из «': 'could not read audio from «', 'не удалось декодировать звук': 'could not decode audio', 'Сначала откройте или создайте проект': 'Open or create a project first',
    'Экспорт видео': 'Export video', 'Экспорт': 'Export', 'Разрешение': 'Resolution', 'Частота кадров': 'Frame rate', 'Как в проекте': 'Same as project',
    'Качество (битрейт)': 'Quality (bitrate)', 'Высокое (16 Мбит/с)': 'High (16 Mbps)', 'Стандартное (8 Мбит/с)': 'Standard (8 Mbps)', 'Компактное (4 Мбит/с)': 'Compact (4 Mbps)',
    'Формат': 'Format', 'Звуковая дорожка': 'Audio track', 'Свести аудиослои и звук из видео с учётом громкости': 'Mix audio layers and video sound with volumes',
    'Подготовка…': 'Preparing…', 'Начать экспорт': 'Start export', 'Нечего экспортировать: добавьте хотя бы один слой на таймлайн.': 'Nothing to export: add at least one layer to the timeline.',
    'Рендерер WebGPU не инициализирован.': 'WebGPU renderer is not initialized.', 'Среда не поддерживает кодирование видео.': 'This environment does not support video encoding.',
    'Отменить': 'Cancel', 'Подготовка видео и звука…': 'Preparing video and audio…', 'ошибка микширования: ': 'mixing error: ', 'Экспорт отменён': 'Export cancelled',
    'Кодирование кадра ': 'Encoding frame ', ' из ': ' of ', 'Видеопоток не сформирован кодеком H.264': 'H.264 codec produced no video stream',
    'Кодирование звуковой дорожки…': 'Encoding audio track…', 'кодек AAC не поддерживается в этой среде': 'AAC codec is not supported here', 'ошибка кодирования AAC: ': 'AAC encoding error: ',
    'Сборка MP4-файла…': 'Building MP4 file…', 'Запись кадра ': 'Writing frame ', 'Готово!': 'Done!', ' ⚠ Звука в файле НЕТ: ': ' ⚠ File has NO audio: ', 'причина неизвестна': 'unknown reason',
    ' Звук отключён в настройках экспорта.': ' Audio was disabled in export settings.', ' Звук включён.': ' Audio included.', 'Файл «': 'File «', ' МБ) сохранён.': ' MB) saved.',
    'Скачать ещё раз': 'Download again', 'Экспорт завершён: ': 'Export finished: ', 'Экспорт отменён.': 'Export cancelled.', 'Ошибка экспорта: ': 'Export error: ',
    'Оригинал проекта (': 'Project original (', '✦ Мои пресеты': '✦ My presets', 'Ваши сохранённые шейки, переходы и наборы эффектов': 'Your saved shakes, transitions and effect sets',
    'Экспортировать проект в видеофайл': 'Export the project to a video file', 'Ступенчатый предпросмотр: ': 'Stepped preview: ', 'Плавный предпросмотр': 'Smooth preview',
    'Частота кадров проекта: ': 'Project frame rate: ', 'WebGPU готов. Откройте XML или добавьте файлы.': 'WebGPU ready. Open an XML or add files.', 'Ошибка WebGPU: ': 'WebGPU error: ',
    // ---- parse / renderer / timeline ----
    'Файл не похож на корректный XML': 'The file does not look like valid XML', 'Корневой тег <': 'Root tag <', '>, ожидался <scene>': '>, expected <scene>',
    'WebGPU недоступен в этом окне': 'WebGPU is unavailable in this window', 'Не найден видеоадаптер для WebGPU': 'No video adapter found for WebGPU',
    'Метка бита ': 'Beat marker ', ' — клик: перейти, Alt+клик или ПКМ: убрать': ' — click: jump, Alt+click or right-click: remove',
    'Показать / скрыть слой': 'Show / hide layer', 'Двойной клик — переименовать, потяните вверх/вниз — изменить порядок': 'Double-click to rename, drag up/down to reorder',
    'Тяните клип для сдвига (Alt — без привязки), края — для обрезки': 'Drag the clip to move (Alt — no snap), edges — to trim',
    // ---- graph ----
    'Плавный старт (Ease In)': 'Smooth start (Ease In)', 'Плавный финиш (Ease Out)': 'Smooth finish (Ease Out)', 'Резкий удар (Snap)': 'Sharp hit (Snap)', 'Пружина (Overshoot)': 'Spring (Overshoot)',
    'Отскок (Bounce Back)': 'Bounce Back', 'Вылет и торможение': 'Burst and brake', 'Значение': 'Value', 'Скорость': 'Speed', 'Ключ ': 'Key ',
    '+ ключ здесь': '+ key here', 'Добавить ключ в текущей точке времени': 'Add a key at the current time', 'Удалить ключ': 'Delete key', 'время': 'time', 'значение': 'value',
    'Начальный ключ: выберите следующий ключ (2..N), чтобы настроить кривую прихода к нему.': 'First key: pick the next key (2..N) to tune the curve leading to it.',
    'Кривая к этому ключу': 'Curve to this key', 'Своя': 'Custom',
    // ---- fxui ----
    'в предпросмотре приблизительно': 'approximate in preview', 'в предпросмотре пока не применяется': 'not applied in preview yet',
    'Шейки': 'Shakes', 'Переходы': 'Transitions', 'Цвет и свет': 'Color and light', 'Другое': 'Other', 'Шейк': 'Shake', 'Переход': 'Transition', 'Цвет': 'Color', 'Пресет': 'Preset', 'Мой': 'Mine',
    'Эффектов: ': 'Effects: ', 'В этой категории пока пусто': 'This category is empty', 'Ваших пресетов и шейков пока нет': 'No presets or shakes of yours yet',
    'Выберите «Все» или сохраните новый пресет в эту категорию.': 'Choose “All” or save a new preset into this category.',
    'Настройте шейк или эффекты на слое и нажмите «+ В пресеты» во вкладке «Эффекты» — всё сохранится сюда.': 'Set up a shake or effects on a layer and press “+ To presets” in the Effects tab — it will be saved here.',
    'Удалить сохранённый пресет': 'Delete saved preset', 'Удалить пресет «': 'Delete preset «', 'В буфер': 'To clipboard',
    'Скопировать набор эффектов в буфер (затем Ctrl+Shift+V на любом слое)': 'Copy the effect set to the clipboard (then Ctrl+Shift+V on any layer)', '✓ Скопировано': '✓ Copied',
    'Применить': 'Apply', 'Сразу добавить эти эффекты на выбранный слой': 'Add these effects to the selected layer right away',
    'Мои пресеты и шейки': 'My presets and shakes', 'Закрыть (Esc)': 'Close (Esc)', 'Поиск по моим пресетам и эффектам…': 'Search my presets and effects…',
    '+ Сохранить со слоя': '+ Save from layer', 'Сохранить эффекты текущего выбранного слоя в каталог': 'Save the selected layer’s effects to the catalog',
    'Название (например: Мой панч-шейк)': 'Name (e.g. My punch shake)', 'Отмена': 'Cancel', 'Сначала выберите слой с эффектами, чтобы сохранить его как пресет.': 'Select a layer with effects first to save it as a preset.',
    ' · шейк': ' · shake', ' · из слоя «': ' · from layer «', 'Цвет ключа (R)': 'Key color (R)', 'Цвет ключа (G)': 'Key color (G)', 'Цвет ключа (B)': 'Key color (B)', 'Цвет ключа': 'Key color',
    'Выберите цвет фона через палитру, пипетку или пресеты': 'Pick a background color via palette, eyedropper or presets',
    'Убрать ключ цвета в текущей точке (Shift+клик — удалить всю анимацию)': 'Remove color key at the current point (Shift+click — delete all animation)', 'Поставить ключ цвета в текущей точке': 'Set a color key at the current point',
    'Сбросить на зелёный экран (#00ff00)': 'Reset to green screen (#00ff00)', 'Выбрать ключевой цвет из палитры': 'Pick the key color from the palette',
    'Пипетка: взять точный цвет со сцены': 'Eyedropper: sample an exact color from the stage', 'Зелёный экран': 'Green screen', 'Синий экран': 'Blue screen', 'Чёрный фон': 'Black background', 'Белый фон': 'White background',
    'Убрать ключ в текущей точке (Shift+клик — удалить всю анимацию)': 'Remove key at the current point (Shift+click — delete all animation)', 'Поставить ключ в текущей точке': 'Set a key at the current point',
    'График: ключи и кривая значения': 'Graph: keys and value curve', 'Сбросить к значению по умолчанию': 'Reset to default', '✦ Магазин пресетов': '✦ Preset store',
    'Готовые шейки, переходы и цветокор — копировать или применить в один клик': 'Ready-made shakes, transitions and color grades — copy or apply in one click',
    '+ В пресеты': '+ To presets', 'Сохранить эффекты этого слоя в свой каталог пресетов': 'Save this layer’s effects to your preset catalog', 'Копировать': 'Copy',
    'Скопировать все эффекты слоя со всеми ключами (Ctrl+Shift+C)': 'Copy all layer effects with all keys (Ctrl+Shift+C)', 'Вставить (': 'Paste (', ' сл.': ' lyr', 'Вставить': 'Paste',
    'Вставить скопированные эффекты на выбранные слои (Ctrl+Shift+V)': 'Paste copied effects onto the selected layers (Ctrl+Shift+V)', 'Эффекты слоя': 'Layer effects',
    'Свернуть все': 'Collapse all', 'Развернуть все': 'Expand all', 'Движение': 'Motion', 'Искажение': 'Distortion', 'Размытие': 'Blur', 'Стилизация': 'Stylize',
    'Поиск эффекта (shake, wave, blur, tile…)': 'Search effects (shake, wave, blur, tile…)', ') — нажать, чтобы добавить': ') — click to add',
    'У слоя пока нет эффектов. Добавьте выше или вставьте скопированные.': 'This layer has no effects yet. Add some above or paste copied ones.',
    '◆ — анимация ключами, ∿ — график ключей и кривых. Изменение анимированного параметра ставит ключ в текущей точке.': '◆ — keyframe animation, ∿ — key and curve graph. Changing an animated parameter sets a key at the current point.',
    'Анимированных параметров: ': 'Animated parameters: ', 'Включить эффект': 'Enable effect', 'Выключить эффект': 'Disable effect', 'Выше (применяется раньше)': 'Up (applied earlier)', 'Ниже (применяется позже)': 'Down (applied later)', 'Удалить эффект': 'Delete effect',
    'Имя эффекта в XML Alight предположительное: при импорте проекта он может не распознаться.': 'The Alight XML name of this effect is a guess: it may not be recognized on import.',
    'Эффект ': 'Effect ', 'Неизвестный эффект: параметры показаны как есть, в предпросмотре не применяется.': 'Unknown effect: parameters shown as is, not applied in preview.',
    // ---- effects.js ----
    'Колебание': 'Oscillation', 'Направление (служебное)': 'Direction (internal)', 'Угол': 'Angle', 'Направление качания, по часовой. 0° — по горизонтали, 90° — по вертикали': 'Swing direction, clockwise. 0° — horizontal, 90° — vertical',
    'Частота, Гц': 'Frequency, Hz', 'Циклов в секунду. Считается накопительно, поэтому анимацией частоты можно разгонять и тормозить колебание': 'Cycles per second. Accumulated, so animating frequency speeds up or slows the oscillation',
    'Амплитуда, px': 'Amplitude, px', 'Максимальное смещение слоя от исходной позиции': 'Maximum layer offset from its original position', 'Волна': 'Wave', 'Синус': 'Sine', 'Треугольник': 'Triangle',
    'Синус плавнее у разворота, треугольник — с постоянной скоростью': 'Sine is smoother at turnarounds, triangle has constant speed', 'Фаза': 'Phase', 'Сдвиг начала цикла. При частоте 0 можно анимировать вручную': 'Cycle start offset. At frequency 0 you can animate it manually',
    'Плитка': 'Tile', 'Обрезка (crop)': 'Crop', 'Обрезка краёв тайла (>1 обрезает внутрь, <1 добавляет зазор)': 'Tile edge crop (>1 crops inward, <1 adds a gap)', 'Сдвиг рядов': 'Row offset', 'Сдвигает каждый второй ряд; 0.5 — на пол-плитки': 'Shifts every second row; 0.5 — half a tile',
    'Зеркало': 'Mirror', 'Каждая вторая плитка отражается — края слоя не рвутся': 'Every second tile is mirrored — layer edges do not tear', 'Сдвиг по вертикали': 'Vertical offset', 'Сдвиг действует на колонки, а не на ряды': 'Offset applies to columns, not rows',
    'Угол плитки': 'Tile angle', 'Поворот сетки плиток в градусах': 'Tile grid rotation in degrees', 'Фрактальное искажение': 'Fractal noise', 'Сила': 'Strength', 'Амплитуда смещения пикселей (как в Alight Motion)': 'Pixel displacement amplitude (as in Alight Motion)',
    'Масштаб узора': 'Pattern scale', 'Интенсивность': 'Intensity', 'Затухание амплитуды по октавам (persistence)': 'Amplitude falloff per octave (persistence)', 'В координатах экрана': 'In screen coordinates', 'Привязать шум к экрану, а не к координатам слоя': 'Lock noise to the screen instead of layer coordinates',
    'Октавы': 'Octaves', 'Число слоёв шума': 'Number of noise layers', 'Размытие движения': 'Motion blur', 'Настройка': 'Setting', 'Множитель выдержки размытия движения': 'Motion blur shutter multiplier',
    'Учитывать позицию': 'Use position', 'Учитывать масштаб': 'Use scale', 'Учитывать угол': 'Use angle', 'Размытие по Гауссу+': 'Gaussian blur+', 'Размытие по Гауссу': 'Gaussian blur', 'Сила размытия в единицах Alight Motion': 'Blur strength in Alight Motion units',
    'RGB-разделение': 'RGB split', 'Сдвиг каналов в единицах Alight Motion': 'Channel shift in Alight Motion units', 'Неподвижный канал': 'Fixed channel', 'Красный (R)': 'Red (R)', 'Зелёный (G)': 'Green (G)', 'Синий (B)': 'Blue (B)',
    'Красный канал ключевого цвета': 'Key color red channel', 'Зелёный канал ключевого цвета': 'Key color green channel', 'Синий канал ключевого цвета': 'Key color blue channel',
    'Красный': 'Red', 'Зелёный': 'Green', 'Синий': 'Blue', 'Режим': 'Mode', 'Обычный (Normal)': 'Normal', 'Экран (Screen)': 'Screen', 'Сдвиг каналов': 'Channel shift', 'Режим смешивания каналов Alight Motion': 'Alight Motion channel blend mode',
    'Случайное смещение': 'Random offset', 'Максимальное случайное смещение слоя': 'Maximum random layer offset', 'Эволюция': 'Evolution', 'Изменение случайного положения во времени': 'Change of the random position over time',
    'Зерно (Seed)': 'Seed', 'Разброс (Scatter)': 'Scatter', 'Резкость перескоков между точками': 'Sharpness of jumps between points', 'Тряска': 'Shake', 'Плавность (Slack)': 'Smoothness (Slack)',
    'Z-тряска (масштаб)': 'Z-shake (scale)', 'Дрожание': 'Jitter', 'Плавность': 'Smoothness', 'Z-дрожание': 'Z-jitter', 'Покачивание': 'Sway', 'Угол 1': 'Angle 1', 'Угол 2': 'Angle 2',
    'Волновое искажение': 'Wave warp', 'Сдвиг фазы волны (1.0 = полный цикл)': 'Wave phase shift (1.0 = full cycle)', 'Направление волны': 'Wave direction', 'Угол распространения волны в градусах': 'Wave propagation angle in degrees',
    'Интервал (Spacing)': 'Spacing', 'Длина волны в единицах Alight Motion': 'Wavelength in Alight Motion units', 'Амплитуда (Magnitude)': 'Magnitude', 'Размах волны в единицах Alight Motion': 'Wave amplitude in Alight Motion units',
    'Угол сдвига (Warp Angle)': 'Warp angle', 'Направление смещения пикселей (90° — поперёк волны)': 'Pixel displacement direction (90° — across the wave)', 'Затухание (Damping)': 'Damping', 'Область затухания': 'Damping area', 'Центр затухания': 'Damping center',
    'Помощник масштаба': 'Scale helper', 'Равномерный масштаб вокруг точки опоры (Pivot)': 'Uniform scale around the pivot', 'Сжатие / Растяжение': 'Squash / Stretch', 'Сохраняет объём: при >0 вытягивает по Y и сжимает по X': 'Preserves volume: when >0 stretches Y and squeezes X',
    'Ось сжатия': 'Squash axis', 'Круговая рябь': 'Circular ripple', 'Частота': 'Frequency', 'Радиус': 'Radius', 'Мягкость краёв': 'Edge softness', 'Сжатие / Выпуклость': 'Pinch / Bulge', 'Отрицательное — сжатие внутрь, положительное — выпуклость': 'Negative — pinch inward, positive — bulge',
    'Оптическая компенсация': 'Optical compensation', 'Хроматический сдвиг': 'Chromatic shift', 'Преобразование 2': 'Transform 2', 'Преобразование': 'Transform', 'Заполнение': 'Fill', 'Обрезать по слою': 'Clip to layer',
    'Сдвиг X, px': 'Shift X, px', 'Сдвиг Y, px': 'Shift Y, px', 'Зум (Z)': 'Zoom (Z)', 'Инверсия X': 'Invert X', 'Инверсия Y': 'Invert Y', 'Инверсия Z': 'Invert Z', 'Инверсия угла': 'Invert angle',
    'Экспозиция / Гамма': 'Exposure / Gamma', 'Экспозиция': 'Exposure', 'Гамма': 'Gamma', 'Сдвиг (Offset)': 'Offset', 'Света и тени': 'Highlights and shadows', 'Света': 'Highlights', 'Тени': 'Shadows',
    'Размытие объектива': 'Lens blur', 'Радиус боке': 'Bokeh radius', 'Лучи': 'Rays', 'Порог яркости': 'Brightness threshold', 'Смешивание': 'Blending', 'Исчезновение шумом': 'Noise dissolve', 'Прогресс': 'Progress', 'Масштаб шума': 'Noise scale', 'Жёсткость': 'Hardness',
    'Затухание (Fade)': 'Fade', 'Появление, с': 'Fade in, s', 'Исчезновение, с': 'Fade out, s', 'Пульсация размера': 'Size pulse', 'Ударов в секунду': 'Beats per second', 'Увеличение': 'Enlarge', 'Максимальный множитель масштаба': 'Maximum scale multiplier',
    'Сжатие': 'Shrink', 'Минимальный множитель масштаба': 'Minimum scale multiplier', 'Отражение (Flip)': 'Flip', 'По горизонтали (X)': 'Horizontal (X)', 'По вертикали (Y)': 'Vertical (Y)', 'Оттенок и насыщенность': 'Hue and saturation',
    'Сдвиг оттенка, °': 'Hue shift, °', 'Насыщенность': 'Saturation', 'Яркость': 'Brightness', 'Виньетка': 'Vignette', 'Округлость': 'Roundness', 'Мягкость': 'Softness', 'Затемнение': 'Darkening', 'Инверсия': 'Invert',
    'Доля инвертированного цвета: 1 — полный негатив': 'Inverted color amount: 1 — full negative', 'Яркость / Контраст': 'Brightness / Contrast', 'Контраст': 'Contrast', '1 — без изменений': '1 — unchanged',
    'Цветовая температура': 'Color temperature', 'Температура': 'Temperature', 'Отрицательная — холоднее (синий), положительная — теплее (оранжевый)': 'Negative — cooler (blue), positive — warmer (orange)', 'Оттенок (зелёный ↔ пурпур)': 'Tint (green ↔ magenta)',
    'Направленное размытие': 'Directional blur', '0° — по горизонтали, 90° — по вертикали': '0° — horizontal, 90° — vertical', 'Размытие зумом': 'Zoom blur', 'Центр X, px': 'Center X, px', 'Центр Y, px': 'Center Y, px', 'Смещение центра зума от центра слоя': 'Zoom center offset from layer center',
    'Размытие вращением': 'Spin blur', 'Угол, °': 'Angle, °', 'Полный размах размытия в градусах': 'Full blur sweep in degrees', 'Пикселизация': 'Pixelate', 'Размер блока, px': 'Block size, px', 'Постеризация': 'Posterize', 'Уровней на канал': 'Levels per channel',
    'Порог': 'Threshold', 'Уровень яркости': 'Brightness level', 'Ярче порога — белое, темнее — чёрное': 'Brighter than threshold — white, darker — black', 'Насыщенность / Красочность': 'Saturation / Vibrance', '0 — чёрно-белое, 1 — без изменений': '0 — black and white, 1 — unchanged',
    'Красочность': 'Vibrance', 'Усиливает в первую очередь блёклые цвета': 'Boosts dull colors first', 'Пульсация прозрачности': 'Opacity pulse', 'Минимум': 'Minimum', 'Наименьшая непрозрачность слоя': 'Lowest layer opacity', 'Мерцание': 'Flicker', 'Насколько сильно слой гаснет на мерцающих кадрах': 'How much the layer dims on flicker frames',
    'Авто-тряска (AM)': 'Auto shake (AM)', 'Сила смещения по осям': 'Axis offset strength', 'Скорость колебаний шума Перлина': 'Perlin noise oscillation speed', 'Фазовый сдвиг траектории': 'Path phase shift', 'Основная ось тряски': 'Main shake axis', 'Соотношение поперечной и продольной амплитуды': 'Ratio of cross to along-axis amplitude',
    'Z-тряска (зум)': 'Z-shake (zoom)', 'Пульсация масштаба в такт тряске': 'Scale pulse in time with the shake', 'Турбулентное смещение': 'Turbulent displace', 'Сила (Amount)': 'Amount', 'Амплитуда смещения по шуму': 'Noise displacement amplitude', 'Размер (Scale)': 'Scale', 'Масштаб ячеек турбулентности': 'Turbulence cell scale',
    'Анимация течения турбулентности': 'Turbulence flow animation', 'Сложность (Octaves)': 'Complexity (Octaves)', 'Количество октав фрактального шума': 'Number of fractal noise octaves', 'Вихрь (Swirl)': 'Swirl', 'Угол закручивания': 'Twist angle', 'Сила закручивания вокруг центра': 'Twist strength around the center', 'Зона действия вихря': 'Swirl area',
    'Свечение (Glow)': 'Glow', 'Радиус рассеивания света': 'Light spread radius', 'Яркость свечения': 'Glow brightness', 'Какие светлые участки начинают светиться': 'Which bright areas start to glow', 'Хромакей (Chroma Key)': 'Chroma Key',
    'Допуск': 'Tolerance', 'Насколько близкие к ключу цвета вырезать': 'How close to the key a color must be to be removed', 'Мягкость края': 'Edge softness', 'Плавность перехода прозрачности': 'Smoothness of the transparency transition', 'Подавление цвета (Spill)': 'Spill suppression', 'Убирает цветной рефлекс ключа с краёв объекта': 'Removes key-color spill from object edges',
    'Амплитуда': 'Amplitude', 'Направление': 'Direction', 'Размер (': 'Size (',
    // short generic units
    '': ''
  };
  // 'с' alone is risky: only translate it as a standalone unit token (handled below), drop from fragment list
  delete D[''];
  const keys = Object.keys(D).sort((a, b) => b.length - a.length);
  const CYR = /[А-Яа-яЁё]/;
  const STR = { en: D, ru: null };
  let lang = 'en';
  try { const s = localStorage.getItem('vm_lang'); if (s === 'ru' || s === 'en') lang = s; } catch (_) {}

  function tr(s) {
    if (lang !== 'en' || typeof s !== 'string' || !CYR.test(s)) return s;
    let out = s;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (out.indexOf(k) !== -1) out = out.split(k).join(D[k]);
    }
    return out.replace(/(\d) с(?![А-Яа-яЁё])/g, '$1 s');
  }

  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  const origText = new WeakMap();   // text node -> original RU
  const origAttr = new WeakMap();   // element -> {attr: RU}
  let busy = false;

  function doText(n) {
    let o = origText.get(n);
    const cur = n.nodeValue;
    if (o !== undefined) {
      // node content changed by app code? (not equal to last translation) -> treat as new source
      if (cur !== o && cur !== n.__vmLast) { o = cur; origText.set(n, o); }
    } else if (CYR.test(cur)) { o = cur; origText.set(n, o); }
    else return;
    const v = lang === 'en' ? tr(o) : o;
    n.__vmLast = v;
    if (n.nodeValue !== v) n.nodeValue = v;
  }
  function doEl(e) {
    if (e.nodeType !== 1) return;
    for (const a of ATTRS) {
      if (!e.hasAttribute(a)) continue;
      let m = origAttr.get(e); if (!m) { m = {}; origAttr.set(e, m); }
      const cur = e.getAttribute(a);
      if (m[a] === undefined || (cur !== m[a] && cur !== (m['_' + a]))) { if (CYR.test(cur)) m[a] = cur; else if (m[a] === undefined) continue; }
      const v = lang === 'en' ? tr(m[a]) : m[a];
      m['_' + a] = v;
      if (cur !== v) e.setAttribute(a, v);
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    const tag = root.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE') return;
    doEl(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) { if (n.parentNode && n.parentNode.tagName !== 'SCRIPT' && n.parentNode.tagName !== 'STYLE') doText(n); }
      else doEl(n);
    }
  }

  let obs = null;
  function start() {
    if (obs) return;
    obs = new MutationObserver((muts) => {
      if (busy) return;
      busy = true;
      try {
        for (const m of muts) {
          if (m.type === 'childList') m.addedNodes.forEach(walk);
          else if (m.type === 'characterData') doText(m.target);
          else if (m.type === 'attributes') doEl(m.target);
        }
      } finally { busy = false; }
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function apply() {
    busy = true;
    try { document.documentElement.lang = lang; document.title = 'vibemotion'; walk(document.body); } finally { busy = false; }
  }
  function setLang(l) {
    if (l !== 'en' && l !== 'ru') return;
    lang = l;
    try { localStorage.setItem('vm_lang', l); } catch (_) {}
    apply();
    window.dispatchEvent(new CustomEvent('vm-lang', { detail: l }));
  }

  // dialogs
  const _alert = window.alert.bind(window), _confirm = window.confirm.bind(window), _prompt = window.prompt.bind(window);
  window.alert = (m) => _alert(tr(String(m)));
  window.confirm = (m) => _confirm(tr(String(m)));
  window.prompt = (m, d) => _prompt(tr(String(m)), d);

  // Electron has no window.prompt(): in-app input dialog (Promise<string|null>)
  function ask(msg, def) {
    return new Promise((resolve) => {
      const bk = document.createElement('div'); bk.className = 'ask-backdrop';
      const box = document.createElement('div'); box.className = 'ask-box';
      const lb = document.createElement('div'); lb.className = 'ask-label'; lb.textContent = msg;
      const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'ask-input'; inp.value = def == null ? '' : String(def);
      const row = document.createElement('div'); row.className = 'ask-row';
      const no = document.createElement('button'); no.className = 'btn'; no.textContent = 'Отмена';
      const ok = document.createElement('button'); ok.className = 'btn primary'; ok.textContent = 'Сохранить';
      row.append(no, ok); box.append(lb, inp, row); bk.append(box); document.body.append(bk);
      const done = (v) => { bk.remove(); resolve(v); };
      ok.onclick = () => done(inp.value);
      no.onclick = () => done(null);
      bk.addEventListener('mousedown', (e) => { if (e.target === bk) done(null); });
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') done(inp.value); else if (e.key === 'Escape') done(null); });
      inp.addEventListener('keyup', (e) => e.stopPropagation());
      setTimeout(() => { inp.focus(); inp.select(); }, 0);
    });
  }

  window.VM_VERSION = '0.01.1';
  window.vmI18n = { ask, tr, setLang, getLang: () => lang, apply };
  window.addEventListener('DOMContentLoaded', () => { apply(); start(); });
})();
