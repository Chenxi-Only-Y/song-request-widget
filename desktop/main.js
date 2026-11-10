const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut,
  Tray,
  Menu,
  nativeImage
} = require('electron');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const TRAY_ICON_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB0klEQVR4nO2b4W0DIQyFzRNLdIxO0R06QyfoAJ2gM3SHTtExOkar/IiEEMcZMGCf80n5E5HD72EsnwJED3wTVk72+/3+xxn39PKxLK6gQfBOQ4JW0avMCFaEzzIirBT+/PrJGvfz9bbMiDBTPFfwqCEjJoQZ4qWEtxjRa0KwIHymEUFC/CrhXCNaTIBV8bW5WwozrIqXMgHSE+9gJBacDSg5qUl8LSZOFuAK4kdMwFXE95qAkQdrpSVWaHixWcGRJqxe/Vvzcv/MhBszVq5+Lnq2CRxt0Lb3JTOEEztIETsyBLUUsVT5j8g15Bqj9ITpqlkwEFcqcj1EMoZ0hsHS/u/NsFodADkH5ByQc0DOATkH5ByQc0DOATkHR38nWejjueRaUq0gQ+QtrUS7HskY0u8o0L5Cs4n53kjflG57p1WENtG1/a+uBuzIoHg2oCcLRpD+D+IM7DyluZqSNnB+KNUTrExxbsyx9GVeDCXZVSSPMhvcB1jqDFtiRYtjFkwoxVira6g9zJoJreJZW8CKCT3ihxohTSaMxALOoCMnNZgweloU3Ik0miBxVDa0Tur6sHSK2+PyKa4vTNxxfWUmxe2lqRy31+ZKuLw4ae3q7ANyzj/LKR+1GdxuvAAAAABJRU5ErkJggg==';

const SAMPLE_SONGS = [
  '晴天 - 周杰伦',
  '后来 - 刘若英',
  '如愿 - 王菲',
  '童话 - 光良',
  '稻香 - 周杰伦',
  '青花 - 周传雄',
  '句号 - 邓紫棋',
  '黄昏 - 周传雄',
  '幻听 - 许嵩',
  '月光 - 胡彦斌',
  '遇见 - 孙燕姿',
  '偏爱 - 张芸京',
  '如果可以 - 韦礼安',
  '慢冷 - 梁静茹',
  '爱情转移 - 陈奕迅',
  '想你的夜 - 关喆'
].join('\n');

const SAMPLE_BUTTONS = [
  { label: '送歌', icon: '' },
  { label: '学歌', icon: '' },
  { label: '录歌', icon: '' },
  { label: '卡卡冠歌', icon: '' },
  { label: '非粉丝牌点歌', icon: '' },
  { label: '粉丝牌点歌', icon: '' },
  { label: '续火', icon: '' },
  { label: '接下班', icon: '' }
];

const DEFAULT_STATE = {
  songsText: SAMPLE_SONGS,
  stationTitle: '晚风电台',
  eyebrow: 'YJ · NIGHT RADIO',
  subtitle: '治愈音乐台 · 每晚 21:30',
  tagsText: '治愈系, 深夜陪伴, 点歌台',
  buttons: SAMPLE_BUTTONS.map((button) => ({ ...button })),
  announce: '今晚也要好好睡觉。',
  handle: '@晚风电台',
  fontStyle: 'default',
  uiScale: 1,
  textColor: '#fbf4e9',
  typeStyles: {},
  customFonts: [],
  playlistTitle: '今日歌单',
  playlistKicker: "TONIGHT'S PLAYLIST",
  playlistNote: '点歌请打在公屏',
  titleImage: '',
  avatar: '',
  showAvatar: true,
  speed: 1,
  autoplay: true,
  columns: 2,
  theme: 'amber',
  opacity: 0.62,
  background: '',
  widget: {
    x: null,
    y: null,
    width: null,
    height: null,
    visible: true,
    alwaysOnTop: false,
    clickThrough: false,
    draggable: true,
    aspectLock: true
  }
};

const THEMES = ['amber', 'rose', 'mint', 'violet'];
const FONT_STYLES = ['default', 'song', 'hei', 'kai', 'yuan'];

let settingsWindow = null;
let widgetWindow = null;
let tray = null;
let state = null;
let isQuitting = false;
let saveTimer = 0;
let settingBounds = false;
let trayHintShown = false;
let lastVisibleNotified = null;
let systemFontCache = null;
const COMMON_SYSTEM_FONTS = [
  'Microsoft YaHei', 'Microsoft YaHei UI', 'SimSun', 'SimHei', 'KaiTi',
  'FangSong', 'DengXian', 'Microsoft JhengHei', 'YouYuan', 'STKaiti',
  'STSong', 'STFangsong', 'LiSu', 'FZShuTi', 'FZYaoTi'
];

app.setName('Song Request');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showSettings();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.songrequest.widget');
    state = loadState();
    materializeBounds();
    registerIpc();
    createSettingsWindow();
    createWidgetWindow();
    createTray();
    registerShortcut();
    applyWidgetWindow();
    scheduleSave();

    app.on('activate', showSettings);
  });

  app.on('window-all-closed', () => {
    if (isQuitting) app.quit();
  });

  app.on('before-quit', () => {
    isQuitting = true;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = 0;
    }
    saveStateNow();
    globalShortcut.unregisterAll();
    if (tray && !tray.isDestroyed()) {
      tray.destroy();
      tray = null;
    }
  });
}

function stateFilePath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadState() {
  try {
    const raw = fs.readFileSync(stateFilePath(), 'utf8');
    return sanitizeState(JSON.parse(raw));
  } catch (error) {
    return sanitizeState(DEFAULT_STATE);
  }
}

function sanitizeState(source) {
  const src = source && typeof source === 'object' ? source : {};
  const widget = src.widget && typeof src.widget === 'object' ? src.widget : {};

  const background = validImage(src.background) ? src.background : '';
  const titleImage = validImage(src.titleImage) ? src.titleImage : '';
  const avatar = validImage(src.avatar) ? src.avatar : '';
  const opacitySource = Number(src.opacity);

  return {
    songsText: typeof src.songsText === 'string' ? src.songsText.slice(0, 30000) : DEFAULT_STATE.songsText,
    stationTitle: typeof src.stationTitle === 'string' ? src.stationTitle.slice(0, 24) : DEFAULT_STATE.stationTitle,
    eyebrow: typeof src.eyebrow === 'string' ? src.eyebrow.slice(0, 36) : DEFAULT_STATE.eyebrow,
    subtitle: typeof src.subtitle === 'string' ? src.subtitle.slice(0, 44) : DEFAULT_STATE.subtitle,
    tagsText: typeof src.tagsText === 'string' ? src.tagsText.slice(0, 60) : DEFAULT_STATE.tagsText,
    buttons: sanitizeButtons(src.buttons, src.actionsText),
    announce: typeof src.announce === 'string' ? src.announce.slice(0, 60) : DEFAULT_STATE.announce,
    handle: typeof src.handle === 'string' ? src.handle.slice(0, 36) : DEFAULT_STATE.handle,
    fontStyle: DEFAULT_STATE.fontStyle,
    uiScale: 1,
    textColor: DEFAULT_STATE.textColor,
    typeStyles: sanitizeTypeStyles(src.typeStyles),
    customFonts: sanitizeCustomFonts(src.customFonts),
    playlistTitle: typeof src.playlistTitle === 'string' ? src.playlistTitle.slice(0, 24) : DEFAULT_STATE.playlistTitle,
    playlistKicker: typeof src.playlistKicker === 'string' ? src.playlistKicker.slice(0, 36) : DEFAULT_STATE.playlistKicker,
    playlistNote: typeof src.playlistNote === 'string' ? src.playlistNote.slice(0, 36) : DEFAULT_STATE.playlistNote,
    titleImage,
    avatar,
    showAvatar: src.showAvatar !== false,
    speed: clamp(Number(src.speed) || 1, 0.3, 2.5),
    autoplay: src.autoplay !== false,
    columns: Number(src.columns) === 1 ? 1 : 2,
    theme: THEMES.includes(src.theme) ? src.theme : DEFAULT_STATE.theme,
    opacity: Number.isFinite(opacitySource) ? clamp(opacitySource, 0, 0.9) : DEFAULT_STATE.opacity,
    background,
    widget: {
      x: finiteNumber(widget.x),
      y: finiteNumber(widget.y),
      width: positiveNumber(widget.width),
      height: positiveNumber(widget.height),
      visible: widget.visible !== false,
      alwaysOnTop: widget.alwaysOnTop === true,
      clickThrough: widget.clickThrough === true,
      draggable: widget.draggable !== false,
      aspectLock: widget.aspectLock !== false
    }
  };
}

function sanitizeButtons(buttons, legacyText) {
  if (Array.isArray(buttons)) {
    return buttons.slice(0, 8).map((item) => {
      const source = item && typeof item === 'object' ? item : { label: item };
      const label = typeof source.label === 'string' ? source.label.trim().slice(0, 10) : '';
      const icon = validImage(source.icon) ? source.icon : '';
      return { label, icon };
    }).filter((item) => item.label || item.icon);
  }
  if (typeof legacyText === 'string') {
    return legacyText.split(/[,，、\n]+/).map((item) => item.trim().slice(0, 10)).filter(Boolean).slice(0, 8)
      .map((label) => ({ label, icon: '' }));
  }
  return DEFAULT_STATE.buttons.map((button) => ({ ...button }));
}

function validImage(value) {
  return typeof value === 'string'
    && /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(value)
    && value.length < 12000000;
}

function validColor(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1];
  return hex.length === 3
    ? `#${hex.split('').map((char) => char + char).join('')}`.toLowerCase()
    : `#${hex}`.toLowerCase();
}

function sanitizeTypeStyles(value) {
  if (!value || typeof value !== 'object') return {};
  const result = {};
  for (const [key, style] of Object.entries(value)) {
    if (!/^[a-zA-Z]{3,24}$/.test(key) || !style || typeof style !== 'object') continue;
    const clean = {};
    if (typeof style.font === 'string' && style.font.length <= 64) clean.font = style.font;
    const size = Number(style.size);
    if (Number.isFinite(size)) clean.size = Math.round(clamp(size, 6, 48) * 2) / 2;
    const color = validColor(style.color);
    if (color) clean.color = color;
    if (Object.keys(clean).length) result[key] = clean;
  }
  return result;
}

function sanitizeCustomFonts(fonts) {
  if (!Array.isArray(fonts)) return [];
  const result = [];
  const seen = new Set();
  for (const font of fonts) {
    if (!font || typeof font !== 'object') continue;
    const name = typeof font.name === 'string' ? font.name.trim().slice(0, 40) : '';
    const data = typeof font.data === 'string' ? font.data : '';
    if (!name || seen.has(name) || !/^data:[^;]+;base64,/i.test(data) || data.length > 12000000) continue;
    seen.add(name);
    result.push({ name, data });
    if (result.length >= 4) break;
  }
  return result;
}

function listInstalledFonts() {
  if (systemFontCache) return Promise.resolve(systemFontCache);
  const fallback = [
    'Microsoft YaHei', 'Microsoft YaHei UI', 'SimSun', 'SimHei', 'KaiTi',
    'FangSong', 'DengXian', 'Microsoft JhengHei', 'YouYuan', 'STKaiti',
    'STSong', 'STFangsong', 'Noto Sans SC', 'Noto Serif SC', 'Arial',
    'Georgia', 'Times New Roman', 'Consolas'
  ];
  const powershell = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );
  const script = 'Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }';
  return new Promise((resolve) => {
    execFile(
      powershell,
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 15000, maxBuffer: 2 * 1024 * 1024 },
      (error, stdout) => {
        let fonts = [];
        if (!error && stdout) {
          fonts = String(stdout)
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter((item) => item && !item.startsWith('@'));
        }
        fonts = [...new Set(fonts)].sort((a, b) => a.localeCompare(b, 'en'));
        fonts = [...new Set([...COMMON_SYSTEM_FONTS, ...fonts])].sort((a, b) => a.localeCompare(b, 'en'));
        systemFontCache = fonts.length ? fonts : fallback;
        resolve(systemFontCache);
      }
    );
  });
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function workArea() {
  return screen.getPrimaryDisplay().workArea;
}

function computeBounds(widget, hasTitleImage = false) {
  const area = workArea();
  const width = clamp(
    Math.round(widget.width || area.width * 0.415),
    660,
    Math.max(660, Math.min(1300, area.width))
  );
  const minHeight = 430;
  const height = clamp(
    Math.round(widget.height || area.height * 0.44),
    minHeight,
    Math.max(minHeight, Math.min(850, area.height))
  );

  let x = widget.x;
  let y = widget.y;
  if (x === null) x = Math.round(area.x + area.width * 0.555);
  if (y === null) y = Math.round(area.y + area.height * 0.35);

  x = clamp(x, area.x, area.x + Math.max(0, area.width - width));
  y = clamp(y, area.y, area.y + Math.max(0, area.height - height));

  return { x, y, width, height };
}

function materializeBounds() {
  const bounds = computeBounds(state.widget, Boolean(state.titleImage));
  state.widget.x = bounds.x;
  state.widget.y = bounds.y;
  state.widget.width = bounds.width;
  state.widget.height = bounds.height;
}

function applyIncomingState(incoming, preservePosition = true) {
  const next = sanitizeState(incoming);
  if (preservePosition && state) {
    next.widget.x = state.widget.x;
    next.widget.y = state.widget.y;
  }
  state = next;
  materializeBounds();
  applyWidgetWindow();
  sendWidgetState();
  sendGeometryToSettings();
  notifyVisibility();
  updateTrayMenu();
  scheduleSave();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = 0;
    saveStateNow();
  }, 260);
}

function saveStateNow() {
  if (!state) return;
  try {
    fs.mkdirSync(path.dirname(stateFilePath()), { recursive: true });
    fs.writeFileSync(stateFilePath(), JSON.stringify(state), 'utf8');
  } catch (error) {
    console.error('Save settings failed:', error);
  }
}

function createSettingsWindow() {
  const area = workArea();
  const width = Math.min(900, Math.max(760, area.width - 80));
  const height = Math.min(800, Math.max(640, area.height - 80));

  settingsWindow = new BrowserWindow({
    x: area.x + 30,
    y: area.y + 40,
    width,
    height,
    minWidth: 760,
    minHeight: 620,
    show: false,
    title: 'Song Request · 歌单挂件设置',
    backgroundColor: '#f3ede3',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false
    }
  });

  Menu.setApplicationMenu(null);
  settingsWindow.loadFile(path.join(__dirname, 'app', 'settings.html'));

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  settingsWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    settingsWindow.hide();
    if (!trayHintShown && tray && !tray.isDestroyed()) {
      trayHintShown = true;
      try {
        tray.displayBalloon({
          title: 'Song Request',
          content: '设置窗口已收起，歌单挂件仍在桌面运行。双击托盘图标可以重新打开设置。'
        });
      } catch (error) {
        /* tray balloon is optional */
      }
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createWidgetWindow() {
  const bounds = computeBounds(state.widget, Boolean(state.titleImage));

  widgetWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: state.widget.draggable !== false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: state.widget.alwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
      additionalArguments: ['--widget']
    }
  });

  widgetWindow.setSkipTaskbar(true);
  widgetWindow.setIgnoreMouseEvents(state.widget.clickThrough, { forward: true });
  widgetWindow.setAlwaysOnTop(state.widget.alwaysOnTop, 'floating');

  widgetWindow.loadFile(path.join(__dirname, 'app', 'widget.html'));

  widgetWindow.webContents.on('did-finish-load', () => {
    sendWidgetState();
    if (state.widget.visible) {
      widgetWindow.showInactive();
      if (state.widget.alwaysOnTop) widgetWindow.moveTop();
    }
  });

  widgetWindow.on('moved', () => {
    if (settingBounds || !widgetWindow || widgetWindow.isDestroyed()) return;
    const [x, y] = widgetWindow.getPosition();
    if (state.widget.x === x && state.widget.y === y) return;
    state.widget.x = x;
    state.widget.y = y;
    scheduleSave();
    sendGeometryToSettings();
  });

  widgetWindow.on('closed', () => {
    widgetWindow = null;
  });

  widgetWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function applyWidgetWindow() {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  const bounds = computeBounds(state.widget, Boolean(state.titleImage));
  state.widget.x = bounds.x;
  state.widget.y = bounds.y;
  state.widget.width = bounds.width;
  state.widget.height = bounds.height;

  const current = widgetWindow.getBounds();
  if (current.x !== bounds.x || current.y !== bounds.y || current.width !== bounds.width || current.height !== bounds.height) {
    settingBounds = true;
    widgetWindow.setBounds(bounds);
    settingBounds = false;
  }

  widgetWindow.setAlwaysOnTop(state.widget.alwaysOnTop, 'floating');
  if (typeof widgetWindow.setMovable === 'function') {
    widgetWindow.setMovable(state.widget.draggable !== false);
  }
  widgetWindow.setIgnoreMouseEvents(state.widget.clickThrough, { forward: true });

  if (state.widget.visible) {
    if (!widgetWindow.isVisible()) widgetWindow.showInactive();
    if (state.widget.alwaysOnTop) widgetWindow.moveTop();
  } else if (widgetWindow.isVisible()) {
    widgetWindow.hide();
  }
}

function sendWidgetState() {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  if (widgetWindow.webContents.isDestroyed()) return;
  widgetWindow.webContents.send('widget:state', state);
}

function sendGeometryToSettings() {
  if (!settingsWindow || settingsWindow.isDestroyed()) return;
  if (settingsWindow.webContents.isDestroyed()) return;
  settingsWindow.webContents.send('widget:geometry', {
    x: state.widget.x,
    y: state.widget.y,
    width: state.widget.width,
    height: state.widget.height
  });
}

function notifyVisibility() {
  const visible = Boolean(state.widget.visible);
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    lastVisibleNotified = visible;
    return;
  }
  if (lastVisibleNotified === visible) return;
  lastVisibleNotified = visible;
  if (!settingsWindow.webContents.isDestroyed()) {
    settingsWindow.webContents.send('widget:visibility', visible);
  }
}

function showWidget() {
  if (!state) return;
  state.widget.visible = true;
  applyWidgetWindow();
  sendWidgetState();
  notifyVisibility();
  updateTrayMenu();
  scheduleSave();
}

function hideWidget() {
  if (!state) return;
  state.widget.visible = false;
  applyWidgetWindow();
  notifyVisibility();
  updateTrayMenu();
  scheduleSave();
}

function toggleWidget() {
  if (state.widget.visible) hideWidget();
  else showWidget();
}

function showSettings() {
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    createSettingsWindow();
    return;
  }
  if (settingsWindow.isMinimized()) settingsWindow.restore();
  settingsWindow.show();
  settingsWindow.focus();
}

function createTray() {
  const image = nativeImage.createFromDataURL(TRAY_ICON_DATA);
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('Song Request · 桌面歌单挂件');
  tray.on('click', showSettings);
  tray.on('double-click', showSettings);
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  const menu = Menu.buildFromTemplate([
    { label: '打开设置', click: showSettings },
    {
      label: state && state.widget.visible ? '隐藏歌单挂件' : '显示歌单挂件',
      click: toggleWidget
    },
    { type: 'separator' },
    { label: '退出 Song Request', click: quitApp }
  ]);
  tray.setContextMenu(menu);
}

function registerShortcut() {
  try {
    globalShortcut.register('CommandOrControl+Alt+O', toggleWidget);
  } catch (error) {
    console.warn('Global shortcut failed:', error.message);
  }
}

function quitApp() {
  isQuitting = true;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = 0;
  }
  saveStateNow();
  app.quit();
}

function registerIpc() {
  ipcMain.handle('state:get', () => state);

  ipcMain.handle('fonts:list', (event) => {
    if (!settingsWindow || settingsWindow.isDestroyed() || event.sender !== settingsWindow.webContents) {
      return [];
    }
    return listInstalledFonts();
  });

  ipcMain.handle('state:save', (event, incoming) => {
    if (!settingsWindow || settingsWindow.isDestroyed() || event.sender !== settingsWindow.webContents) {
      return { ok: false, state };
    }
    applyIncomingState(incoming, true);
    return { ok: true, state };
  });

  ipcMain.handle('widget:reset-bounds', (event) => {
    if (!settingsWindow || settingsWindow.isDestroyed() || event.sender !== settingsWindow.webContents) {
      return { ok: false, state };
    }
    state.widget.x = null;
    state.widget.y = null;
    state.widget.width = null;
    state.widget.height = null;
    materializeBounds();
    applyWidgetWindow();
    sendWidgetState();
    sendGeometryToSettings();
    scheduleSave();
    return { ok: true, state };
  });

  ipcMain.handle('widget:set-bounds', (event, bounds) => {
    if (!settingsWindow || settingsWindow.isDestroyed() || event.sender !== settingsWindow.webContents) {
      return { ok: false, state };
    }
    const next = bounds && typeof bounds === 'object' ? bounds : {};
    const x = finiteNumber(next.x);
    const y = finiteNumber(next.y);
    const width = positiveNumber(next.width);
    const height = positiveNumber(next.height);
    if (x !== null) state.widget.x = x;
    if (y !== null) state.widget.y = y;
    if (width !== null) state.widget.width = width;
    if (height !== null) state.widget.height = height;
    materializeBounds();
    applyWidgetWindow();
    sendWidgetState();
    sendGeometryToSettings();
    scheduleSave();
    return { ok: true, state };
  });

  ipcMain.on('settings:hide', (event) => {
    if (!settingsWindow || event.sender !== settingsWindow.webContents) return;
    settingsWindow.hide();
    if (!trayHintShown && tray && !tray.isDestroyed()) {
      trayHintShown = true;
      try {
        tray.displayBalloon({
          title: 'Song Request',
          content: '设置窗口已收起，歌单挂件仍在桌面运行。双击托盘图标可以重新打开设置。'
        });
      } catch (error) {
        /* optional */
      }
    }
  });

  ipcMain.on('app:quit', (event) => {
    if (!settingsWindow || event.sender !== settingsWindow.webContents) return;
    quitApp();
  });

  ipcMain.on('widget:ready', (event) => {
    if (!widgetWindow || event.sender !== widgetWindow.webContents) return;
    sendWidgetState();
  });
}
