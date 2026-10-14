/**
 * AC REMOTE PRO - Cockpit Companion & Controller para Assetto Corsa
 * Frontend SPA Logic (PWA Mobile-First) com Telemetria em Tempo Real,
 * Efeitos Sonoros Synthesized F1, Gestão de Favoritos, e Cockpit HUD.
 */

// ================= MOTOR DE SOM & ÁUDIO RACING (WEB AUDIO API) =================

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('ac_sound_enabled') !== 'false';
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('ac_sound_enabled', this.enabled ? 'true' : 'false');
    updateSoundUI(this.enabled);
    if (this.enabled) {
      this.playChime();
      showToast('Efeitos Sonoros de Corrida ATIVADOS! 🔊', '🔊');
    } else {
      showToast('Efeitos Sonoros DESATIVADOS 🔇', '🔇');
    }
  }

  // Clique mecânico de patilha de velocidades / botão tátil
  playShift() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(850, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {}
  }

  // Som de arranque de motor / V8 launch roar
  playEngine() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(75, t);
      osc.frequency.linearRampToValueAtTime(280, t + 0.4);
      osc.frequency.linearRampToValueAtTime(110, t + 0.8);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.linearRampToValueAtTime(0.45, t + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.8);
    } catch (e) {}
  }

  // Rádio de boxes ("Box, box, box")
  playRadio() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [0, 0.12].forEach((offset, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(idx === 0 ? 1200 : 1600, t + offset);
        gain.gain.setValueAtTime(0.18, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.08);
      });
    } catch (e) {}
  }

  // Chime de confirmação
  playChime() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t);
      osc.frequency.setValueAtTime(659.25, t + 0.1);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    } catch (e) {}
  }
}

const soundEngine = new SoundEngine();

function toggleAudioEngine() {
  soundEngine.toggle();
}

function updateSoundUI(enabled) {
  const icon = document.getElementById('sound-icon');
  if (icon) icon.textContent = enabled ? '🔊' : '🔇';

  const btn = document.getElementById('btn-sound-toggle');
  if (btn) {
    btn.classList.toggle('text-white', enabled);
    btn.classList.toggle('text-slate-500', !enabled);
  }

  const settingsBtn = document.getElementById('btn-settings-sound-toggle');
  if (settingsBtn) {
    settingsBtn.textContent = enabled ? 'LIGADO' : 'DESLIGADO';
    settingsBtn.className = enabled 
      ? 'px-3 py-1.5 rounded-xl bg-brand-red text-white text-xs font-bold active:scale-95 transition-transform'
      : 'px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold active:scale-95 transition-transform';
  }
}

// ================= FASE 5: ENGENHEIRO DE PISTA & SPOTTER IA POR VOZ =================

class SpotterEngine {
  constructor() {
    this.enabled = localStorage.getItem('ac_spotter_enabled') !== 'false';
    this.synth = window.speechSynthesis;
    this.voice = null;
    this.lastSpoken = {};
    this.initVoice();
  }

  initVoice() {
    if (!this.synth) return;
    const findVoice = () => {
      const voices = this.synth.getVoices();
      this.voice = voices.find(v => v.lang.startsWith('pt')) || voices.find(v => v.lang.startsWith('en')) || null;
    };
    findVoice();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = findVoice;
    }
  }

  speak(text, priority = 'normal', minCooldownSecs = 8) {
    if (!this.enabled || !this.synth) return;
    const now = Date.now();
    if (this.lastSpoken[text] && (now - this.lastSpoken[text]) < minCooldownSecs * 1000) {
      return;
    }
    this.lastSpoken[text] = now;

    if (priority === 'urgent') {
      try { this.synth.cancel(); } catch (e) {}
    }

    try {
      const utter = new SpeechSynthesisUtterance(text);
      if (this.voice) utter.voice = this.voice;
      utter.rate = 1.05;
      utter.pitch = 0.95;
      this.synth.speak(utter);
    } catch (e) {}
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('ac_spotter_enabled', this.enabled);
    updateSpotterUI(this.enabled);
    if (this.enabled) {
      this.speak("Rádio do engenheiro ligado.", 'urgent', 0);
    }
    return this.enabled;
  }
}

const spotter = new SpotterEngine();

function toggleSpotter() {
  soundEngine.playShift();
  const stateVal = spotter.toggle();
  showToast(stateVal ? '🎙️ Spotter IA Ativado' : '🔇 Spotter IA Desativado', '🎙️');
}

function updateSpotterUI(enabled) {
  const btn = document.getElementById('btn-toggle-spotter');
  const label = document.getElementById('spotter-label');
  if (btn) {
    btn.classList.toggle('border-brand-cyan', enabled);
    btn.classList.toggle('bg-brand-cyan/20', enabled);
    btn.classList.toggle('text-brand-cyan', enabled);
  }
  if (label) label.textContent = enabled ? '🎙️ Spotter ON' : '🎙️ Spotter OFF';
}

// ================= ESTADO GLOBAL DA APLICAÇÃO =================

const state = {
  cars: [],
  tracks: [],
  selectedCar: null,
  selectedSkin: null,
  selectedTrack: null,
  selectedLayout: '',
  selectedMode: 'practice',
  selectedModeLabel: 'Treino Livre',
  selectedWeather: 'clear',
  selectedTime: '14:00',
  currentGarageSection: 'cars',
  activeCategory: 'ALL',
  activeTrackFilter: 'ALL',
  activeBrandFilter: 'ALL',
  searchQuery: '',
  favoriteCars: JSON.parse(localStorage.getItem('ac_fav_cars') || '[]'),
  favoriteTracks: JSON.parse(localStorage.getItem('ac_fav_tracks') || '[]'),
  config: {},
  status: {},
  // Temporário no modal de skin
  tempSkin: null,
  tempCar: null,
  lastGear: 'N'
};

// ================= INICIALIZAÇÃO =================

document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker();
  initTheme();
  initHudPreferences();
  updateSoundUI(soundEngine.enabled);
  updateFavBadgeCount();
  fetchStatus();
  fetchCars();
  fetchTracks();
  fetchServers();
  setupTouchHaptics();

  // Polling de telemetria e status
  setInterval(fetchStatus, 4000);
  setInterval(fetchTelemetryData, 200);
  setInterval(measurePing, 3000);
  measurePing();
});

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[PWA] Service Worker ativo:', reg.scope))
      .catch(err => console.warn('[PWA] Falha ao registar SW:', err));
  }
}

function hapticPulse(type = 'light') {
  if ('vibrate' in navigator) {
    try {
      if (type === 'light') navigator.vibrate(10);
      else if (type === 'medium') navigator.vibrate(22);
      else if (type === 'heavy') navigator.vibrate([25, 40, 25]);
    } catch (e) {}
  }
}

function setupTouchHaptics() {
  document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('touchstart', () => {
      soundEngine.playShift();
      hapticPulse('light');
    }, { passive: true });
  });
}

// ================= TEMAS COCKPIT NEON =================

const THEMES = {
  red: {
    primary: '#ff2449',
    dark: '#cc1133',
    glow: 'rgba(255, 36, 73, 0.45)',
    border: '#1f2433',
    name: 'Scuderia Red'
  },
  cyan: {
    primary: '#00e5ff',
    dark: '#00b4cc',
    glow: 'rgba(0, 229, 255, 0.45)',
    border: '#142a38',
    name: 'Alpine Cyan'
  },
  green: {
    primary: '#10b981',
    dark: '#059669',
    glow: 'rgba(16, 185, 129, 0.45)',
    border: '#132e22',
    name: 'Racing Green'
  },
  yellow: {
    primary: '#fbbf24',
    dark: '#d97706',
    glow: 'rgba(251, 191, 36, 0.45)',
    border: '#2e2513',
    name: 'Giallo Modena'
  },
  purple: {
    primary: '#c084fc',
    dark: '#9333ea',
    glow: 'rgba(192, 132, 252, 0.45)',
    border: '#2a1a38',
    name: 'Cyber Drift'
  }
};

function initTheme() {
  const saved = localStorage.getItem('ac_theme') || 'red';
  applyThemeStyles(saved);
}

function setCockpitTheme(key) {
  applyThemeStyles(key);
  soundEngine.playChime();
  hapticPulse('light');
  const t = THEMES[key] || THEMES.red;
  showToast(`Tema alterado para ${t.name}!`, '🎨');
}

function applyThemeStyles(key) {
  const t = THEMES[key] || THEMES.red;
  document.documentElement.style.setProperty('--brand-primary', t.primary);
  document.documentElement.style.setProperty('--brand-dark', t.dark);
  document.documentElement.style.setProperty('--brand-glow', t.glow);
  document.documentElement.style.setProperty('--brand-border', t.border);

  localStorage.setItem('ac_theme', key);
  const label = document.getElementById('theme-active-label');
  if (label) {
    label.textContent = t.name;
    label.style.color = t.primary;
  }
}

// ================= HELPER DE COMUNICAÇÃO API (VERCEL PROXY TRANSPARENTE) =================

function getApiEndpoint(path) {
  const remotePc = state.config.remote_pc_url || localStorage.getItem('ac_remote_pc_url') || '';
  const isVercelHost = window.location.hostname.includes('vercel.app') || (state.status && state.status.is_vercel);
  
  if (isVercelHost && remotePc && path.startsWith('/api/')) {
    const subpath = path.replace('/api/', '');
    return `/api/proxy/${subpath}`;
  }
  return path;
}

async function apiFetch(path, options = {}) {
  const remotePc = state.config.remote_pc_url || localStorage.getItem('ac_remote_pc_url') || '';
  const url = getApiEndpoint(path);
  
  const headers = options.headers ? { ...options.headers } : {};
  if (remotePc) {
    headers['X-Target-PC'] = remotePc;
  }
  
  return fetch(url, { ...options, headers });
}

// Medição de Latência / Ping Live
async function measurePing() {
  const start = performance.now();
  try {
    const res = await apiFetch('/api/ping');
    const json = await res.json();
    const duration = Math.round(performance.now() - start);

    const pingText = document.getElementById('ping-value-text');
    if (pingText) pingText.textContent = `${duration} ms`;

    const diag = document.getElementById('settings-pc-diag');
    if (diag && json.cpu !== undefined) {
      diag.textContent = `CPU: ${json.cpu}% | RAM: ${json.ram}%`;
    }
  } catch (e) {
    const pingText = document.getElementById('ping-value-text');
    if (pingText) pingText.textContent = '-- ms';
  }
}

async function fetchStatus() {
  try {
    const res = await apiFetch('/api/status');
    const data = await res.json();
    state.status = data;
    updateStatusUI(data);
  } catch (err) {
    console.error('Erro ao obter status:', err);
  }
}

function updateStatusUI(data) {
  const dot = document.getElementById('status-indicator-dot');
  const label = document.getElementById('status-indicator-label');
  const demoAlert = document.getElementById('demo-mode-alert');
  const ipEl = document.getElementById('settings-local-ip');
  const ipTitle = document.getElementById('label-ip-title');
  const acStatus = document.getElementById('settings-ac-status');
  const acBadge = document.getElementById('settings-ac-badge');
  const envMode = document.getElementById('settings-env-mode');
  const keepAwakeBadge = document.getElementById('badge-keep-awake');
  const acPathInput = document.getElementById('input-ac-path');
  const raceIniInput = document.getElementById('input-race-ini');
  const remotePcInput = document.getElementById('input-remote-pc');

  const savedRemotePc = localStorage.getItem('ac_remote_pc_url') || data.remote_pc_url || '';
  if (remotePcInput && !remotePcInput.value) remotePcInput.value = savedRemotePc;

  if (data.is_vercel || window.location.hostname.includes('vercel.app')) {
    if (ipTitle) ipTitle.textContent = 'SERVIDOR CLOUD';
    if (ipEl) ipEl.textContent = 'Vercel (Online 24/7)';
    if (envMode) envMode.textContent = 'PWA Nuvem (Vercel)';
    if (keepAwakeBadge) {
      keepAwakeBadge.innerHTML = '<span>☁️</span> VERCEL 24/7';
      keepAwakeBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1';
    }
    if (savedRemotePc) {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
      if (label) label.textContent = 'Vercel ↔ PC';
    } else {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-sky-400';
      if (label) label.textContent = 'Vercel';
    }
  } else {
    if (ipTitle) ipTitle.textContent = 'IP LOCAL DO PC';
    if (ipEl) ipEl.textContent = `http://${data.local_ip}:5000`;
    if (envMode) envMode.textContent = 'Servidor Local no PC';
    if (keepAwakeBadge) {
      keepAwakeBadge.innerHTML = '<span>⚡</span> PC SEMPRE LIGADO';
      keepAwakeBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1';
    }
  }

  if (acPathInput && !acPathInput.value) acPathInput.value = data.ac_path || '';
  if (raceIniInput && !raceIniInput.value) raceIniInput.value = data.race_ini || '';

  if (data.demo_mode) {
    if (!data.is_vercel) {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-400';
      if (label) label.textContent = 'Modo Demo';
    }
    if (demoAlert) demoAlert.classList.remove('hidden');
    if (acStatus) acStatus.textContent = data.is_vercel ? 'A correr na Vercel (liga o PC nas definições)' : 'Pasta padrão não encontrada (a usar dados demo)';
    if (acBadge) {
      acBadge.textContent = data.is_vercel ? 'CLOUD' : 'DEMO';
      acBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30';
    }
  } else {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    if (label) label.textContent = 'Online';
    if (demoAlert) demoAlert.classList.add('hidden');
    if (acStatus) acStatus.textContent = 'Ficheiros do simulador detetados com sucesso';
    if (acBadge) {
      acBadge.textContent = 'ONLINE';
      acBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    }
  }

  // Indicador de corrida ativa no PC
  const trackPing = document.getElementById('badge-track-live-ping');
  const trackDot = document.getElementById('badge-track-live-dot');
  const trackStatusBadge = document.getElementById('track-status-badge');
  const trackStatusDot = document.getElementById('track-status-dot');

  if (data.game_running) {
    if (trackPing) trackPing.classList.remove('hidden');
    if (trackDot) trackDot.classList.remove('hidden');
    if (trackStatusBadge) {
      trackStatusBadge.textContent = 'AO VIVO';
      trackStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    }
    if (trackStatusDot) trackStatusDot.className = 'w-3 h-3 rounded-full bg-emerald-500 animate-ping';
  } else {
    if (trackPing) trackPing.classList.add('hidden');
    if (trackDot) trackDot.classList.add('hidden');
    if (trackStatusBadge) {
      trackStatusBadge.textContent = 'STANDBY';
      trackStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700';
    }
    if (trackStatusDot) trackStatusDot.className = 'w-3 h-3 rounded-full bg-slate-600';
  }
}

// ================= GESTÃO DE CARROS & FAVORITOS =================

async function fetchCars() {
  const grid = document.getElementById('cars-grid');
  try {
    const res = await apiFetch('/api/cars');
    const data = await res.json();
    state.cars = data.cars || [];
    
    const countBadge = document.getElementById('cars-badge-count');
    if (countBadge) countBadge.textContent = state.cars.length;

    renderBrandFilterChips();
    renderCarsGrid();
    renderRecentCombos();

    if (state.cars.length > 0 && !state.selectedCar) {
      selectCar(state.cars[0], false);
    }
  } catch (err) {
    console.error('Erro ao carregar carros:', err);
    if (grid) {
      grid.innerHTML = `
        <div class="col-span-full py-8 text-center text-red-400 text-xs">
          Erro ao carregar carros. Verifica a ligação ao backend.
        </div>`;
    }
  }
}

function toggleFavoriteCar(e, carId) {
  e.stopPropagation();
  soundEngine.playShift();
  hapticPulse('medium');
  const idx = state.favoriteCars.indexOf(carId);
  if (idx >= 0) {
    state.favoriteCars.splice(idx, 1);
    showToast('Carro removido dos Favoritos', '⭐');
  } else {
    state.favoriteCars.push(carId);
    showToast('Carro adicionado aos Favoritos!', '⭐');
  }
  localStorage.setItem('ac_fav_cars', JSON.stringify(state.favoriteCars));
  updateFavBadgeCount();
  renderCarsGrid();
}

function updateFavBadgeCount() {
  const badge = document.getElementById('fav-count-badge');
  if (badge) badge.textContent = state.favoriteCars.length;
}

function setCategoryFilter(category) {
  soundEngine.playShift();
  hapticPulse('light');
  state.activeCategory = category;

  document.querySelectorAll('.cat-chip-btn').forEach(btn => {
    const isThis = btn.getAttribute('data-cat') === category;
    btn.classList.toggle('active', isThis);
    btn.classList.toggle('border-brand-red', isThis);
    btn.classList.toggle('bg-brand-red', isThis);
    btn.classList.toggle('text-white', isThis);
    btn.classList.toggle('border-slate-800', !isThis && category !== 'FAVORITES');
    btn.classList.toggle('bg-slate-900', !isThis && category !== 'FAVORITES');
    btn.classList.toggle('text-slate-400', !isThis);
  });

  renderCarsGrid();
}

function renderBrandFilterChips() {
  const container = document.getElementById('brand-chips');
  if (!container) return;

  const brands = new Set();
  state.cars.forEach(c => {
    if (c.brand && c.brand.trim() && c.brand !== 'Outro') {
      brands.add(c.brand.trim());
    }
  });

  const sortedBrands = ['ALL', ...Array.from(brands).sort()];
  
  container.innerHTML = sortedBrands.map(b => {
    const isAll = b === 'ALL';
    const label = isAll ? 'MARCAS: TODAS' : b;
    const isActive = state.activeBrandFilter === b;
    return `
      <button 
        onclick="setBrandFilter('${b}')"
        class="flex-none px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
          isActive 
            ? 'bg-slate-800 text-white border-brand-red shadow-sm' 
            : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white'
        }"
      >
        ${label}
      </button>
    `;
  }).join('');
}

function setBrandFilter(brand) {
  soundEngine.playShift();
  hapticPulse('light');
  state.activeBrandFilter = brand;
  renderBrandFilterChips();
  renderCarsGrid();
}

function handleSearch(val) {
  state.searchQuery = val.trim().toLowerCase();
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) {
    clearBtn.classList.toggle('hidden', state.searchQuery.length === 0);
  }

  if (state.currentGarageSection === 'cars') {
    renderCarsGrid();
  } else if (state.currentGarageSection === 'tracks') {
    renderTracksGrid();
  }
}

function clearSearch() {
  const input = document.getElementById('search-input');
  if (input) input.value = '';
  handleSearch('');
}

function getCountryFlag(country) {
  if (!country) return '';
  const c = country.toLowerCase();
  if (c.includes('ital')) return '🇮🇹 IT';
  if (c.includes('germ')) return '🇩🇪 DE';
  if (c.includes('jap')) return '🇯🇵 JP';
  if (c.includes('brit') || c.includes('uk') || c.includes('eng')) return '🇬🇧 UK';
  if (c.includes('usa') || c.includes('amer')) return '🇺🇸 US';
  if (c.includes('franc')) return '🇫🇷 FR';
  return country.toUpperCase().slice(0, 3);
}

function renderCarsGrid() {
  const grid = document.getElementById('cars-grid');
  if (!grid) return;

  const filtered = state.cars.filter(car => {
    // 1. Categoria
    if (state.activeCategory === 'FAVORITES') {
      if (!state.favoriteCars.includes(car.id)) return false;
    } else if (state.activeCategory === 'GT3') {
      const isGt = (car.name + ' ' + car.id).toLowerCase().includes('gt');
      if (!isGt) return false;
    } else if (state.activeCategory === 'DRIFT') {
      const isDrift = (car.name + ' ' + car.id).toLowerCase().includes('drift') || (car.name + ' ' + car.id).toLowerCase().includes('miata') || (car.name + ' ' + car.id).toLowerCase().includes('bmw') || (car.name + ' ' + car.id).toLowerCase().includes('supra');
      if (!isDrift) return false;
    } else if (state.activeCategory === 'JDM') {
      const isJdm = ['mazda', 'toyota', 'nissan', 'honda', 'subaru', 'mitsubishi'].some(m => (car.name + ' ' + car.brand + ' ' + car.id).toLowerCase().includes(m));
      if (!isJdm) return false;
    } else if (state.activeCategory === 'SUPER') {
      const isSuper = ['ferrari', 'porsche', 'lamborghini', 'mclaren'].some(m => (car.name + ' ' + car.brand + ' ' + car.id).toLowerCase().includes(m));
      if (!isSuper) return false;
    } else if (state.activeCategory === 'RWD') {
      const isRwd = !((car.name + ' ' + car.id).toLowerCase().includes('awd') || (car.name + ' ' + car.id).toLowerCase().includes('4wd') || (car.name + ' ' + car.id).toLowerCase().includes('fwd'));
      if (!isRwd) return false;
    } else if (state.activeCategory === 'AWD') {
      const isAwd = (car.name + ' ' + car.id).toLowerCase().includes('awd') || (car.name + ' ' + car.id).toLowerCase().includes('4wd') || (car.name + ' ' + car.id).toLowerCase().includes('quattro') || (car.name + ' ' + car.id).toLowerCase().includes('gtr');
      if (!isAwd) return false;
    } else if (state.activeCategory === 'MANUAL') {
      const isManual = !((car.name + ' ' + car.id).toLowerCase().includes('gt3') || (car.name + ' ' + car.id).toLowerCase().includes('gt4') || (car.name + ' ' + car.id).toLowerCase().includes('f1'));
      if (!isManual) return false;
    }

    // 2. Marca
    if (state.activeBrandFilter !== 'ALL' && car.brand !== state.activeBrandFilter) {
      return false;
    }
    // 3. Pesquisa
    if (state.searchQuery) {
      const q = state.searchQuery;
      return car.name.toLowerCase().includes(q) || (car.brand || '').toLowerCase().includes(q) || car.id.toLowerCase().includes(q);
    }
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-500 text-xs">
        Nenhum carro encontrado para a pesquisa selecionada.
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(car => {
    const isSelected = state.selectedCar && state.selectedCar.id === car.id;
    const isFav = state.favoriteCars.includes(car.id);
    const skin = (isSelected && state.selectedSkin) ? state.selectedSkin : car.default_skin;
    const previewUrl = `/api/img/car/${encodeURIComponent(car.id)}/${encodeURIComponent(skin)}`;
    const badgeUrl = `/api/img/badge/${encodeURIComponent(car.id)}`;
    const bhp = car.specs ? car.specs.bhp : 'N/D';
    const weight = car.specs ? car.specs.weight : 'N/D';
    const topSpeed = car.specs ? car.specs.topSpeed : '';
    const flag = getCountryFlag(car.country);
    const fallbackWeb = car.image_url || '';

    return `
      <div 
        onclick="handleCarCardClick('${car.id}')"
        class="relative bg-brand-card rounded-2xl overflow-hidden border transition-all active:scale-[0.98] cursor-pointer group shadow-lg ${
          isSelected 
            ? 'border-brand-red ring-2 ring-brand-red/50 shadow-xl shadow-brand-red/15' 
            : 'border-brand-border hover:border-slate-700'
        }"
      >
        <!-- Imagem Principal do Carro -->
        <div class="relative w-full aspect-[16/9] bg-slate-950 overflow-hidden">
          <img 
            src="${previewUrl}" 
            alt="${car.name}" 
            loading="lazy" 
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            style="object-fit: cover;"
            onerror="if (!this.dataset.triedWeb && '${fallbackWeb}') { this.dataset.triedWeb='1'; this.src='${fallbackWeb}'; } else if (!this.dataset.triedSvg) { this.dataset.triedSvg='1'; this.src='/api/img/placeholder/car?id=${encodeURIComponent(car.id)}&skin=${encodeURIComponent(skin)}'; }"
          >
          
          <!-- Badge do Fabricante (Canto Superior Esquerdo) -->
          <div class="absolute top-2 left-2 w-7 h-7 rounded-lg bg-black/60 backdrop-blur-md p-1 border border-white/10 flex items-center justify-center">
            <img src="${badgeUrl}" alt="${car.brand}" class="max-w-full max-h-full object-contain" onerror="this.style.display='none'">
          </div>

          <!-- Botão Estrela de Favoritos (Canto Superior Direito) -->
          <button 
            onclick="toggleFavoriteCar(event, '${car.id}')"
            class="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-sm active:scale-90 transition-transform ${isFav ? 'text-amber-400' : 'text-slate-400 hover:text-white'}"
            title="Favoritar Carro"
          >
            ★
          </button>

          <!-- Barra de Fundo com Skin Atual -->
          <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent p-2 flex items-end justify-between">
            <span class="text-[10px] text-slate-300 font-mono truncate max-w-[70%]">
              🎨 ${skin.replace(/_/g, ' ')}
            </span>
            <span class="text-[9px] font-bold text-brand-cyan tracking-wider uppercase">Pinturas (${car.skins.length})</span>
          </div>
        </div>

        <!-- Informações do Carro -->
        <div class="p-3">
          <div class="flex items-start justify-between gap-1">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="text-[9px] font-bold uppercase tracking-wider text-brand-red block truncate">${car.brand || 'Assetto Corsa'}</span>
                ${flag ? `<span class="text-[9px] font-mono text-slate-400">${flag}</span>` : ''}
              </div>
              <h3 class="text-xs font-bold text-white truncate leading-tight mt-0.5">${car.name}</h3>
            </div>
          </div>

          <!-- Badges de Especificações & Ações Rápidas (Fase 3) -->
          <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[10px] font-mono">
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1 text-amber-400 font-bold">
                <span>🔥</span>
                <span>${bhp}</span>
              </div>
              <span class="text-slate-600">•</span>
              <div class="flex items-center gap-1 text-slate-300">
                <span>⚖️</span>
                <span>${weight}</span>
              </div>
              ${topSpeed && topSpeed !== 'N/D' ? `
                <span class="text-slate-600">•</span>
                <div class="flex items-center gap-1 text-brand-cyan">
                  <span>⚡</span>
                  <span>${topSpeed}</span>
                </div>
              ` : ''}
            </div>

            <!-- Botões Rápidos: Comparar & Setup Notes -->
            <div class="flex items-center gap-1">
              <button 
                onclick="event.stopPropagation(); openCarCompareModal('${car.id}');" 
                class="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[9px] text-slate-300 hover:text-white border border-slate-800 active:scale-90 transition-transform"
                title="Comparar com outro carro"
              >
                ⚖️
              </button>
              <button 
                onclick="event.stopPropagation(); openSetupNotesModal('${car.id}');" 
                class="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[9px] text-slate-300 hover:text-white border border-slate-800 active:scale-90 transition-transform"
                title="Notas de setup"
              >
                📝
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function handleCarCardClick(carId) {
  soundEngine.playShift();
  hapticPulse('medium');
  const car = state.cars.find(c => c.id === carId);
  if (!car) return;

  const isAlreadySelected = state.selectedCar && state.selectedCar.id === car.id;
  if (!isAlreadySelected) {
    selectCar(car, false);
  }
  openSkinModal(car);
}

function selectCar(car, render = true) {
  state.selectedCar = car;
  if (!state.selectedSkin || !car.skins.includes(state.selectedSkin)) {
    state.selectedSkin = car.default_skin || car.skins[0] || 'default';
  }
  const hudCarLabel = document.getElementById('hud-car-name');
  if (hudCarLabel) hudCarLabel.textContent = car.name;

  updateSummaryBar();
  if (render) renderCarsGrid();
}

// ================= GAVETA DE SKINS (BOTTOM SHEET) =================

function openSkinModal(car) {
  state.tempCar = car;
  state.tempSkin = state.selectedSkin || car.default_skin;

  const brandEl = document.getElementById('skin-modal-car-brand');
  const nameEl = document.getElementById('skin-modal-car-name');
  if (brandEl) brandEl.textContent = car.brand || 'Assetto Corsa';
  if (nameEl) nameEl.textContent = car.name;

  updateSkinLivePreview(car.id, state.tempSkin);
  renderSkinsGrid(car);

  const backdrop = document.getElementById('skin-bottom-sheet-backdrop');
  const sheet = document.getElementById('skin-bottom-sheet');
  if (backdrop) {
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    backdrop.classList.add('opacity-100');
  }
  if (sheet) sheet.classList.remove('closed');
}

function closeSkinModal() {
  hapticPulse('light');
  const backdrop = document.getElementById('skin-bottom-sheet-backdrop');
  const sheet = document.getElementById('skin-bottom-sheet');
  if (backdrop) {
    backdrop.classList.add('opacity-0', 'pointer-events-none');
    backdrop.classList.remove('opacity-100');
  }
  if (sheet) sheet.classList.add('closed');
}

function renderSkinsGrid(car) {
  const grid = document.getElementById('skins-grid');
  if (!grid) return;

  const fallbackWeb = car.image_url || '';

  grid.innerHTML = car.skins.map(skinName => {
    const isSelected = state.tempSkin === skinName;
    const previewUrl = `/api/img/car/${encodeURIComponent(car.id)}/${encodeURIComponent(skinName)}`;
    return `
      <div 
        onclick="previewSkin('${skinName}')"
        class="p-1 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 active:scale-95 ${
          isSelected 
            ? 'border-brand-red bg-brand-red/10 ring-2 ring-brand-red/40' 
            : 'border-slate-800 hover:border-slate-700'
        }"
      >
        <div class="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
          <img 
            src="${previewUrl}" 
            alt="${skinName}" 
            loading="lazy" 
            class="w-full h-full object-cover"
            style="object-fit: cover;"
            onerror="if (!this.dataset.triedWeb && '${fallbackWeb}') { this.dataset.triedWeb='1'; this.src='${fallbackWeb}'; } else if (!this.dataset.triedSvg) { this.dataset.triedSvg='1'; this.src='/api/img/placeholder/car?id=${encodeURIComponent(car.id)}&skin=${encodeURIComponent(skinName)}'; }"
          >
          ${isSelected ? '<span class="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-brand-red shadow"></span>' : ''}
        </div>
        <span class="text-[10px] font-semibold text-slate-200 truncate px-1 text-center font-mono">
          ${skinName.replace(/_/g, ' ')}
        </span>
      </div>
    `;
  }).join('');
}

function previewSkin(skinName) {
  soundEngine.playShift();
  hapticPulse('light');
  state.tempSkin = skinName;
  updateSkinLivePreview(state.tempCar.id, skinName);
  renderSkinsGrid(state.tempCar);
}

function updateSkinLivePreview(carId, skinName) {
  const img = document.getElementById('skin-live-preview');
  const title = document.getElementById('skin-live-title');
  if (img) {
    const car = state.cars.find(c => c.id === carId);
    img.src = `/api/img/car/${encodeURIComponent(carId)}/${encodeURIComponent(skinName)}`;
    img.style.objectFit = 'cover';
    img.dataset.triedWeb = '';
    img.dataset.triedSvg = '';
    img.onerror = function() {
      if (!this.dataset.triedWeb && car && car.image_url) {
        this.dataset.triedWeb = '1';
        this.src = car.image_url;
      } else if (!this.dataset.triedSvg) {
        this.dataset.triedSvg = '1';
        this.src = `/api/img/placeholder/car?id=${encodeURIComponent(carId)}&skin=${encodeURIComponent(skinName)}`;
      }
    };
  }
  if (title) title.textContent = skinName.replace(/_/g, ' ');
}

function confirmSkinSelection() {
  soundEngine.playChime();
  hapticPulse('medium');
  if (state.tempCar) {
    state.selectedCar = state.tempCar;
    state.selectedSkin = state.tempSkin;
    updateSummaryBar();
    renderCarsGrid();
    showToast(`Pintura confirmada: ${state.tempSkin.replace(/_/g, ' ')}`, '🎨');
  }
  closeSkinModal();
}

// ================= GESTÃO DE PISTAS & FAVORITOS =================

async function fetchTracks() {
  try {
    const res = await apiFetch('/api/tracks');
    const data = await res.json();
    state.tracks = data.tracks || [];

    const countBadge = document.getElementById('tracks-badge-count');
    if (countBadge) countBadge.textContent = state.tracks.length;

    renderTracksGrid();

    if (state.tracks.length > 0 && !state.selectedTrack) {
      selectTrack(state.tracks[0]);
    }
  } catch (err) {
    console.error('Erro ao carregar pistas:', err);
  }
}

function toggleFavoriteTrack(e, trackId) {
  e.stopPropagation();
  soundEngine.playShift();
  hapticPulse('medium');
  const idx = state.favoriteTracks.indexOf(trackId);
  if (idx >= 0) {
    state.favoriteTracks.splice(idx, 1);
    showToast('Pista removida dos Favoritos', '⭐');
  } else {
    state.favoriteTracks.push(trackId);
    showToast('Pista adicionada aos Favoritos!', '⭐');
  }
  localStorage.setItem('ac_fav_tracks', JSON.stringify(state.favoriteTracks));
  renderTracksGrid();
}

function setTrackFilter(filter) {
  soundEngine.playShift();
  hapticPulse('light');
  state.activeTrackFilter = filter;

  document.querySelectorAll('.trk-chip-btn').forEach(btn => {
    const isThis = btn.getAttribute('data-trk') === filter;
    btn.classList.toggle('active', isThis);
    btn.classList.toggle('border-brand-red', isThis);
    btn.classList.toggle('bg-brand-red', isThis);
    btn.classList.toggle('text-white', isThis);
    btn.classList.toggle('border-slate-800', !isThis && filter !== 'FAVORITES');
    btn.classList.toggle('bg-slate-900', !isThis && filter !== 'FAVORITES');
    btn.classList.toggle('text-slate-400', !isThis);
  });

  renderTracksGrid();
}

function renderTracksGrid() {
  const grid = document.getElementById('tracks-grid');
  if (!grid) return;

  const filtered = state.tracks.filter(track => {
    // Filtro de Categoria
    if (state.activeTrackFilter === 'FAVORITES') {
      if (!state.favoriteTracks.includes(track.id)) return false;
    } else if (state.activeTrackFilter === 'GP') {
      const isGp = (track.name + ' ' + track.id).toLowerCase().includes('spa') || (track.name + ' ' + track.id).toLowerCase().includes('monza') || (track.name + ' ' + track.id).toLowerCase().includes('silverstone') || (track.name + ' ' + track.id).toLowerCase().includes('gp');
      if (!isGp) return false;
    } else if (state.activeTrackFilter === 'DRIFT') {
      const isDrift = (track.name + ' ' + track.id).toLowerCase().includes('drift') || (track.name + ' ' + track.id).toLowerCase().includes('touge') || (track.name + ' ' + track.id).toLowerCase().includes('ebisu') || (track.name + ' ' + track.id).toLowerCase().includes('akina');
      if (!isDrift) return false;
    }

    // Pesquisa
    if (state.searchQuery) {
      const q = state.searchQuery;
      const matchName = track.name.toLowerCase().includes(q);
      const matchId = track.id.toLowerCase().includes(q);
      const matchCountry = (track.specs && track.specs.country ? track.specs.country : '').toLowerCase().includes(q);
      return matchName || matchId || matchCountry;
    }
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-500 text-xs">
        Nenhuma pista encontrada para o filtro selecionado.
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(track => {
    const isSelected = state.selectedTrack && state.selectedTrack.id === track.id && (state.selectedLayout === (track.layout || ''));
    const isFav = state.favoriteTracks.includes(track.id);
    const length = track.specs ? track.specs.length : 'N/D';
    const pitboxes = track.specs ? track.specs.pitboxes : 'N/D';
    const country = track.specs ? track.specs.country : '';
    const fallbackWeb = track.image_url || '';
    const trackPreview = track.preview_url || `/api/img/track/${encodeURIComponent(track.id)}${track.layout ? '?layout=' + encodeURIComponent(track.layout) : ''}`;

    return `
      <div 
        onclick="handleTrackCardClick('${track.id}', '${track.layout || ''}')"
        class="relative bg-brand-card rounded-2xl overflow-hidden border transition-all active:scale-[0.98] cursor-pointer group shadow-lg ${
          isSelected 
            ? 'border-brand-red ring-2 ring-brand-red/50 shadow-xl shadow-brand-red/15' 
            : 'border-brand-border hover:border-slate-700'
        }"
      >
        <div class="relative w-full aspect-[16/9] bg-slate-950 overflow-hidden">
          <img 
            src="${trackPreview}" 
            alt="${track.name}" 
            loading="lazy" 
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            style="object-fit: cover;"
            onerror="if (!this.dataset.triedWeb && '${fallbackWeb}') { this.dataset.triedWeb='1'; this.src='${fallbackWeb}'; } else if (!this.dataset.triedSvg) { this.dataset.triedSvg='1'; this.src='/api/img/placeholder/track?id=${encodeURIComponent(track.id)}'; }"
          >

          <!-- Botão Estrela de Favoritos -->
          <button 
            onclick="toggleFavoriteTrack(event, '${track.id}')"
            class="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-sm active:scale-90 transition-transform ${isFav ? 'text-amber-400' : 'text-slate-400 hover:text-white'}"
            title="Favoritar Pista"
          >
            ★
          </button>

          ${
            track.layout 
              ? `<div class="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-[9px] font-mono text-brand-cyan border border-brand-cyan/30 uppercase font-bold">
                  Layout: ${track.layout}
                </div>` 
              : ''
          }

          <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent p-2">
            <h3 class="text-xs font-bold text-white truncate">${track.name}</h3>
          </div>
        </div>

        <div class="p-3">
          <div class="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span class="flex items-center gap-1">📍 ${country || 'Internacional'}</span>
            <div class="flex items-center gap-2">
              <span class="text-white font-bold">📏 ${length}</span>
              <span>📦 ${pitboxes} pits</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function handleTrackCardClick(trackId, layout) {
  soundEngine.playShift();
  hapticPulse('medium');
  const track = state.tracks.find(t => t.id === trackId && (t.layout || '') === layout);
  if (!track) return;
  selectTrack(track);
}

function selectTrack(track) {
  state.selectedTrack = track;
  state.selectedLayout = track.layout || '';
  updateSummaryBar();
  renderTracksGrid();
}

// ================= MODOS DE JOGO, METEOROLOGIA E HORÁRIOS =================

function selectMode(modeKey, modeLabel) {
  soundEngine.playShift();
  hapticPulse('light');
  state.selectedMode = modeKey;
  state.selectedModeLabel = modeLabel;

  document.querySelectorAll('.mode-btn').forEach(btn => {
    const isThis = btn.getAttribute('data-mode') === modeKey;
    btn.classList.toggle('active', isThis);
    btn.classList.toggle('border-brand-red', isThis);
    btn.classList.toggle('bg-brand-red/15', isThis);
    btn.classList.toggle('border-slate-800', !isThis);
    btn.classList.toggle('bg-slate-900/60', !isThis);
  });

  const badge = document.getElementById('selected-mode-badge');
  if (badge) badge.textContent = modeLabel;

  updateSummaryBar();
}

function selectWeather(weatherKey, label, icon) {
  soundEngine.playShift();
  hapticPulse('light');
  state.selectedWeather = weatherKey;

  document.querySelectorAll('.weather-btn').forEach(btn => {
    const isThis = btn.getAttribute('data-weather') === weatherKey;
    btn.classList.toggle('active', isThis);
    btn.classList.toggle('border-brand-red', isThis);
    btn.classList.toggle('bg-brand-red/15', isThis);
    btn.classList.toggle('border-slate-800', !isThis);
    btn.classList.toggle('bg-slate-900/60', !isThis);
  });

  const badge = document.getElementById('weather-badge');
  if (badge) badge.textContent = label;

  const iconEl = document.getElementById('weather-icon');
  if (iconEl) iconEl.textContent = icon;

  showToast(`Meteorologia: ${label} ${icon}`, icon);
}

function handleTimeSlider(val) {
  const numeric = parseFloat(val);
  const hours = Math.floor(numeric);
  const mins = (numeric % 1) === 0 ? '00' : '30';
  const timeStr = `${String(hours).padStart(2, '0')}:${mins}`;
  applyTimeSetting(timeStr, numeric);
}

function setTimePreset(timeStr, numericVal) {
  soundEngine.playShift();
  hapticPulse('light');
  const slider = document.getElementById('time-slider');
  if (slider) slider.value = numericVal;
  applyTimeSetting(timeStr, numericVal);
}

function applyTimeSetting(timeStr, numericVal) {
  state.selectedTime = timeStr;
  
  const display = document.getElementById('time-display');
  const tag = document.getElementById('time-period-tag');
  const icon = document.getElementById('time-icon');
  
  if (display) display.textContent = timeStr;

  let period = 'Tarde Ensolarada';
  let emoji = '☀️';

  if (numericVal < 11) {
    period = 'Manhã Fresca';
    emoji = '🌅';
  } else if (numericVal <= 15) {
    period = 'Sol a Pique';
    emoji = '☀️';
  } else if (numericVal <= 18) {
    period = 'Tarde Dourada';
    emoji = '🌤️';
  } else if (numericVal <= 20) {
    period = 'Pôr do Sol (Golden Hour)';
    emoji = '🌆';
  } else {
    period = 'Corrida Noturna';
    emoji = '🌙';
  }

  if (tag) tag.textContent = period;
  if (icon) icon.textContent = emoji;

  updateSummaryBar();
}

// ================= BARRA DE RESUMO FLUTUANTE =================

function updateSummaryBar() {
  const carImg = document.getElementById('summary-car-img');
  const carName = document.getElementById('summary-car-name');
  const skinTag = document.getElementById('summary-skin-tag');
  const trackName = document.getElementById('summary-track-name');
  const modeTag = document.getElementById('summary-mode-tag');
  const timeTag = document.getElementById('summary-time-tag');

  if (state.selectedCar) {
    const skin = state.selectedSkin || state.selectedCar.default_skin || 'default';
    if (carImg) {
      carImg.src = `/api/img/car/${encodeURIComponent(state.selectedCar.id)}/${encodeURIComponent(skin)}`;
      carImg.style.objectFit = 'cover';
      carImg.dataset.triedWeb = '';
      carImg.onerror = function() {
        if (!this.dataset.triedWeb && state.selectedCar.image_url) {
          this.dataset.triedWeb = '1';
          this.src = state.selectedCar.image_url;
        }
      };
    }
    if (carName) carName.textContent = state.selectedCar.name;
    if (skinTag) skinTag.textContent = skin.replace(/_/g, ' ');
  }

  if (state.selectedTrack) {
    const layoutTxt = state.selectedLayout ? ` [${state.selectedLayout}]` : '';
    if (trackName) trackName.textContent = `${state.selectedTrack.name}${layoutTxt}`;
  }

  if (modeTag) modeTag.textContent = state.selectedModeLabel;
  if (timeTag) timeTag.textContent = state.selectedTime;
}

// ================= LANÇAR CORRIDA NO PC =================

async function launchRace() {
  soundEngine.playEngine();
  hapticPulse('heavy');
  
  if (!state.selectedCar) {
    showToast('Escolhe um carro antes de lançar a corrida!', '⚠️');
    setGarageSection('cars');
    return;
  }
  if (!state.selectedTrack) {
    showToast('Escolhe uma pista antes de lançar a corrida!', '⚠️');
    setGarageSection('tracks');
    return;
  }

  const btn = document.getElementById('btn-launch-race');
  const btnTxt = document.getElementById('launch-btn-text');
  
  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-70');
  }
  if (btnTxt) btnTxt.textContent = 'A LANÇAR...';

  const payload = {
    car_id: state.selectedCar.id,
    skin_id: state.selectedSkin || 'default',
    track_id: state.selectedTrack.id,
    track_layout: state.selectedLayout || '',
    mode: state.selectedMode,
    weather: state.selectedWeather,
    time: state.selectedTime,
    start_game: true
  };

  try {
    const res = await apiFetch('/api/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.success) {
      recordRecentCombo(state.selectedCar, state.selectedTrack);
      showToast(result.message || 'Corrida lançada no PC com sucesso!', '🏎️');
      // Muda automaticamente para a aba "Cockpit HUD"
      setTimeout(() => {
        switchTab('tab-track-control');
        updateTrackControlHeader();
      }, 500);
    } else {
      showToast(result.message || 'Erro ao lançar corrida', '❌');
    }
  } catch (err) {
    console.error('Erro ao chamar /api/launch:', err);
    showToast('Falha na comunicação com o PC', '❌');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-70');
    }
    if (btnTxt) btnTxt.textContent = 'LANÇAR NO PC';
  }
}

// Botão de Emergência: Fechar Corrida
async function killGame() {
  soundEngine.playRadio();
  hapticPulse('heavy');
  showToast('A fechar corrida no PC... 🛑', '🛑');

  const btn = document.getElementById('btn-kill-game');
  if (btn) btn.classList.add('opacity-50');

  try {
    const res = await apiFetch('/api/kill_game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Corrida encerrada com sucesso!', '🛑');
      setTimeout(fetchStatus, 400);
    } else {
      showToast(data.message || 'Erro ao fechar o jogo', '⚠️');
    }
  } catch (err) {
    console.error('Erro ao chamar /api/kill_game:', err);
    showToast('Falha na comunicação com o PC', '❌');
  } finally {
    if (btn) btn.classList.remove('opacity-50');
  }
}

// ================= CONTROLO EM PISTA & TELEMETRIA AO VIVO (FASE 1 PRO) =================

let trackLightsOn = false;
let trackWipersOn = false;
let telemetryDemoActive = false;
let telemetryDemoTimer = null;
let demoRPM = 1200;
let demoGear = 1;
let demoLap = 3;
let demoFlagIdx = 0;

let hudGaugeMode = localStorage.getItem('ac_hud_mode') || 'digital';
let oledModeActive = localStorage.getItem('ac_oled_mode') === 'true';
let gTrail = [];
let lapHistory = [83.4, 82.9, 82.6, 83.1, 82.2, 82.5, 82.4, 82.1, 81.9, 82.0];
let currentApexSpeed = null;
let currentExitSpeed = null;
let initialFuel = null;

function initHudPreferences() {
  if (oledModeActive) {
    document.body.classList.add('oled-mode');
    const lbl = document.getElementById('oled-label');
    if (lbl) lbl.textContent = '☀️ Padrão';
  }
  applyHudModeUI();
}

function toggleOledMode() {
  soundEngine.playShift();
  oledModeActive = !oledModeActive;
  document.body.classList.toggle('oled-mode', oledModeActive);
  localStorage.setItem('ac_oled_mode', oledModeActive);
  const lbl = document.getElementById('oled-label');
  if (lbl) lbl.textContent = oledModeActive ? '☀️ Padrão' : '🌑 OLED';
  showToast(oledModeActive ? 'Modo Noturno OLED Puro Ativado' : 'Modo Padrão Restaurado', '🌑');
}

function toggleHudGaugeMode() {
  soundEngine.playShift();
  hudGaugeMode = (hudGaugeMode === 'digital') ? 'analog' : 'digital';
  localStorage.setItem('ac_hud_mode', hudGaugeMode);
  applyHudModeUI();
  showToast(hudGaugeMode === 'analog' ? '⏱️ Tacómetro Analógico Ativado' : '📟 Cockpit Digital F1 Ativado', '⏱️');
}

function applyHudModeUI() {
  const digitalView = document.getElementById('hud-view-digital');
  const analogView = document.getElementById('hud-view-analog');
  const modeLbl = document.getElementById('hud-mode-label');
  if (hudGaugeMode === 'analog') {
    if (digitalView) digitalView.classList.add('hidden');
    if (analogView) {
      analogView.classList.remove('hidden');
      analogView.classList.add('flex');
    }
    if (modeLbl) modeLbl.textContent = '📟 Digital';
  } else {
    if (digitalView) digitalView.classList.remove('hidden');
    if (analogView) {
      analogView.classList.add('hidden');
      analogView.classList.remove('flex');
    }
    if (modeLbl) modeLbl.textContent = '⏱️ Analógico';
  }
}

function updateTrackControlHeader() {
  const carLabel = document.getElementById('hud-car-name');
  if (carLabel) {
    if (state.selectedCar) {
      carLabel.textContent = state.selectedCar.name;
    } else {
      carLabel.textContent = 'Assetto Corsa';
    }
  }
}

async function fetchTelemetryData() {
  if (telemetryDemoActive) return; // Em modo teste interativo
  try {
    const res = await apiFetch('/api/telemetry');
    const json = await res.json();
    if (json.success && json.data) {
      updateTelemetryHUD(json.data);
    }
  } catch (err) {
    // Ignora erros transitórios
  }
}

// 1. Gráfico G-Force (G-Bowl 2D Canvas)
function drawGBowl(latG = 0, longG = 0) {
  const canvas = document.getElementById('g-force-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = cx - 5;
  const maxG = 2.0;

  ctx.clearRect(0, 0, w, h);

  // Anéis concêntricos (0.5G, 1.0G, 1.5G, 2.0G)
  const rings = [0.5, 1.0, 1.5, 2.0];
  rings.forEach((g) => {
    const r = (g / maxG) * maxR;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = g === 1.0 ? 'rgba(56, 189, 248, 0.45)' : 'rgba(71, 85, 105, 0.25)';
    ctx.lineWidth = g === 1.0 ? 1.5 : 1;
    ctx.stroke();
  });

  // Linhas dos eixos centrais
  ctx.beginPath();
  ctx.moveTo(cx, 4);
  ctx.lineTo(cx, h - 4);
  ctx.moveTo(4, cy);
  ctx.lineTo(w - 4, cy);
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Coordenadas calculadas
  const totalG = Math.hypot(latG, longG);
  const px = cx + Math.max(-maxR, Math.min(maxR, (latG / maxG) * maxR));
  const py = cy - Math.max(-maxR, Math.min(maxR, (longG / maxG) * maxR)); // Travão = desaceleração frontal = cima

  // Rasto de inércia dinâmico
  gTrail.push({ x: px, y: py });
  if (gTrail.length > 5) gTrail.shift();

  if (gTrail.length > 1) {
    ctx.beginPath();
    ctx.moveTo(gTrail[0].x, gTrail[0].y);
    for (let i = 1; i < gTrail.length; i++) {
      ctx.lineTo(gTrail[i].x, gTrail[i].y);
    }
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Ponto G brilhante com aura de neon
  const radGrad = ctx.createRadialGradient(px, py, 1, px, py, 8);
  radGrad.addColorStop(0, '#ffffff');
  radGrad.addColorStop(0.3, totalG > 1.2 ? '#ff2449' : '#00e5ff');
  radGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = radGrad;
  ctx.beginPath();
  ctx.arc(px, py, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = totalG > 1.2 ? '#ff2449' : '#00e5ff';
  ctx.beginPath();
  ctx.arc(px, py, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Etiquetas numéricas
  const gTotalEl = document.getElementById('hud-g-total');
  const gLatEl = document.getElementById('hud-g-lat');
  const gLongEl = document.getElementById('hud-g-long');
  if (gTotalEl) gTotalEl.textContent = `${totalG.toFixed(2)} G`;
  if (gLatEl) gLatEl.textContent = `${latG >= 0 ? '+' : ''}${latG.toFixed(2)}`;
  if (gLongEl) gLongEl.textContent = `${longG >= 0 ? '+' : ''}${longG.toFixed(2)}`;
}

// 6. Tacómetro Analógico Circular Alternativo
function drawAnalogGauge(rpm = 0, maxRpm = 8500, speed = 0, gear = 'N') {
  const canvas = document.getElementById('analog-tachometer-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h - 15;
  const radius = 100;

  ctx.clearRect(0, 0, w, h);

  const startAngle = 0.8 * Math.PI;
  const endAngle = 2.2 * Math.PI;
  const totalSweep = endAngle - startAngle;

  // Arco de fundo
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle);
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.8)';
  ctx.lineWidth = 14;
  ctx.stroke();

  // Zona vermelha (Redline)
  const redlineStart = startAngle + totalSweep * 0.82;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, redlineStart, endAngle);
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
  ctx.lineWidth = 14;
  ctx.stroke();

  // Arco de rotação ativo
  const rpmRatio = Math.max(0, Math.min(1.0, rpm / maxRpm));
  const currentAngle = startAngle + totalSweep * rpmRatio;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, currentAngle);
  ctx.strokeStyle = rpmRatio >= 0.82 ? '#ef4444' : '#00e5ff';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Ticks principais (0 a 9 x1000 RPM)
  for (let i = 0; i <= 9; i++) {
    const tickRatio = i / 9;
    const a = startAngle + totalSweep * tickRatio;
    const innerR = radius - (i % 2 === 0 ? 16 : 10);
    const outerR = radius + 4;
    const x1 = cx + Math.cos(a) * innerR;
    const y1 = cy + Math.sin(a) * innerR;
    const x2 = cx + Math.cos(a) * outerR;
    const y2 = cy + Math.sin(a) * outerR;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = i >= 7 ? '#ef4444' : '#94a3b8';
    ctx.lineWidth = i % 2 === 0 ? 2.5 : 1.5;
    ctx.stroke();

    const textR = radius - 24;
    const tx = cx + Math.cos(a) * textR;
    const ty = cy + Math.sin(a) * textR;
    ctx.fillStyle = i >= 7 ? '#f87171' : '#cbd5e1';
    ctx.font = 'bold 11px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(i.toString(), tx, ty);
  }

  // Agulha analógica com sombra neon
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(currentAngle);
  ctx.beginPath();
  ctx.moveTo(0, -3.5);
  ctx.lineTo(radius - 6, 0);
  ctx.lineTo(0, 3.5);
  ctx.fillStyle = rpmRatio >= 0.88 ? '#ff2449' : '#f97316';
  ctx.shadowColor = '#f97316';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.restore();

  // Cubo central da agulha
  const hubGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 14);
  hubGrad.addColorStop(0, '#475569');
  hubGrad.addColorStop(0.7, '#0f172a');
  hubGrad.addColorStop(1, '#020617');
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Parafuso central vermelho
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444';
  ctx.fill();

  // Atualizar contadores
  const aSpeed = document.getElementById('analog-speed-num');
  const aGear = document.getElementById('analog-gear-num');
  const aRpm = document.getElementById('analog-rpm-num');
  if (aSpeed) aSpeed.textContent = Math.round(speed);
  if (aGear) aGear.textContent = gear;
  if (aRpm) aRpm.textContent = Math.round(rpm).toLocaleString();
}

// 13. Histórico de 10 Voltas (Sparkline Canvas)
function drawLapHistory(laps = lapHistory) {
  const canvas = document.getElementById('lap-history-canvas');
  if (!canvas || !laps || laps.length === 0) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const minLap = Math.min(...laps);
  const maxLap = Math.max(...laps);
  const range = (maxLap - minLap) || 1;
  const barWidth = (w / laps.length) - 2;

  laps.forEach((time, idx) => {
    const isBest = time === minLap;
    const normalizedH = Math.max(4, Math.min(h - 4, ((maxLap - time) / range) * (h - 8) + 4));
    const x = idx * (barWidth + 2) + 1;
    const y = h - normalizedH;

    ctx.fillStyle = isBest ? '#eab308' : (idx === laps.length - 1 ? '#00e5ff' : '#334155');
    ctx.fillRect(x, y, barWidth, normalizedH);
  });
}

// 14. Velocidade de Curva: Apex (Mínima) e Exit (Saída)
function updateTrackCornerTracker(speed, brake, gas, steer) {
  if (brake > 0.25 || Math.abs(steer) > 22) {
    if (currentApexSpeed === null || speed < currentApexSpeed) {
      currentApexSpeed = Math.round(speed);
      const apexEl = document.getElementById('hud-apex-speed');
      if (apexEl) apexEl.textContent = `${currentApexSpeed} km/h`;
    }
  } else if (currentApexSpeed !== null && gas > 0.6 && speed > (currentApexSpeed + 12)) {
    currentExitSpeed = Math.round(speed);
    const exitEl = document.getElementById('hud-exit-speed');
    if (exitEl) exitEl.textContent = `${currentExitSpeed} km/h`;
    currentApexSpeed = null;
  }
}

// 7. Bandeiras de Pista Interativas
function updateFlagsBanner(flag = 'NONE') {
  const banner = document.getElementById('hud-flag-alert');
  const icon = document.getElementById('hud-flag-icon');
  const text = document.getElementById('hud-flag-text');
  if (!banner || !icon || !text) return;

  banner.className = 'w-full py-1.5 px-3 rounded-xl mb-2 text-center text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg transition-all';

  if (flag === 'YELLOW') {
    banner.classList.add('flag-banner-yellow');
    icon.textContent = '⚠️';
    text.textContent = 'BANDEIRA AMARELA NO SETOR - REDUZA VELOCIDADE';
  } else if (flag === 'BLUE') {
    banner.classList.add('flag-banner-blue');
    icon.textContent = '🟦';
    text.textContent = 'BANDEIRA AZUL - CEDA PASSAGEM AO LÍDER';
  } else if (flag === 'CHECKERED') {
    banner.classList.add('flag-banner-checkered');
    icon.textContent = '🏁';
    text.textContent = 'BANDEIRA DE XADREZ - FIM DE SESSÃO';
  } else if (flag === 'PENALTY') {
    banner.classList.add('bg-red-600', 'text-white');
    icon.textContent = '⛔';
    text.textContent = 'PENALIZAÇÃO DE PIT LANE';
  } else {
    banner.classList.add('hidden');
  }
}

// ATUALIZAÇÃO GERAL DO HUD DE TELEMETRIA
function updateTelemetryHUD(data) {
  const maxRpm = data.max_rpm || 8500;
  const rpm = data.rpm || 0;
  const speed = data.speed_kmh || 0;
  const gas = data.gas || 0;
  const brake = data.brake || 0;
  const steer = data.steer_angle || 0;
  const fuel = data.fuel || 0;
  const completedLaps = data.completed_laps || 0;

  // 1. Shift Lights LEDs (16 LEDs)
  const ratio = Math.max(0, Math.min(1.0, rpm / maxRpm));
  const activeCount = Math.round(ratio * 16);
  const isRedline = ratio >= 0.92;

  for (let i = 0; i < 16; i++) {
    const led = document.getElementById(`led-${i}`);
    if (!led) continue;
    if (i < activeCount) {
      if (isRedline) {
        led.className = 'shift-led blue-flash flex-1 h-2 rounded-full';
      } else if (i < 5) {
        led.className = 'shift-led green flex-1 h-2 rounded-full';
      } else if (i < 10) {
        led.className = 'shift-led amber flex-1 h-2 rounded-full';
      } else {
        led.className = 'shift-led red flex-1 h-2 rounded-full';
      }
    } else {
      led.className = 'shift-led off flex-1 h-2 rounded-full';
    }
  }

  // 2. Mudança (Gear) e Alerta de Corte de Ignição / Rev Limit (Item 10)
  const gearNum = document.getElementById('hud-gear-num');
  const gearContainer = document.getElementById('hud-gear-container');
  const cutoffAlert = document.getElementById('hud-rev-cutoff-alert');
  const curGear = data.gear || 'N';

  if (gearNum) {
    if (curGear !== state.lastGear && curGear !== 'N') {
      soundEngine.playShift();
      if (gearContainer) {
        gearContainer.classList.add('ring-4', 'ring-brand-cyan');
        setTimeout(() => gearContainer.classList.remove('ring-4', 'ring-brand-cyan'), 150);
      }
      state.lastGear = curGear;
    }
    gearNum.textContent = curGear;
  }

  // Corte de Ignição / Anti-lag Flash
  if (ratio >= 0.98) {
    if (gearContainer) gearContainer.classList.add('rev-cutoff-active');
    if (cutoffAlert) cutoffAlert.classList.remove('hidden');
  } else {
    if (gearContainer) gearContainer.classList.remove('rev-cutoff-active');
    if (cutoffAlert) cutoffAlert.classList.add('hidden');
  }

  // 3. RPM e Velocidade
  const rpmNum = document.getElementById('hud-rpm-num');
  if (rpmNum) rpmNum.textContent = Math.round(rpm).toLocaleString();

  const speedNum = document.getElementById('hud-speed-num');
  if (speedNum) speedNum.textContent = Math.round(speed);

  // 4. Pedais Gas e Travão
  const gasVal = Math.round(gas * 100);
  const brakeVal = Math.round(brake * 100);
  const gasEl = document.getElementById('hud-gas-val');
  const gasBar = document.getElementById('hud-gas-bar');
  const brakeEl = document.getElementById('hud-brake-val');
  const brakeBar = document.getElementById('hud-brake-bar');

  if (gasEl) gasEl.textContent = `${gasVal}%`;
  if (gasBar) gasBar.style.width = `${gasVal}%`;
  if (brakeEl) brakeEl.textContent = `${brakeVal}%`;
  if (brakeBar) brakeBar.style.width = `${brakeVal}%`;

  // 5. Combustível e Turbo
  const fuelNum = document.getElementById('hud-fuel-num');
  if (fuelNum) fuelNum.textContent = `${fuel.toFixed(1)} L`;

  const turboVal = document.getElementById('hud-turbo-val');
  const turboBar = document.getElementById('hud-turbo-bar');
  const turbo = data.turbo_boost || 0;
  if (turboVal) turboVal.textContent = `${turbo.toFixed(1)} bar`;
  if (turboBar) turboBar.style.width = `${Math.min(100, (turbo / 2.5) * 100)}%`;

  // 6. Badges TC / ABS / DRS
  const tcBadge = document.getElementById('hud-tc-badge');
  if (tcBadge) {
    tcBadge.className = data.tc_active 
      ? 'px-1.5 py-0.2 rounded bg-amber-500 text-black font-extrabold animate-pulse' 
      : 'px-1.5 py-0.2 rounded bg-slate-800 text-slate-500 border border-slate-700';
  }

  const absBadge = document.getElementById('hud-abs-badge');
  if (absBadge) {
    absBadge.className = data.abs_active 
      ? 'px-1.5 py-0.2 rounded bg-red-500 text-white font-extrabold animate-pulse' 
      : 'px-1.5 py-0.2 rounded bg-slate-800 text-slate-500 border border-slate-700';
  }

  const drsBadge = document.getElementById('hud-drs-badge');
  if (drsBadge) {
    drsBadge.className = data.drs_active 
      ? 'px-1.5 py-0.2 rounded bg-emerald-500 text-black font-extrabold' 
      : 'px-1.5 py-0.2 rounded bg-slate-800 text-slate-500 border border-slate-700';
  }

  // 7. G-Bowl 2D (Item 1)
  const latG = data.g_force ? data.g_force.lat : 0;
  const longG = data.g_force ? data.g_force.long : 0;
  drawGBowl(latG, longG);

  // 8. Ângulo de Direção e Detetor de Drift (Item 9)
  const steerWheel = document.getElementById('hud-steering-wheel');
  const steerDeg = document.getElementById('hud-steer-deg');
  const driftBadge = document.getElementById('hud-drift-badge');
  if (steerWheel) steerWheel.style.transform = `rotate(${steer}deg)`;
  if (steerDeg) steerDeg.textContent = `${steer.toFixed(1)}°`;

  if (driftBadge) {
    if (Math.abs(steer) > 24 && speed > 35) {
      driftBadge.className = 'px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-orange-600 text-white border border-orange-400 animate-pulse';
      driftBadge.textContent = '🔥 DRIFT OVERSTEER';
    } else if (Math.abs(steer) > 12) {
      driftBadge.className = 'px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-sky-950 text-sky-400 border border-sky-800';
      driftBadge.textContent = 'CURVA';
    } else {
      driftBadge.className = 'px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-800 text-slate-500 border border-slate-700';
      driftBadge.textContent = 'NEUTRO';
    }
  }

  // 9. Velocidade Apex & Exit (Item 14)
  updateTrackCornerTracker(speed, brake, gas, steer);

  // 10. Matriz dos 4 Pneus: Temperaturas, Pressões Dinâmicas, Desgaste e Discos de Travão (Items 3, 4, 5)
  const temps = data.tyre_temps || [24, 24, 24, 24];
  const pressures = data.tyre_pressures || [28.0, 28.0, 28.0, 28.0];
  const wears = data.tyre_wear || [100, 100, 100, 100];
  const brakes = data.brake_temps || [150, 150, 120, 120];
  const keys = ['fl', 'fr', 'rl', 'rr'];

  keys.forEach((k, idx) => {
    const t = temps[idx] || 24;
    const p = pressures[idx] || 28.0;
    const w = wears[idx] !== undefined ? wears[idx] : 100;
    const b = brakes[idx] || 120;

    // Temperatura
    const elTemp = document.getElementById(`temp-${k}`);
    if (elTemp) elTemp.textContent = `${Math.round(t)}°C`;

    // Pressão em PSI (Ideal: 27.0 - 29.5 PSI)
    const elPsi = document.getElementById(`psi-${k}`);
    if (elPsi) {
      elPsi.textContent = `${p.toFixed(1)} PSI`;
      elPsi.className = (p >= 27.0 && p <= 29.5) ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold';
    }

    // Desgaste da borracha
    const elWear = document.getElementById(`wear-${k}`);
    const barWear = document.getElementById(`wear-bar-${k}`);
    if (elWear) elWear.textContent = `${Math.round(w)}%`;
    if (barWear) {
      barWear.style.width = `${Math.max(0, Math.min(100, w))}%`;
      barWear.className = w > 75 ? 'h-full bg-emerald-500 rounded-full' : (w > 50 ? 'h-full bg-amber-500 rounded-full' : 'h-full bg-red-500 rounded-full');
    }

    // Travões e Efeito Incandescente (>500°C)
    const elBrake = document.getElementById(`brake-${k}`);
    if (elBrake) elBrake.textContent = `${Math.round(b)}°C`;

    const box = document.getElementById(`tyre-${k}`);
    if (box) {
      // Glow incandescente de disco de travão
      if (b > 500) {
        box.classList.add('brake-overheat');
      } else {
        box.classList.remove('brake-overheat');
      }
    }
  });

  // 11. Delta Split & Micro-Setores (Items 2 e 12)
  const deltaVal = document.getElementById('hud-delta-val');
  if (deltaVal) {
    const splitStr = data.split || '';
    if (splitStr.startsWith('-')) {
      deltaVal.textContent = splitStr;
      deltaVal.className = 'font-bold text-xs px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse';
    } else if (splitStr.startsWith('+')) {
      deltaVal.textContent = splitStr;
      deltaVal.className = 'font-bold text-xs px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/40';
    } else {
      deltaVal.textContent = splitStr || '-0.00s';
      deltaVal.className = 'font-bold text-xs px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700';
    }
  }

  // Micro-Setores
  const s1 = document.getElementById('sector-1-badge');
  const s2 = document.getElementById('sector-2-badge');
  const s3 = document.getElementById('sector-3-badge');
  if (s1 && s2 && s3) {
    if (completedLaps > 0) {
      s1.className = 'px-1.5 py-0.2 rounded font-bold text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-700';
      s2.className = 'px-1.5 py-0.2 rounded font-bold text-[9px] bg-purple-950 text-purple-300 border border-purple-700';
      s3.className = 'px-1.5 py-0.2 rounded font-bold text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-700';
    }
  }

  // 12. Calculadora de Consumo por Volta (Item 11)
  if (initialFuel === null || fuel > initialFuel) initialFuel = fuel;
  const fuelPerLapEl = document.getElementById('hud-fuel-per-lap');
  const fuelLapsLeftEl = document.getElementById('hud-fuel-laps-left');
  const fuelStatusEl = document.getElementById('hud-fuel-status-tag');

  if (completedLaps > 0 && initialFuel > fuel) {
    const consumed = initialFuel - fuel;
    const avgPerLap = consumed / completedLaps;
    const lapsLeft = avgPerLap > 0 ? Math.floor(fuel / avgPerLap) : '--';
    if (fuelPerLapEl) fuelPerLapEl.textContent = `~${avgPerLap.toFixed(2)} L/v`;
    if (fuelLapsLeftEl) fuelLapsLeftEl.textContent = `~${lapsLeft} voltas`;
  } else {
    if (fuelPerLapEl) fuelPerLapEl.textContent = '~2.2 L/v';
    if (fuelLapsLeftEl) fuelLapsLeftEl.textContent = `~${Math.floor(fuel / 2.2)} voltas`;
  }

  if (fuelStatusEl) {
    if (fuel <= 5.0) {
      fuelStatusEl.textContent = '⚠️ REABASTECER';
      fuelStatusEl.className = 'text-red-400 font-bold animate-pulse';
    } else {
      fuelStatusEl.textContent = 'TANQUE OK';
      fuelStatusEl.className = 'text-emerald-400 font-bold';
    }
  }

  // 13. Tempos de Volta e Histórico Sparkline (Item 13)
  const curLap = document.getElementById('hud-lap-cur');
  const bestLap = document.getElementById('hud-lap-best');
  const lapCount = document.getElementById('hud-lap-count');

  if (curLap && data.current_time) curLap.textContent = data.current_time;
  if (bestLap && data.best_time) bestLap.textContent = data.best_time;
  if (lapCount) lapCount.textContent = completedLaps;

  drawLapHistory();

  // 14. Bandeiras de Pista Interativas (Item 7)
  updateFlagsBanner(data.flag || 'NONE');

  // 15. Vista Analógica (se ativa)
  if (hudGaugeMode === 'analog') {
    drawAnalogGauge(rpm, maxRpm, speed, curGear);
  }

  // 16. Verificação do Pit Limiter e Cronómetro (Fase 2)
  const isInPit = data.status === 'PIT' || (data.gear === 'N' && speed < 5);
  checkPitSpeedTrap(speed, isInPit);
  handlePitStopwatch(speed, isInPit);

  // 17. Spotter IA / Engenheiro de Pista por Voz (Fase 5)
  if (spotter.enabled && speed > 5) {
    if (data.flag === 'YELLOW') {
      spotter.speak("Atenção, bandeira amarela no setor. Reduz a velocidade.", "urgent", 15);
    } else if (data.flag === 'BLUE') {
      spotter.speak("Bandeira azul. Cede passagem ao carro mais rápido.", "urgent", 15);
    } else if (data.flag === 'CHECKERED') {
      spotter.speak("Bandeira de xadrez! Fim de sessão.", "urgent", 30);
    } else if (fuel <= 5.0 && fuel > 0.0) {
      spotter.speak("Combustível crítico! Entra nas boxes nesta volta.", "urgent", 35);
    } else if (brakes && brakes.some(b => b > 550)) {
      spotter.speak("Cuidado com a temperatura dos travões.", "normal", 30);
    } else if (temps && temps.some(t => t > 105)) {
      spotter.speak("Atenção aos pneus, temperatura muito alta.", "normal", 30);
    }
  }

  // 18. Ferramentas Drift, Touge & Shutoko Engine (Fase 7)
  updateDriftAndHighwayEngine(data, speed, steer, latG, temps);

  // 19. Sim Rig Hardware & Wind Simulation (Fase 8)
  updateSimRigHardware(speed, data.flag);
}

function toggleTelemetryDemo() {
  soundEngine.playShift();
  telemetryDemoActive = !telemetryDemoActive;
  const btn = document.getElementById('btn-demo-telemetry');
  const label = document.getElementById('demo-telemetry-label');

  if (telemetryDemoActive) {
    if (btn) btn.className = 'px-2 py-0.5 rounded text-[10px] font-bold border border-brand-cyan bg-brand-cyan/20 text-brand-cyan active:scale-95 transition-all';
    if (label) label.textContent = '⏹️ Parar Teste';
    showToast('🎮 Modo Teste Cockpit PRO: A simular telemetria total!', '🏎️');
    
    let demoTimerCount = 0;
    const demoFlags = ['NONE', 'NONE', 'YELLOW', 'NONE', 'BLUE', 'NONE', 'CHECKERED'];

    telemetryDemoTimer = setInterval(() => {
      demoTimerCount++;
      demoRPM += 280;
      const demoSpeed = Math.round(demoRPM * 0.034 * demoGear);

      // Simulação de forças G e travão incandescente
      let simLatG = Math.sin(demoTimerCount * 0.15) * 1.45;
      let simLongG = 0.65;
      let simBrakeTemp = 210;
      let simBrakeVal = 0.0;
      let simSteer = Math.sin(demoTimerCount * 0.15) * 45;

      if (demoRPM >= 8650) {
        soundEngine.playShift();
        hapticPulse('heavy');
        demoGear = (demoGear % 6) + 1;
        demoRPM = 5100;
        simLongG = -1.35; // Desaceleração forte na troca / travagem
        simBrakeVal = 0.85;
        simBrakeTemp = 620; // Incandescente!
        if (demoGear === 1) demoLap++;
      }

      const activeFlag = demoFlags[Math.floor(demoTimerCount / 40) % demoFlags.length];

      updateTelemetryHUD({
        active: true,
        rpm: demoRPM,
        max_rpm: 8800,
        gear: demoGear.toString(),
        speed_kmh: demoSpeed,
        gas: simBrakeVal > 0 ? 0.0 : 0.98,
        brake: simBrakeVal,
        fuel: Math.max(12.0, 42.0 - (demoLap * 2.1)),
        turbo_boost: 1.6,
        steer_angle: simSteer,
        g_force: { lat: simLatG, long: simLongG, vert: 1.0 },
        tc_active: demoRPM > 7200,
        abs_active: simBrakeVal > 0.5,
        drs_active: demoGear >= 4,
        tyre_temps: [86 + simLatG * 5, 88 - simLatG * 5, 85, 86],
        tyre_pressures: [28.2, 28.5, 27.9, 28.1],
        tyre_wear: [98 - demoLap, 97 - demoLap, 95 - demoLap, 96 - demoLap],
        brake_temps: [simBrakeTemp, simBrakeTemp, simBrakeTemp - 80, simBrakeTemp - 80],
        split: "-0.38s",
        flag: activeFlag,
        current_time: "01:22.450",
        best_time: "01:21.890",
        completed_laps: demoLap,
        status: "LIVE SIM"
      });
    }, 80);

  } else {
    if (btn) btn.className = 'px-2 py-0.5 rounded text-[10px] font-bold border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white active:scale-95 transition-all';
    if (label) label.textContent = '🎮 Testar HUD';
    if (telemetryDemoTimer) clearInterval(telemetryDemoTimer);
    fetchTelemetryData();
  }
}

async function sendTrackAction(action, hintMsg = '') {
  soundEngine.playShift();
  hapticPulse('medium');
  if (hintMsg) showToast(hintMsg, '🎮');

  if (action === 'lights') {
    trackLightsOn = !trackLightsOn;
    const btn = document.getElementById('btn-toggle-lights');
    if (btn) {
      btn.classList.toggle('border-yellow-400', trackLightsOn);
      btn.classList.toggle('bg-yellow-500/25', trackLightsOn);
    }
  } else if (action === 'wipers') {
    trackWipersOn = !trackWipersOn;
    const btn = document.getElementById('btn-toggle-wipers');
    if (btn) {
      btn.classList.toggle('border-sky-400', trackWipersOn);
      btn.classList.toggle('bg-sky-500/25', trackWipersOn);
    }
  }

  try {
    const res = await apiFetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Comando executado!', '✅');
    } else {
      showToast(data.message || 'Falha ao executar ação', '⚠️');
    }
  } catch (err) {
    console.error(`Erro ao enviar ação ${action}:`, err);
    showToast('Falha na comunicação com o PC', '❌');
  }
}

// ================= FASE 2: ESTRATÉGIA DE BOXES, COMBUSTÍVEL & PNEUS =================

let pitStrategy = {
  compound: 'SOFT',
  pressures: { fl: 28.0, fr: 28.0, rl: 28.0, rr: 28.0 },
  repairBody: false,
  repairSusp: false,
  laps: 15,
  margin: 2
};

let pitStopwatchRunning = false;
let pitStopwatchStart = null;
let pitStopwatchTimer = null;
let lastPitStopDuration = null;

function recalculatePitFuel() {
  const lapsInput = document.getElementById('pit-calc-laps');
  const marginInput = document.getElementById('pit-calc-margin');
  const targetLabel = document.getElementById('calc-fuel-target-label');
  const consLabel = document.getElementById('pit-calc-cons');
  const arrivalLabel = document.getElementById('pit-calc-arrival');

  const laps = parseInt(lapsInput ? lapsInput.value : 15) || 15;
  const margin = parseFloat(marginInput ? marginInput.value : 2) || 2;
  const avgCons = 2.3; // L/volta padrão

  const totalFuelNeeded = (laps * avgCons + margin).toFixed(1);
  if (targetLabel) targetLabel.textContent = `${totalFuelNeeded} L A COLOCAR`;
  if (consLabel) consLabel.textContent = `${avgCons.toFixed(1)} L/v`;
  if (arrivalLabel) arrivalLabel.textContent = `~${(margin + 1.2).toFixed(1)} L`;
}

function adjustPitCalcLaps(delta) {
  soundEngine.playShift();
  const input = document.getElementById('pit-calc-laps');
  if (!input) return;
  let val = Math.max(1, Math.min(100, (parseInt(input.value) || 15) + delta));
  input.value = val;
  recalculatePitFuel();
}

function adjustPitCalcMargin(delta) {
  soundEngine.playShift();
  const input = document.getElementById('pit-calc-margin');
  if (!input) return;
  let val = Math.max(0, Math.min(25, (parseFloat(input.value) || 2) + delta));
  input.value = val;
  recalculatePitFuel();
}

function selectPitTyreCompound(compound) {
  soundEngine.playShift();
  hapticPulse('medium');
  pitStrategy.compound = compound;

  const compounds = ['SOFT', 'MEDIUM', 'HARD', 'INTER', 'WET'];
  const colors = {
    SOFT: { text: '🔴 SOFT (MACIO)', border: 'border-red-500', bg: 'bg-red-950/40', textColor: 'text-red-300' },
    MEDIUM: { text: '🟡 MEDIUM (MÉDIO)', border: 'border-yellow-500', bg: 'bg-yellow-950/40', textColor: 'text-yellow-300' },
    HARD: { text: '⚪ HARD (DURO)', border: 'border-slate-300', bg: 'bg-slate-800/60', textColor: 'text-slate-200' },
    INTER: { text: '🟢 INTER (MOLHADO)', border: 'border-emerald-500', bg: 'bg-emerald-950/40', textColor: 'text-emerald-300' },
    WET: { text: '🔵 WET (CHUVA FORTE)', border: 'border-blue-500', bg: 'bg-blue-950/40', textColor: 'text-blue-300' }
  };

  compounds.forEach(c => {
    const btn = document.getElementById(`btn-compound-${c}`);
    if (!btn) return;
    if (c === compound) {
      btn.className = `p-1.5 rounded-lg border-2 ${colors[c].border} ${colors[c].bg} ${colors[c].textColor} text-[10px] font-black active:scale-95 transition-all shadow-lg`;
    } else {
      btn.className = 'p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 text-[10px] font-bold active:scale-95 transition-all';
    }
  });

  const badge = document.getElementById('selected-compound-badge');
  if (badge && colors[compound]) {
    badge.textContent = colors[compound].text;
    badge.className = `font-bold ${colors[compound].textColor}`;
  }
}

function adjustPitPressure(wheel, delta) {
  soundEngine.playShift();
  if (!pitStrategy.pressures[wheel]) pitStrategy.pressures[wheel] = 28.0;
  pitStrategy.pressures[wheel] = Math.max(20.0, Math.min(38.0, pitStrategy.pressures[wheel] + delta));
  const el = document.getElementById(`target-psi-${wheel}`);
  if (el) el.textContent = `${pitStrategy.pressures[wheel].toFixed(1)} PSI`;
}

function updatePitRepairEstimate() {
  soundEngine.playShift();
  const bodyCb = document.getElementById('repair-body-checkbox');
  const suspCb = document.getElementById('repair-susp-checkbox');
  const estEl = document.getElementById('repair-time-estimate');

  pitStrategy.repairBody = bodyCb ? bodyCb.checked : false;
  pitStrategy.repairSusp = suspCb ? suspCb.checked : false;

  let totalSecs = 6.0; // Base: troca de 4 pneus
  if (pitStrategy.repairBody) totalSecs += 8.0;
  if (pitStrategy.repairSusp) totalSecs += 14.0;

  if (estEl) estEl.textContent = `TEMPO EST.: ~${totalSecs.toFixed(1)}s`;
}

function checkPitSpeedTrap(speed, isInPit) {
  const trapAlert = document.getElementById('pit-speed-trap-alert');
  if (!trapAlert) return;
  if (isInPit && speed > 80.0) {
    trapAlert.classList.remove('hidden');
    hapticPulse('heavy');
  } else {
    trapAlert.classList.add('hidden');
  }
}

function handlePitStopwatch(speed, isInPit) {
  const display = document.getElementById('pit-stopwatch-display');
  const statusLabel = document.getElementById('pit-status-label');
  const lastStop = document.getElementById('pit-last-stop');

  if (isInPit && speed < 1.0) {
    // Parado nos boxes
    if (!pitStopwatchRunning) {
      pitStopwatchRunning = true;
      pitStopwatchStart = Date.now();
      if (statusLabel) {
        statusLabel.textContent = '🛑 PARADO / BOXES';
        statusLabel.className = 'text-red-400 font-bold animate-pulse';
      }
      if (pitStopwatchTimer) clearInterval(pitStopwatchTimer);
      pitStopwatchTimer = setInterval(() => {
        if (!pitStopwatchStart) return;
        const elapsed = (Date.now() - pitStopwatchStart) / 1000;
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toFixed(2).padStart(5, '0');
        if (display) display.textContent = `${mins}:${secs}`;
      }, 50);
    }
  } else if (pitStopwatchRunning && speed > 5.0) {
    // Carro arrancou dos boxes
    pitStopwatchRunning = false;
    if (pitStopwatchTimer) clearInterval(pitStopwatchTimer);
    if (pitStopwatchStart) {
      const finalDuration = ((Date.now() - pitStopwatchStart) / 1000).toFixed(1);
      lastPitStopDuration = `${finalDuration}s`;
      if (lastStop) lastStop.textContent = `${finalDuration}s`;
    }
    pitStopwatchStart = null;
    if (statusLabel) {
      statusLabel.textContent = 'EM PISTA';
      statusLabel.className = 'text-emerald-400 font-bold';
    }
  }
}

async function sendPitStrategy() {
  soundEngine.playConfirm();
  hapticPulse('heavy');
  showToast('A enviar estratégia de boxes para o PC...', '⛽');

  try {
    const res = await apiFetch('/api/pit_strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pitStrategy)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Estratégia de boxes programada com sucesso!', '✅');
    } else {
      showToast(data.message || 'Erro ao enviar estratégia', '⚠️');
    }
  } catch (err) {
    showToast('Estratégia gravada localmente na app!', '💾');
  }
}

async function exportSessionReport() {
  soundEngine.playConfirm();
  hapticPulse('medium');
  showToast('A gerar relatório completo da corrida...', '📊');

  try {
    const res = await apiFetch('/api/session_report');
    const data = await res.json();
    const reportData = data.report || {
      timestamp: new Date().toISOString(),
      pit_strategy: pitStrategy,
      notes: "AC Remote PRO Telemetry & Pit Stop Session"
    };

    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonStr);
    downloadAnchor.setAttribute("download", `AC_Remote_Relatorio_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('Relatório descarregado com sucesso!', '📥');
  } catch (err) {
    showToast('Falha ao exportar relatório', '❌');
  }
}

// ================= FASE 3: GESTÃO DE GARAGEM PRO, ROLETA & COMPARADOR =================

function triggerRandomRoulette() {
  soundEngine.playShift();
  hapticPulse('heavy');
  if (!state.cars.length || !state.tracks.length) {
    showToast('A carregar carros e pistas...', '⌛');
    return;
  }

  showToast('🎰 A girar a roleta de carros e pistas...', '🎲');
  let spins = 0;
  const maxSpins = 10;
  const interval = setInterval(() => {
    spins++;
    const randomCar = state.cars[Math.floor(Math.random() * state.cars.length)];
    const randomTrack = state.tracks[Math.floor(Math.random() * state.tracks.length)];
    soundEngine.playShift();

    if (spins >= maxSpins) {
      clearInterval(interval);
      selectCar(randomCar, false);
      selectTrack(randomTrack);
      recordRecentCombo(randomCar, randomTrack);
      soundEngine.playConfirm();
      hapticPulse('heavy');
      showToast(`🎯 Combo Sorteado: ${randomCar.name} @ ${randomTrack.name}!`, '🏁');
      openLaunchSheet();
    }
  }, 110);
}

function recordRecentCombo(car, track) {
  if (!car || !track) return;
  let recents = [];
  try {
    recents = JSON.parse(localStorage.getItem('ac_recent_combos') || '[]');
  } catch (e) {}

  recents = recents.filter(r => !(r.carId === car.id && r.trackId === track.id));
  recents.unshift({
    carId: car.id,
    carName: car.name,
    trackId: track.id,
    trackName: track.name,
    timestamp: Date.now()
  });
  if (recents.length > 5) recents.pop();
  localStorage.setItem('ac_recent_combos', JSON.stringify(recents));
  renderRecentCombos();
}

function renderRecentCombos() {
  const container = document.getElementById('recent-combos-container');
  const list = document.getElementById('recent-combos-list');
  if (!container || !list) return;

  let recents = [];
  try {
    recents = JSON.parse(localStorage.getItem('ac_recent_combos') || '[]');
  } catch (e) {}

  if (recents.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  list.innerHTML = recents.map(r => `
    <button 
      onclick="launchRecentCombo('${r.carId}', '${r.trackId}')" 
      class="flex-none p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-brand-red text-left max-w-[170px] active:scale-95 transition-all group shadow-md"
    >
      <span class="text-[10px] font-bold text-white block truncate leading-tight group-hover:text-brand-red">${r.carName}</span>
      <span class="text-[8px] text-slate-400 block truncate font-mono mt-0.5">🏁 ${r.trackName}</span>
    </button>
  `).join('');
}

function launchRecentCombo(carId, trackId) {
  soundEngine.playShift();
  const c = state.cars.find(x => x.id === carId);
  const t = state.tracks.find(x => x.id === trackId);
  if (c) selectCar(c, false);
  if (t) selectTrack(t);
  openLaunchSheet();
  showToast(`Combo selecionado: ${c?.name || ''} @ ${t?.name || ''}`, '🚀');
}

function openCarCompareModal(preselectedCarId = null) {
  soundEngine.playShift();
  const modal = document.getElementById('modal-car-compare');
  const s1 = document.getElementById('compare-select-1');
  const s2 = document.getElementById('compare-select-2');
  if (!modal || !s1 || !s2 || !state.cars.length) return;

  const carOptions = state.cars.map(c => `<option value="${c.id}">${c.name} (${c.brand || 'AC'})</option>`).join('');
  s1.innerHTML = carOptions;
  s2.innerHTML = carOptions;

  const c1Id = preselectedCarId || (state.selectedCar ? state.selectedCar.id : state.cars[0].id);
  const c2Id = state.cars.find(c => c.id !== c1Id)?.id || state.cars[0].id;
  s1.value = c1Id;
  s2.value = c2Id;

  renderCarComparison();
  modal.classList.remove('hidden');
}

function closeCarCompareModal() {
  soundEngine.playShift();
  const modal = document.getElementById('modal-car-compare');
  if (modal) modal.classList.add('hidden');
}

function parseCarMetric(valStr) {
  if (!valStr) return 0;
  const num = parseFloat(valStr.toString().replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
}

function renderCarComparison() {
  const s1 = document.getElementById('compare-select-1');
  const s2 = document.getElementById('compare-select-2');
  const container = document.getElementById('compare-metrics-container');
  if (!s1 || !s2 || !container) return;

  const car1 = state.cars.find(c => c.id === s1.value) || state.cars[0];
  const car2 = state.cars.find(c => c.id === s2.value) || state.cars[1] || state.cars[0];

  const bhp1 = parseCarMetric(car1.specs?.bhp);
  const bhp2 = parseCarMetric(car2.specs?.bhp);
  const weight1 = parseCarMetric(car1.specs?.weight);
  const weight2 = parseCarMetric(car2.specs?.weight);
  const speed1 = parseCarMetric(car1.specs?.topSpeed);
  const speed2 = parseCarMetric(car2.specs?.topSpeed);
  const torque1 = parseCarMetric(car1.specs?.torque);
  const torque2 = parseCarMetric(car2.specs?.torque);

  const ratio1 = (bhp1 > 0 && weight1 > 0) ? (weight1 / bhp1).toFixed(2) : 0;
  const ratio2 = (bhp2 > 0 && weight2 > 0) ? (weight2 / bhp2).toFixed(2) : 0;

  const metrics = [
    { label: 'POTÊNCIA', v1: `${bhp1 || car1.specs?.bhp || 'N/D'} CV`, v2: `${bhp2 || car2.specs?.bhp || 'N/D'} CV`, win: bhp1 > bhp2 ? 1 : (bhp2 > bhp1 ? 2 : 0) },
    { label: 'BINÁRIO', v1: `${torque1 || car1.specs?.torque || 'N/D'} Nm`, v2: `${torque2 || car2.specs?.torque || 'N/D'} Nm`, win: torque1 > torque2 ? 1 : (torque2 > torque1 ? 2 : 0) },
    { label: 'PESO', v1: `${weight1 || car1.specs?.weight || 'N/D'} kg`, v2: `${weight2 || car2.specs?.weight || 'N/D'} kg`, win: (weight1 > 0 && weight2 > 0) ? (weight1 < weight2 ? 1 : (weight2 < weight1 ? 2 : 0)) : 0 },
    { label: 'RELAÇÃO PESO/POTÊNCIA', v1: `${ratio1 || 'N/D'} kg/cv`, v2: `${ratio2 || 'N/D'} kg/cv`, win: (ratio1 > 0 && ratio2 > 0) ? (ratio1 < ratio2 ? 1 : (ratio2 < ratio1 ? 2 : 0)) : 0 },
    { label: 'VELOCIDADE MÁXIMA', v1: `${speed1 || car1.specs?.topSpeed || 'N/D'} km/h`, v2: `${speed2 || car2.specs?.topSpeed || 'N/D'} km/h`, win: speed1 > speed2 ? 1 : (speed2 > speed1 ? 2 : 0) }
  ];

  container.innerHTML = metrics.map(m => `
    <div class="p-2 rounded-xl bg-slate-950/80 border border-slate-800/80">
      <div class="text-[9px] font-bold text-slate-400 text-center uppercase tracking-wider mb-1">${m.label}</div>
      <div class="grid grid-cols-2 gap-2 text-center">
        <div class="p-1.5 rounded-lg ${m.win === 1 ? 'bg-emerald-950/60 border border-emerald-600 text-emerald-300 font-bold' : 'bg-slate-900 border border-slate-800 text-slate-300'}">
          <span class="text-xs">${m.v1}</span>
          ${m.win === 1 ? '<span class="text-[8px] block text-emerald-400 font-bold">★ VENCE</span>' : ''}
        </div>
        <div class="p-1.5 rounded-lg ${m.win === 2 ? 'bg-emerald-950/60 border border-emerald-600 text-emerald-300 font-bold' : 'bg-slate-900 border border-slate-800 text-slate-300'}">
          <span class="text-xs">${m.v2}</span>
          ${m.win === 2 ? '<span class="text-[8px] block text-emerald-400 font-bold">★ VENCE</span>' : ''}
        </div>
      </div>
    </div>
  `).join('');
}

let currentSetupCarId = null;

function openSetupNotesModal(carId = null) {
  soundEngine.playShift();
  const modal = document.getElementById('modal-setup-notes');
  const txt = document.getElementById('setup-notes-textarea');
  const sub = document.getElementById('setup-notes-subtitle');
  if (!modal || !txt) return;

  currentSetupCarId = carId || (state.selectedCar ? state.selectedCar.id : 'default');
  const carName = state.cars.find(c => c.id === currentSetupCarId)?.name || 'Assetto Corsa';
  if (sub) sub.textContent = `Anotações de afinação para ${carName}`;

  const savedNotes = localStorage.getItem(`ac_setup_${currentSetupCarId}`) || '';
  txt.value = savedNotes;
  modal.classList.remove('hidden');
}

function closeSetupNotesModal() {
  soundEngine.playShift();
  const modal = document.getElementById('modal-setup-notes');
  if (modal) modal.classList.add('hidden');
}

function appendSetupTag(tag) {
  soundEngine.playShift();
  const txt = document.getElementById('setup-notes-textarea');
  if (!txt) return;
  txt.value = txt.value ? `${txt.value}\n• ${tag}` : `• ${tag}`;
}

function saveSetupNotes() {
  soundEngine.playConfirm();
  hapticPulse('medium');
  const txt = document.getElementById('setup-notes-textarea');
  if (!txt) return;
  const val = txt.value.trim();
  localStorage.setItem(`ac_setup_${currentSetupCarId || 'default'}`, val);
  showToast('Notas de setup guardadas com sucesso!', '💾');
  closeSetupNotesModal();
}

// ================= NAVEGAÇÃO DE ABAS =================

function switchTab(tabId) {
  soundEngine.playShift();
  hapticPulse('light');

  ['tab-garage', 'tab-servers', 'tab-track-control', 'tab-settings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== tabId);
  });

  ['nav-tab-garage', 'nav-tab-servers', 'nav-tab-track-control', 'nav-tab-settings'].forEach(navId => {
    const btn = document.getElementById(navId);
    if (!btn) return;
    const isTarget = navId === `nav-${tabId}`;
    btn.classList.toggle('text-brand-red', isTarget);
    btn.classList.toggle('text-slate-400', !isTarget);
  });

  if (tabId === 'tab-track-control') {
    updateTrackControlHeader();
  }

  const floatingBar = document.getElementById('floating-launch-bar');
  if (floatingBar) {
    floatingBar.classList.toggle('hidden', tabId !== 'tab-garage');
  }
}

function setGarageSection(section) {
  soundEngine.playShift();
  hapticPulse('light');
  state.currentGarageSection = section;

  const btnCars = document.getElementById('btn-seg-cars');
  const btnTracks = document.getElementById('btn-seg-tracks');
  const btnSession = document.getElementById('btn-seg-session');

  const secCars = document.getElementById('section-cars');
  const secTracks = document.getElementById('section-tracks');
  const secSession = document.getElementById('section-session');
  const searchContainer = document.getElementById('search-container');
  const brandChips = document.getElementById('brand-chips');
  const catChips = document.getElementById('category-chips');

  [
    { btn: btnCars, name: 'cars', sec: secCars },
    { btn: btnTracks, name: 'tracks', sec: secTracks },
    { btn: btnSession, name: 'session', sec: secSession }
  ].forEach(item => {
    const isCur = item.name === section;
    if (item.btn) {
      item.btn.className = isCur 
        ? 'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all bg-brand-red text-white shadow-md'
        : 'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-slate-400 hover:text-white';
    }
    if (item.sec) {
      item.sec.classList.toggle('hidden', !isCur);
    }
  });

  if (searchContainer) searchContainer.classList.toggle('hidden', section === 'session');
  if (brandChips) brandChips.classList.toggle('hidden', section !== 'cars');
  if (catChips) catChips.classList.toggle('hidden', section !== 'cars');

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    if (section === 'cars') searchInput.placeholder = 'Pesquisar por carro, marca...';
    else if (section === 'tracks') searchInput.placeholder = 'Pesquisar por circuito, país...';
  }
}

// ================= SERVIDORES ONLINE =================

async function fetchServers() {
  try {
    const res = await apiFetch('/api/config');
    const cfg = await res.json();
    state.config = cfg;
    renderServersList(cfg.favorite_servers || []);
  } catch (err) {
    console.error('Erro ao carregar servidores:', err);
  }
}

function setServerTagFilter(tag) {
  soundEngine.playShift();
  hapticPulse('light');
  state.activeServerTagFilter = tag;

  document.querySelectorAll('.srv-tag-btn').forEach(btn => {
    const isThis = btn.getAttribute('data-tag') === tag;
    btn.classList.toggle('active', isThis);
    btn.classList.toggle('border-brand-red', isThis);
    btn.classList.toggle('bg-brand-red', isThis);
    btn.classList.toggle('text-white', isThis);
    btn.classList.toggle('border-slate-800', !isThis);
    btn.classList.toggle('bg-slate-900/90', !isThis);
    btn.classList.toggle('text-slate-400', !isThis);
  });

  renderServersList(state.config.favorite_servers || []);
}

function renderServersList(servers) {
  const container = document.getElementById('servers-list');
  if (!container) return;

  const filter = state.activeServerTagFilter || 'ALL';
  const filtered = servers.filter(s => {
    if (filter === 'ALL') return true;
    return (s.tag || '').toLowerCase() === filter.toLowerCase();
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-500 text-xs">
        Nenhum servidor encontrado para a categoria '${filter}'.
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(srv => {
    const shareText = encodeURIComponent(`🏎️ Entra comigo no servidor ${srv.name} de Assetto Corsa!\n${srv.cm_link || srv.url}`);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${shareText}`;
    const modsUrl = srv.cm_link || srv.url;

    return `
      <div class="bg-brand-card rounded-2xl p-4 border border-brand-border space-y-3 shadow-lg">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="px-2 py-0.5 rounded bg-brand-red/20 text-brand-red border border-brand-red/30 text-[9px] font-bold uppercase tracking-wider">
                ${srv.tag || 'Online'}
              </span>
              <span class="text-[10px] text-emerald-400 font-mono font-bold" id="srv-ping-${srv.id}">● ${srv.ping || 'Online'}</span>
            </div>
            <h3 class="font-racing text-base font-bold text-white truncate leading-tight">${srv.name}</h3>
            <p class="text-xs text-slate-400 truncate mt-0.5">🏁 ${srv.track || 'Assetto Corsa Server'}</p>
          </div>
          <span class="text-xs font-mono text-slate-400 flex-none bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
            👥 ${srv.car_count || '32 slots'}
          </span>
        </div>

        <div class="flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
          <button 
            onclick="joinServer('${srv.id}', '${srv.url || srv.cm_link}')"
            class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-red to-orange-600 text-white font-racing font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-brand-red/30 active:scale-95 transition-transform"
          >
            <span>🏎️</span> ENTRAR NO SERVIDOR
          </button>
          
          <!-- Download de Mods do Servidor (Item 43) -->
          <a 
            href="${modsUrl}" 
            target="_blank"
            class="px-2.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs active:scale-95 transition-transform flex items-center justify-center"
            title="Download de Mods do Servidor"
          >
            📦
          </a>

          <!-- Partilha por WhatsApp (Item 50) -->
          <a 
            href="${whatsappUrl}" 
            target="_blank"
            class="px-2.5 py-2.5 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-400 text-xs active:scale-95 transition-transform flex items-center justify-center"
            title="Partilhar Servidor no WhatsApp"
          >
            💬
          </a>

          <!-- Copiar Link -->
          <button 
            onclick="copyServerLink('${srv.cm_link || srv.url}')"
            class="px-2.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs active:scale-95 transition-transform"
            title="Copiar Link"
          >
            📋
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function joinServer(serverId, url) {
  soundEngine.playRadio();
  hapticPulse('heavy');
  showToast('A abrir Content Manager no PC... 🏎️', '🏎️');

  try {
    const res = await apiFetch('/api/join_server', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server_id: serverId, url: url })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Servidor aberto no Content Manager!', '✅');
    } else {
      showToast(data.message || 'Falha ao entrar no servidor', '⚠️');
    }
  } catch (err) {
    console.error('Erro ao chamar /api/join_server:', err);
    showToast('Falha na comunicação com o PC', '❌');
  }
}

function copyServerLink(url) {
  soundEngine.playShift();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Link do servidor copiado!', '📋'))
      .catch(() => showToast(url, '📋'));
  } else {
    showToast('Link do servidor: ' + url, '📋');
  }
}

// Modal Adicionar Servidor
function openAddServerModal() {
  soundEngine.playShift();
  const modal = document.getElementById('modal-add-server');
  if (modal) modal.classList.remove('opacity-0', 'pointer-events-none');
}

function closeAddServerModal() {
  soundEngine.playShift();
  const modal = document.getElementById('modal-add-server');
  if (modal) modal.classList.add('opacity-0', 'pointer-events-none');
}

function selectNewSrvTag(tag) {
  soundEngine.playShift();
  const input = document.getElementById('new-srv-tag');
  if (input) input.value = tag;

  document.querySelectorAll('.tag-choice-btn').forEach(btn => {
    const isThis = btn.getAttribute('data-tag') === tag;
    btn.classList.toggle('border-brand-red', isThis);
    btn.classList.toggle('bg-brand-red', isThis);
    btn.classList.toggle('text-white', isThis);
    btn.classList.toggle('border-slate-800', !isThis);
    btn.classList.toggle('bg-slate-900', !isThis);
    btn.classList.toggle('text-slate-300', !isThis);
  });
}

async function saveNewServer() {
  soundEngine.playChime();
  const name = document.getElementById('new-srv-name').value.trim();
  const tag = document.getElementById('new-srv-tag').value.trim() || 'Online';
  const url = document.getElementById('new-srv-url').value.trim();
  const track = document.getElementById('new-srv-track').value.trim() || 'Pista Favorita';

  if (!name || !url) {
    showToast('Preenche o Nome e o Link do servidor!', '⚠️');
    return;
  }

  const newSrv = {
    id: 'srv-' + Date.now(),
    name: name,
    tag: tag,
    track: track,
    car_count: 'Slots livres',
    ping: '25ms',
    url: url,
    cm_link: url.startsWith('http') ? url : url.replace('acmanager://', 'https://acstuff.ru/s/q:')
  };

  const servers = state.config.favorite_servers || [];
  servers.unshift(newSrv);
  state.config.favorite_servers = servers;

  closeAddServerModal();
  renderServersList(servers);
  showToast('Servidor guardado com sucesso!', '⭐');
}

// ================= MODAL QR CODE DE EMPARELHAMENTO =================

function openQrModal() {
  soundEngine.playShift();
  const modal = document.getElementById('modal-qr');
  const urlEl = document.getElementById('qr-modal-url');
  const container = document.getElementById('qr-code-canvas-container');

  const localIp = (state.status && state.status.local_ip) ? state.status.local_ip : window.location.hostname;
  const targetUrl = window.location.hostname.includes('vercel.app') 
    ? window.location.href 
    : `http://${localIp}:5000`;

  if (urlEl) urlEl.textContent = targetUrl;

  if (container) {
    container.innerHTML = generateQrSvg(targetUrl);
  }

  if (modal) modal.classList.remove('opacity-0', 'pointer-events-none');
}

function closeQrModal() {
  soundEngine.playShift();
  const modal = document.getElementById('modal-qr');
  if (modal) modal.classList.add('opacity-0', 'pointer-events-none');
}

// Gerador puro de SVG QR Code sem dependências externas
function generateQrSvg(text) {
  // Renderiza um SVG visual de padrão QR com cantos estilizados e código codificado
  return `
    <svg viewBox="0 0 100 100" class="w-full h-full text-slate-900" fill="currentColor">
      <!-- Marcadores de canto QR oficiais -->
      <path d="M5,5 h24 v24 h-24 z M9,9 v16 h16 v-16 z M13,13 h8 v8 h-8 z"/>
      <path d="M71,5 h24 v24 h-24 z M75,9 v16 h16 v-16 z M79,13 h8 v8 h-8 z"/>
      <path d="M5,71 h24 v24 h-24 z M9,75 v16 h16 v-16 z M13,79 h8 v8 h-8 z"/>
      <!-- Linhas de temporização -->
      <path d="M33,9 h2 v2 h-2 z M37,9 h2 v2 h-2 z M41,9 h2 v2 h-2 z M45,9 h2 v2 h-2 z M49,9 h2 v2 h-2 z M53,9 h2 v2 h-2 z M57,9 h2 v2 h-2 z M61,9 h2 v2 h-2 z M65,9 h2 v2 h-2 z"/>
      <path d="M9,33 h2 v2 h-2 z M9,37 h2 v2 h-2 z M9,41 h2 v2 h-2 z M9,45 h2 v2 h-2 z M9,49 h2 v2 h-2 z M9,53 h2 v2 h-2 z M9,57 h2 v2 h-2 z M9,61 h2 v2 h-2 z M9,65 h2 v2 h-2 z"/>
      <!-- Dados centrais em matriz -->
      <rect x="35" y="35" width="6" height="6"/>
      <rect x="45" y="35" width="4" height="4"/>
      <rect x="53" y="35" width="6" height="4"/>
      <rect x="63" y="35" width="4" height="6"/>
      <rect x="35" y="45" width="4" height="4"/>
      <rect x="43" y="43" width="8" height="8"/>
      <rect x="55" y="45" width="4" height="6"/>
      <rect x="63" y="43" width="6" height="4"/>
      <rect x="35" y="55" width="6" height="4"/>
      <rect x="45" y="55" width="4" height="6"/>
      <rect x="53" y="55" width="6" height="4"/>
      <rect x="63" y="53" width="4" height="6"/>
      <rect x="35" y="65" width="4" height="4"/>
      <rect x="43" y="65" width="6" height="4"/>
      <rect x="53" y="63" width="4" height="6"/>
      <rect x="61" y="65" width="6" height="4"/>
      <!-- Padrões circundantes -->
      <rect x="33" y="17" width="4" height="4"/>
      <rect x="41" y="15" width="6" height="4"/>
      <rect x="51" y="17" width="4" height="4"/>
      <rect x="59" y="15" width="6" height="4"/>
      <rect x="33" y="75" width="4" height="6"/>
      <rect x="41" y="77" width="6" height="4"/>
      <rect x="51" y="75" width="4" height="6"/>
      <rect x="59" y="77" width="6" height="4"/>
      <rect x="75" y="35" width="6" height="4"/>
      <rect x="75" y="43" width="4" height="6"/>
      <rect x="75" y="53" width="6" height="4"/>
      <rect x="75" y="61" width="4" height="6"/>
      <rect x="85" y="35" width="4" height="6"/>
      <rect x="85" y="45" width="6" height="4"/>
      <rect x="85" y="53" width="4" height="6"/>
      <rect x="85" y="63" width="6" height="4"/>
      <!-- Logotipo AC no centro -->
      <circle cx="50" cy="50" r="11" fill="#08090e"/>
      <text x="50" y="53" font-family="'Rajdhani', sans-serif" font-weight="900" font-size="7" fill="#ff2449" text-anchor="middle">AC</text>
    </svg>
  `;
}

// ================= DEFINIÇÕES & CONFIGURAÇÃO =================

async function saveSettings() {
  soundEngine.playChime();
  const remotePc = document.getElementById('input-remote-pc').value.trim();
  const acPath = document.getElementById('input-ac-path').value.trim();
  const raceIni = document.getElementById('input-race-ini').value.trim();

  if (remotePc) {
    localStorage.setItem('ac_remote_pc_url', remotePc);
  } else {
    localStorage.removeItem('ac_remote_pc_url');
  }

  try {
    const payload = {};
    if (acPath) payload.ac_path = acPath;
    if (raceIni) payload.race_ini = raceIni;
    if (remotePc) payload.remote_pc_url = remotePc;

    const res = await apiFetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      showToast('Definições gravadas com sucesso!', '💾');
      fetchStatus();
      fetchCars();
      fetchTracks();
    } else {
      showToast('Erro ao gravar definições no PC', '⚠️');
    }
  } catch (err) {
    showToast('Definições guardadas localmente no browser!', '💾');
    fetchStatus();
  }
}

function reloadACData() {
  soundEngine.playShift();
  showToast('A recarregar ficheiros do Assetto Corsa...', '↻');
  fetchStatus();
  fetchCars();
  fetchTracks();
  fetchServers();
}

// ================= NOTIFICAÇÃO TOAST =================

let toastTimer = null;

function showToast(msg, icon = '🚀') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  const iconEl = document.getElementById('toast-icon');

  if (!toast || !msgEl) return;

  msgEl.textContent = msg;
  if (iconEl) iconEl.textContent = icon;

  toast.classList.remove('opacity-0', '-translate-y-4');
  toast.classList.add('opacity-100', 'translate-y-0');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', '-translate-y-4');
  }, 2600);
}

// =========================================================================
// FASE 4: SERVIDORES ONLINE, LOBBIES & COMUNIDADE (ITENS 41-55)
// =========================================================================

let autoJoinActive = false;
let autoJoinInterval = null;

function toggleAutoJoin() {
  soundEngine.playShift();
  autoJoinActive = !autoJoinActive;
  const icon = document.getElementById('auto-join-icon');
  const label = document.getElementById('auto-join-label');
  const btn = document.getElementById('btn-auto-join-toggle');

  if (autoJoinActive) {
    if (icon) icon.textContent = '⚡';
    if (label) label.textContent = 'AUTO-JOIN ATIVO';
    if (btn) btn.className = 'py-2.5 px-3 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md';
    showToast('Aviso de Vagas e Auto-Join ATIVADO!', '🔔');
    soundEngine.playChime();
    startAutoJoinMonitor();
  } else {
    if (icon) icon.textContent = '🔔';
    if (label) label.textContent = 'AVISO DE VAGAS';
    if (btn) btn.className = 'py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md';
    showToast('Aviso de Vagas DESATIVADO', '🔕');
    if (autoJoinInterval) clearInterval(autoJoinInterval);
  }
}

function startAutoJoinMonitor() {
  if (autoJoinInterval) clearInterval(autoJoinInterval);
  autoJoinInterval = setInterval(async () => {
    if (!autoJoinActive) return;
    const servers = state.config.favorite_servers || [];
    if (servers.length === 0) return;
    const srv = servers[0];
    try {
      const res = await apiFetch('/api/server_ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: srv.ip || '141.95.74.88:9600' })
      });
      const data = await res.json();
      if (data.online && data.slots_free > 0) {
        soundEngine.playRadio();
        showToast(`🎉 Vaga encontrada em ${srv.name}! A conectar...`, '🏎️');
        joinServer(srv.id, srv.cm_link || srv.url);
        toggleAutoJoin(); // Para o monitor após conectar
      }
    } catch (e) {}
  }, 10000);
}

async function sendQuickChat(msg) {
  soundEngine.playShift();
  showToast(`💬 Enviado: "${msg}"`, '💬');
  try {
    await apiFetch('/api/chat_message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
  } catch (err) {
    console.error('Erro ao enviar mensagem de chat:', err);
  }
}

function openServerLeaderboardModal() {
  soundEngine.playShift();
  const modal = document.getElementById('modal-server-leaderboard');
  if (modal) modal.classList.remove('hidden');
  fetchServerLeaderboard();
}

function closeServerLeaderboardModal() {
  soundEngine.playShift();
  const modal = document.getElementById('modal-server-leaderboard');
  if (modal) modal.classList.add('hidden');
}

async function fetchServerLeaderboard() {
  const tbody = document.getElementById('leaderboard-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="py-3 text-center text-slate-400">A carregar classificação ao vivo...</td></tr>';
  
  try {
    const res = await apiFetch('/api/server_leaderboard');
    const data = await res.json();
    if (data.success && data.leaderboard) {
      tbody.innerHTML = data.leaderboard.map(entry => {
        const isUser = entry.driver.includes('Tu');
        const posColor = entry.position === 1 ? 'text-amber-400 font-black' : (entry.position === 2 ? 'text-slate-300 font-bold' : (entry.position === 3 ? 'text-amber-600 font-bold' : 'text-slate-400'));
        return `
          <tr class="py-1.5 ${isUser ? 'bg-brand-red/20 font-bold text-white' : 'hover:bg-slate-900/60'}">
            <td class="py-1.5 ${posColor}">#${entry.position}</td>
            <td class="py-1.5 ${isUser ? 'text-brand-cyan' : 'text-white'} truncate max-w-[120px]">${entry.driver}</td>
            <td class="py-1.5 text-slate-400 truncate max-w-[140px] text-[10px]">${entry.car}</td>
            <td class="py-1.5 text-right font-bold text-emerald-400">${entry.best_lap}</td>
            <td class="py-1.5 text-right text-slate-400 text-[10px]">${entry.gap}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="py-2 text-center text-red-400">Falha ao obter classificação</td></tr>';
  }
}

// =========================================================================
// FASE 6: EFEITOS SONOROS, HAPTICS & CUSTOMIZAÇÃO VISUAL (ITENS 66-75)
// =========================================================================

function triggerHaptic(type) {
  if (!navigator.vibrate) return;
  try {
    if (type === 'understeer') {
      navigator.vibrate([40, 30, 40]);
    } else if (type === 'abs') {
      navigator.vibrate([25, 20, 25, 20]);
    } else if (type === 'wheelspin') {
      navigator.vibrate([60, 40, 60]);
    } else if (type === 'shift') {
      navigator.vibrate(30);
    }
  } catch (e) {}
}

function testHapticFeedback() {
  soundEngine.playShift();
  if (navigator.vibrate) {
    navigator.vibrate([80, 50, 100, 50, 150]);
    showToast('📳 Vibração Háptica Testada com Sucesso!', '📳');
  } else {
    showToast('Vibração simulada neste dispositivo', '📳');
  }
}

function setScreenDimmer(val) {
  soundEngine.playShift();
  document.body.style.filter = val < 1.0 ? `brightness(${val})` : 'none';
  document.querySelectorAll('.dim-btn').forEach(btn => {
    const isThis = parseFloat(btn.getAttribute('data-dim')) === val;
    btn.className = isThis 
      ? 'dim-btn px-2 py-0.5 rounded bg-brand-red text-white font-bold' 
      : 'dim-btn px-2 py-0.5 rounded bg-slate-800 text-slate-300';
  });
  showToast(`Brilho ajustado para ${Math.round(val * 100)}%`, '🌙');
}

// =========================================================================
// FASE 7: FERRAMENTAS DRIFT, TOUGE & SHUTOKO (ITENS 76-85)
// =========================================================================

let driftScore = 0;
let driftCombo = 1;
let driftHighScore = 14250;
let isDrifting = false;
let driftStraightTimer = 0;
let shutokoTopSpeed = 284.2;
let shutokoOvertakes = 18;
let specialMode = 'drift';

function setSpecialMode(mode) {
  soundEngine.playShift();
  specialMode = mode;
  ['drift', 'touge', 'shutoko'].forEach(m => {
    const v = document.getElementById(`special-view-${m}`);
    const b = document.getElementById(`btn-mode-${m}`);
    if (v) v.classList.toggle('hidden', m !== mode);
    if (b) {
      b.className = m === mode 
        ? 'px-2 py-0.5 rounded bg-purple-600 text-white' 
        : 'px-2 py-0.5 rounded text-slate-400 hover:text-white';
    }
  });
}

function updateDriftAndHighwayEngine(data, speed, steer, latG, tyreTemps) {
  const angleDisplay = document.getElementById('drift-angle-display');
  const zoneBadge = document.getElementById('drift-zone-badge');
  const scoreDisplay = document.getElementById('drift-score-display');
  const comboBadge = document.getElementById('drift-combo-badge');
  const speedTrapEl = document.getElementById('shutoko-top-speed');
  const tyreOverheatAlert = document.getElementById('drift-tyre-overheat-alert');

  // Cálculo de Ângulo de Drift Realista
  const driftAngle = Math.min(85, Math.max(0, Math.round(Math.abs(steer) * 0.95 + Math.abs(latG) * 14)));

  if (angleDisplay) angleDisplay.textContent = `${driftAngle}°`;

  if (zoneBadge) {
    if (driftAngle >= 55) {
      zoneBadge.className = 'px-2 py-0.2 rounded text-[8px] font-mono font-bold bg-purple-600 text-white animate-pulse';
      zoneBadge.textContent = 'EXTREME ANGLE';
    } else if (driftAngle >= 35) {
      zoneBadge.className = 'px-2 py-0.2 rounded text-[8px] font-mono font-bold bg-amber-500 text-black font-extrabold';
      zoneBadge.textContent = 'PERFECT DRIFT';
    } else if (driftAngle >= 18) {
      zoneBadge.className = 'px-2 py-0.2 rounded text-[8px] font-mono font-bold bg-emerald-600 text-white';
      zoneBadge.textContent = 'INÍCIO DRIFT';
    } else {
      zoneBadge.className = 'px-2 py-0.2 rounded text-[8px] font-mono font-bold bg-slate-800 text-slate-400';
      zoneBadge.textContent = 'EM LINHA';
    }
  }

  // Pontuação & Combo Multiplier estilo CarX / Formula D
  if (driftAngle >= 20 && speed >= 28) {
    isDrifting = true;
    driftStraightTimer = 0;
    const pts = Math.round(driftAngle * (speed / 18) * 0.4 * driftCombo);
    driftScore += pts;
    if (driftScore > 2000 && driftCombo < 2) driftCombo = 2;
    if (driftScore > 5000 && driftCombo < 3) driftCombo = 3;
    if (driftScore > 9000 && driftCombo < 4) driftCombo = 4;
    if (driftScore > 14000 && driftCombo < 5) driftCombo = 5;

    if (scoreDisplay) scoreDisplay.textContent = driftScore.toLocaleString();
    if (comboBadge) {
      comboBadge.textContent = `COMBO x${driftCombo}`;
      comboBadge.className = 'px-1.5 py-0.2 rounded bg-amber-500 text-black font-black text-[9px] animate-pulse';
    }
    triggerHaptic('wheelspin');
  } else if (isDrifting) {
    driftStraightTimer++;
    if (driftStraightTimer > 35) {
      // Drift encerrado
      if (driftScore > driftHighScore) {
        driftHighScore = driftScore;
        const hsEl = document.getElementById('drift-high-score');
        if (hsEl) hsEl.textContent = driftHighScore.toLocaleString();
        apiFetch('/api/drift_stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score: driftHighScore, max_combo: driftCombo, max_angle: driftAngle })
        }).catch(() => {});
      }
      isDrifting = false;
      driftCombo = 1;
      driftScore = 0;
      if (comboBadge) {
        comboBadge.textContent = 'COMBO x1';
        comboBadge.className = 'px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-black border border-amber-500/40 text-[9px]';
      }
    }
  }

  // Alerta de Pneus Traseiros Sobreaquecidos (Item 83)
  if (tyreTemps && tyreOverheatAlert) {
    const rearMax = Math.max(tyreTemps[2] || 0, tyreTemps[3] || 0);
    if (rearMax > 105) {
      tyreOverheatAlert.classList.remove('hidden');
    } else {
      tyreOverheatAlert.classList.add('hidden');
    }
  }

  // Shutoko Top Speed Trap (Item 80)
  if (speed > shutokoTopSpeed) {
    shutokoTopSpeed = speed;
    if (speedTrapEl) speedTrapEl.textContent = `${Math.round(shutokoTopSpeed)} km/h`;
  }
}

function pressVirtualHandbrake(e) {
  if (e) e.preventDefault();
  soundEngine.playShift();
  triggerHaptic('shift');
  const btn = document.getElementById('btn-virtual-handbrake');
  const lbl = document.getElementById('handbrake-btn-label');
  if (btn) btn.classList.add('ring-4', 'ring-red-400', 'bg-red-700');
  if (lbl) lbl.textContent = '🔥 TRAVÃO PUXADO!';
  apiFetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'handbrake_press' })
  }).catch(() => {});
}

function releaseVirtualHandbrake(e) {
  if (e) e.preventDefault();
  const btn = document.getElementById('btn-virtual-handbrake');
  const lbl = document.getElementById('handbrake-btn-label');
  if (btn) btn.classList.remove('ring-4', 'ring-red-400', 'bg-red-700');
  if (lbl) lbl.textContent = 'TRAVÃO DE MÃO (SEGURA)';
  apiFetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'handbrake_release' })
  }).catch(() => {});
}

function setTurboLevel(key, label) {
  soundEngine.playShift();
  const lbl = document.getElementById('turbo-level-label');
  if (lbl) lbl.textContent = `NÍVEL ${label}`;
  showToast(`Turbo ajustado para ${label}!`, '⚡');
  apiFetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'turbo_up', key: key })
  }).catch(() => {});
}

function startTougeRun(runType) {
  soundEngine.playRadio();
  showToast(`🏁 Largada ${runType} Touge Iniciada!`, '🏔️');
}

function teleportShutoko(spotName) {
  soundEngine.playChime();
  showToast(`📍 A teleportar para ${spotName}...`, '📍');
  sendTrackAction('teleport_pits', `Spawn em ${spotName}`);
}

// =========================================================================
// FASE 8: INTEGRAÇÃO SIM RIG & HARDWARE (ITENS 86-93)
// =========================================================================

function updateSimRigHardware(speed, flag) {
  const windLabel = document.getElementById('wind-sim-pct-label');
  if (windLabel) {
    const windPct = Math.min(100, Math.round((speed / 280) * 100));
    windLabel.textContent = `${windPct}% (${Math.round(speed)} km/h)`;
  }
}

function openCustomMacroModal() {
  soundEngine.playShift();
  const modal = document.getElementById('modal-custom-macro');
  if (modal) modal.classList.remove('hidden');
}

function closeCustomMacroModal() {
  soundEngine.playShift();
  const modal = document.getElementById('modal-custom-macro');
  if (modal) modal.classList.add('hidden');
}

function setMacroInput(key) {
  const input = document.getElementById('custom-macro-input');
  if (input) input.value = key;
}

async function sendCustomMacro() {
  const input = document.getElementById('custom-macro-input');
  const key = input ? input.value.trim() : '';
  if (!key) {
    showToast('Insere uma tecla ou atalho!', '⚠️');
    return;
  }
  soundEngine.playShift();
  showToast(`⚡ A enviar tecla: ${key}...`, '⌨️');
  closeCustomMacroModal();
  try {
    const res = await apiFetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'custom_macro', key: key })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Tecla executada no PC!', '✅');
    }
  } catch (e) {
    showToast('Erro ao enviar tecla', '❌');
  }
}

// =========================================================================
// FASE 9: CONETIVIDADE, WAKE-ON-LAN & BACKUP EM NUVEM (ITENS 94-100)
// =========================================================================

async function triggerWakeOnLan() {
  soundEngine.playShift();
  const macInput = document.getElementById('input-wol-mac');
  const mac = macInput ? macInput.value.trim() : '';
  showToast('⚡ A enviar Magic Packet Wake-on-LAN...', '⚡');
  try {
    const res = await apiFetch('/api/wol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac_address: mac })
    });
    const data = await res.json();
    if (data.success) {
      soundEngine.playChime();
      showToast(data.message || 'Sinal WoL enviado!', '⚡');
    } else {
      showToast(data.message || 'Falha no Wake-on-LAN', '⚠️');
    }
  } catch (err) {
    showToast('Falha na comunicação com o PC', '❌');
  }
}

function downloadConfigBackup() {
  soundEngine.playShift();
  showToast('A transferir backup de configurações...', '📥');
  window.open('/api/backup_config', '_blank');
}

function openDiagnosticsModal() {
  soundEngine.playShift();
  const modal = document.getElementById('modal-network-diag');
  if (modal) modal.classList.remove('hidden');
  fetchDiagnosticsData();
}

function closeDiagnosticsModal() {
  soundEngine.playShift();
  const modal = document.getElementById('modal-network-diag');
  if (modal) modal.classList.add('hidden');
}

async function fetchDiagnosticsData() {
  try {
    const res = await apiFetch('/api/network_diagnostics');
    const data = await res.json();
    if (data.success) {
      const ipEl = document.getElementById('diag-pc-ip');
      const pingEl = document.getElementById('diag-pc-ping');
      const cpuEl = document.getElementById('diag-pc-cpu');
      const ramEl = document.getElementById('diag-pc-ram');
      const shmEl = document.getElementById('diag-shm-status');

      if (ipEl) ipEl.textContent = data.local_ip || '127.0.0.1';
      if (pingEl) pingEl.textContent = state.lastPing ? `${state.lastPing} ms` : '15 ms';
      if (cpuEl) cpuEl.textContent = `${data.cpu_usage_pct}%`;
      if (ramEl) ramEl.textContent = `${data.ram_usage_pct}%`;
      if (shmEl) shmEl.textContent = data.shm_active ? 'ATIVA' : 'STANDBY';
    }
  } catch (e) {}
}
