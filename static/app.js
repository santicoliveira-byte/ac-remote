/**
 * AC REMOTE - Mobile Controller para Assetto Corsa
 * Frontend SPA Logic (PWA Mobile-First)
 */

// Estado Global da Aplicação
const state = {
  cars: [],
  tracks: [],
  selectedCar: null,
  selectedSkin: null,
  selectedTrack: null,
  selectedLayout: '',
  selectedMode: 'practice',
  selectedModeLabel: 'Treino Livre',
  selectedTime: '14:00',
  currentGarageSection: 'cars',
  activeBrandFilter: 'ALL',
  searchQuery: '',
  config: {},
  status: {},
  // Estado temporário no modal de skin
  tempSkin: null,
  tempCar: null
};

// ================= INICIALIZAÇÃO =================

document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker();
  fetchStatus();
  fetchCars();
  fetchTracks();
  fetchServers();
  setupTouchHaptics();
});

// Registar Service Worker para instalação PWA
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[PWA] Service Worker registado com sucesso:', reg.scope))
      .catch(err => console.warn('[PWA] Falha ao registar Service Worker:', err));
  }
}

// Vibrar levemente no iPhone se suportado
function hapticPulse(type = 'light') {
  if ('vibrate' in navigator) {
    try {
      if (type === 'light') navigator.vibrate(10);
      else if (type === 'medium') navigator.vibrate(25);
      else if (type === 'heavy') navigator.vibrate([30, 50, 30]);
    } catch (e) {}
  }
}

function setupTouchHaptics() {
  document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('touchstart', () => hapticPulse('light'), { passive: true });
  });
}

// Helper para chamadas API (com suporte a Proxy transparente na Vercel)
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
  const countEl = document.getElementById('settings-counts');
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
      if (label) label.textContent = 'Vercel Cloud';
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

  if (countEl) countEl.textContent = `${data.cars_count} carros / ${data.tracks_count} pistas`;

  if (acPathInput && !acPathInput.value) acPathInput.value = data.ac_path || '';
  if (raceIniInput && !raceIniInput.value) raceIniInput.value = data.race_ini || '';

  if (data.demo_mode) {
    if (!data.is_vercel) {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-400';
      if (label) label.textContent = 'Modo Demo';
    }
    if (demoAlert) demoAlert.classList.remove('hidden');
    if (acStatus) acStatus.textContent = data.is_vercel ? 'A correr na Vercel (liga o teu PC nas definições)' : 'Pasta padrão não encontrada (a usar dados demo)';
    if (acBadge) {
      acBadge.textContent = data.is_vercel ? 'CLOUD' : 'DEMO';
      acBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30';
    }
  } else {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    if (label) label.textContent = 'AC Ligado';
    if (demoAlert) demoAlert.classList.add('hidden');
    if (acStatus) acStatus.textContent = 'Ficheiros do simulador detetados com sucesso';
    if (acBadge) {
      acBadge.textContent = 'ONLINE';
      acBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    }
  }
}

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

    // Selecionar primeiro carro se nenhum estiver selecionado
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

async function fetchTracks() {
  try {
    const res = await apiFetch('/api/tracks');
    const data = await res.json();
    state.tracks = data.tracks || [];

    const countBadge = document.getElementById('tracks-badge-count');
    if (countBadge) countBadge.textContent = state.tracks.length;

    renderTracksGrid();

    // Selecionar primeira pista se nenhuma estiver selecionada
    if (state.tracks.length > 0 && !state.selectedTrack) {
      selectTrack(state.tracks[0]);
    }
  } catch (err) {
    console.error('Erro ao carregar pistas:', err);
  }
}

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

// ================= RENDERIZAÇÃO DA GARAGEM =================

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
    const label = isAll ? 'TODOS' : b;
    const isActive = state.activeBrandFilter === b;
    return `
      <button 
        onclick="setBrandFilter('${b}')"
        class="flex-none px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
          isActive 
            ? 'bg-brand-red text-white border-brand-red shadow-sm' 
            : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white'
        }"
      >
        ${label}
      </button>
    `;
  }).join('');
}

function setBrandFilter(brand) {
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

function renderCarsGrid() {
  const grid = document.getElementById('cars-grid');
  if (!grid) return;

  const filtered = state.cars.filter(car => {
    // Filtro por marca selecionada
    if (state.activeBrandFilter !== 'ALL' && car.brand !== state.activeBrandFilter) {
      return false;
    }
    // Filtro por termo de pesquisa
    if (state.searchQuery) {
      const q = state.searchQuery;
      const matchName = car.name.toLowerCase().includes(q);
      const matchBrand = (car.brand || '').toLowerCase().includes(q);
      const matchId = car.id.toLowerCase().includes(q);
      return matchName || matchBrand || matchId;
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
    const skin = (isSelected && state.selectedSkin) ? state.selectedSkin : car.default_skin;
    const previewUrl = `/api/img/car/${car.id}/${skin}`;
    const badgeUrl = `/api/img/badge/${car.id}`;
    const bhp = car.specs ? car.specs.bhp : 'N/D';
    const weight = car.specs ? car.specs.weight : 'N/D';

    return `
      <div 
        onclick="handleCarCardClick('${car.id}')"
        class="relative bg-brand-card rounded-2xl overflow-hidden border transition-all active:scale-[0.98] cursor-pointer group ${
          isSelected 
            ? 'border-brand-red ring-2 ring-brand-red/50 shadow-xl shadow-brand-red/10' 
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
            onerror="this.src='/api/img/car/${car.id}/default'"
          >
          
          <!-- Badge do Fabricante (Canto Superior Esquerdo) -->
          <div class="absolute top-2.5 left-2.5 w-7 h-7 rounded-lg bg-black/60 backdrop-blur-md p-1 border border-white/10 flex items-center justify-center">
            <img src="${badgeUrl}" alt="${car.brand}" class="max-w-full max-h-full object-contain" onerror="this.style.display='none'">
          </div>

          <!-- Indicador de Seleção / Skin -->
          <div class="absolute top-2.5 right-2.5 flex items-center gap-1.5">
            ${
              isSelected 
                ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-brand-red text-white shadow-md">ATIVO</span>'
                : `<span class="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-black/60 text-slate-300 backdrop-blur-sm border border-white/10">${car.skins.length} Skins</span>`
            }
          </div>

          <!-- Linha de Fundo com Skin Atual -->
          <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 flex items-end justify-between">
            <span class="text-[10px] text-slate-300 font-mono truncate max-w-[70%]">
              🎨 ${skin.replace(/_/g, ' ')}
            </span>
            <span class="text-[9px] font-bold text-brand-cyan tracking-wider uppercase">Tocar p/ Pintura</span>
          </div>
        </div>

        <!-- Informações do Carro -->
        <div class="p-3">
          <div class="flex items-start justify-between gap-1">
            <div class="min-w-0">
              <span class="text-[9px] font-bold uppercase tracking-wider text-brand-red block truncate">${car.brand || 'Assetto Corsa'}</span>
              <h3 class="text-xs font-bold text-white truncate leading-tight mt-0.5">${car.name}</h3>
            </div>
          </div>

          <!-- Chips de Especificações (Cavalos e Peso) -->
          <div class="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] font-mono">
            <div class="flex items-center gap-1 text-amber-400">
              <span>🔥</span>
              <span class="font-bold">${bhp}</span>
            </div>
            <span class="text-slate-600">•</span>
            <div class="flex items-center gap-1 text-slate-300">
              <span>⚖️</span>
              <span>${weight}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function handleCarCardClick(carId) {
  hapticPulse('medium');
  const car = state.cars.find(c => c.id === carId);
  if (!car) return;

  const isAlreadySelected = state.selectedCar && state.selectedCar.id === car.id;
  
  if (!isAlreadySelected) {
    selectCar(car, false);
  }

  // Abre a gaveta de skins ao tocar
  openSkinModal(car);
}

function selectCar(car, render = true) {
  state.selectedCar = car;
  if (!state.selectedSkin || !car.skins.includes(state.selectedSkin)) {
    state.selectedSkin = car.default_skin || car.skins[0] || 'default';
  }
  updateSummaryBar();
  if (render) renderCarsGrid();
}

// ================= GAVETA DE SKINS (BOTTOM SHEET) =================

function openSkinModal(car) {
  state.tempCar = car;
  state.tempSkin = state.selectedCar && state.selectedCar.id === car.id 
    ? state.selectedSkin 
    : (car.default_skin || car.skins[0]);

  const brandEl = document.getElementById('skin-modal-car-brand');
  const nameEl = document.getElementById('skin-modal-car-name');
  if (brandEl) brandEl.textContent = car.brand || 'Assetto Corsa';
  if (nameEl) nameEl.textContent = car.name;

  updateSkinLivePreview(car.id, state.tempSkin);
  renderSkinsGrid(car);

  const sheet = document.getElementById('skin-bottom-sheet');
  const backdrop = document.getElementById('skin-bottom-sheet-backdrop');
  if (sheet) sheet.classList.remove('closed');
  if (backdrop) {
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    backdrop.classList.add('opacity-100', 'pointer-events-auto');
  }
}

function closeSkinModal() {
  hapticPulse('light');
  const sheet = document.getElementById('skin-bottom-sheet');
  const backdrop = document.getElementById('skin-bottom-sheet-backdrop');
  if (sheet) sheet.classList.add('closed');
  if (backdrop) {
    backdrop.classList.remove('opacity-100', 'pointer-events-auto');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
  }
}

function renderSkinsGrid(car) {
  const container = document.getElementById('skins-grid');
  if (!container) return;

  container.innerHTML = car.skins.map(skinName => {
    const isSelected = state.tempSkin === skinName;
    const previewUrl = `/api/img/car/${car.id}/${skinName}`;

    return `
      <div 
        onclick="previewSkin('${skinName}')"
        class="bg-slate-900 rounded-xl overflow-hidden border p-1 transition-all active:scale-95 cursor-pointer flex flex-col gap-1 ${
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
            onerror="this.src='/api/img/car/${car.id}/default'"
          >
          ${
            isSelected 
              ? '<span class="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-brand-red shadow"></span>' 
              : ''
          }
        </div>
        <span class="text-[10px] font-semibold text-slate-200 truncate px-1 text-center font-mono">
          ${skinName.replace(/_/g, ' ')}
        </span>
      </div>
    `;
  }).join('');
}

function previewSkin(skinName) {
  hapticPulse('light');
  state.tempSkin = skinName;
  updateSkinLivePreview(state.tempCar.id, skinName);
  renderSkinsGrid(state.tempCar);
}

function updateSkinLivePreview(carId, skinName) {
  const img = document.getElementById('skin-live-preview');
  const title = document.getElementById('skin-live-title');
  if (img) img.src = `/api/img/car/${carId}/${skinName}`;
  if (title) title.textContent = skinName.replace(/_/g, ' ');
}

function confirmSkinSelection() {
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

// ================= SELETOR DE PISTAS =================

function renderTracksGrid() {
  const grid = document.getElementById('tracks-grid');
  if (!grid) return;

  const filtered = state.tracks.filter(track => {
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
        Nenhuma pista encontrada para a pesquisa selecionada.
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(track => {
    const isSelected = state.selectedTrack && state.selectedTrack.id === track.id && (state.selectedLayout === (track.layout || ''));
    const length = track.specs ? track.specs.length : 'N/D';
    const pitboxes = track.specs ? track.specs.pitboxes : 'N/D';
    const country = track.specs ? track.specs.country : '';

    return `
      <div 
        onclick="selectTrackFromCard('${track.id}', '${track.layout || ''}')"
        class="relative bg-brand-card rounded-2xl overflow-hidden border transition-all active:scale-[0.98] cursor-pointer group ${
          isSelected 
            ? 'border-brand-red ring-2 ring-brand-red/50 shadow-xl shadow-brand-red/10' 
            : 'border-brand-border hover:border-slate-700'
        }"
      >
        <div class="relative w-full aspect-[16/9] bg-slate-950 overflow-hidden">
          <img 
            src="${track.preview_url}" 
            alt="${track.name}" 
            loading="lazy" 
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onerror="this.src='/api/img/track/${track.id}'"
          >
          
          <div class="absolute top-2.5 right-2.5 flex items-center gap-1.5">
            ${
              isSelected 
                ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-brand-red text-white shadow-md">PISTA ATIVA</span>'
                : (track.layout ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-mono bg-black/60 text-brand-cyan border border-brand-cyan/30">${track.layout}</span>` : '')
            }
          </div>

          <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2.5">
            <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">${country || 'Circuito'}</span>
            <h3 class="text-sm font-racing font-bold text-white tracking-wide truncate leading-tight">${track.name}</h3>
          </div>
        </div>

        <div class="p-3 flex items-center justify-between text-[10px] font-mono text-slate-300">
          <div class="flex items-center gap-1 text-brand-cyan">
            <span>📏</span>
            <span>${length}</span>
          </div>
          <div class="flex items-center gap-1 text-slate-400">
            <span>🏁</span>
            <span>${pitboxes} Boxes</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function selectTrackFromCard(trackId, layout) {
  hapticPulse('medium');
  const track = state.tracks.find(t => t.id === trackId && (t.layout || '') === layout);
  if (track) {
    selectTrack(track);
    renderTracksGrid();
    showToast(`Pista selecionada: ${track.name}`, '🏁');
  }
}

function selectTrack(track) {
  state.selectedTrack = track;
  state.selectedLayout = track.layout || '';
  updateSummaryBar();
}

// ================= DEFINIÇÃO DE SESSÃO & HORA =================

function selectMode(mode, label) {
  hapticPulse('light');
  state.selectedMode = mode;
  state.selectedModeLabel = label;

  document.querySelectorAll('.mode-btn').forEach(btn => {
    const isThis = btn.getAttribute('data-mode') === mode;
    btn.classList.toggle('active', isThis);
    btn.classList.toggle('border-brand-red', isThis);
    btn.classList.toggle('bg-brand-red/15', isThis);
    btn.classList.toggle('border-slate-800', !isThis);
    btn.classList.toggle('bg-slate-900/60', !isThis);
  });

  const badge = document.getElementById('selected-mode-badge');
  if (badge) badge.textContent = label;

  updateSummaryBar();
  showToast(`Modo alterado para ${label}`, '🎮');
}

function handleTimeSlider(val) {
  const num = parseFloat(val);
  const hours = Math.floor(num);
  const minutes = (num % 1 === 0.5) ? '30' : '00';
  const timeFormatted = `${String(hours).padStart(2, '0')}:${minutes}`;
  
  applyTimeSetting(timeFormatted, num);
}

function setTimePreset(timeStr, numericVal) {
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
    if (carImg) carImg.src = `/api/img/car/${state.selectedCar.id}/${skin}`;
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
    car: state.selectedCar.id,
    skin: state.selectedSkin || 'default',
    track: state.selectedTrack.id,
    layout: state.selectedLayout || '',
    mode: state.selectedMode,
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
      showToast(result.message || 'Corrida lançada no PC com sucesso!', '🏎️');
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

// ================= NAVEGAÇÃO DE ABAS =================

function switchTab(tabId) {
  hapticPulse('light');

  // Esconder todas as abas
  ['tab-garage', 'tab-servers', 'tab-settings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== tabId);
  });

  // Atualizar botões de navegação
  ['nav-tab-garage', 'nav-tab-servers', 'nav-tab-settings'].forEach(navId => {
    const btn = document.getElementById(navId);
    if (!btn) return;
    const isTarget = navId === `nav-${tabId}`;
    btn.classList.toggle('text-brand-red', isTarget);
    btn.classList.toggle('text-slate-400', !isTarget);
  });

  // Mostrar/esconder barra flutuante de lançamento (só na aba da garagem)
  const floatingBar = document.getElementById('floating-launch-bar');
  if (floatingBar) {
    floatingBar.classList.toggle('hidden', tabId !== 'tab-garage');
  }
}

function setGarageSection(section) {
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

  // Atualizar visual dos botões do segmented control
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

  // Mostrar/ocultar busca e chips de marcas
  if (searchContainer) {
    searchContainer.classList.toggle('hidden', section === 'session');
  }
  if (brandChips) {
    brandChips.classList.toggle('hidden', section !== 'cars');
  }

  // Atualizar placeholder da busca
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    if (section === 'cars') searchInput.placeholder = 'Pesquisar por carro, marca...';
    else if (section === 'tracks') searchInput.placeholder = 'Pesquisar por circuito, país...';
  }
}

// ================= SERVIDORES ONLINE =================

function renderServersList(servers) {
  const list = document.getElementById('servers-list');
  if (!list) return;

  if (servers.length === 0) {
    list.innerHTML = `
      <div class="p-8 text-center text-slate-500 text-xs bg-brand-card rounded-2xl border border-brand-border">
        Nenhum servidor favorito guardado. Adiciona um servidor para acesso rápido!
      </div>`;
    return;
  }

  list.innerHTML = servers.map(srv => {
    return `
      <div class="bg-brand-card p-4 rounded-2xl border border-brand-border space-y-3">
        <div class="flex items-start justify-between">
          <div class="min-w-0 flex-1">
            <h3 class="font-racing text-lg font-bold text-white tracking-wide leading-tight truncate">${srv.name}</h3>
            <p class="text-xs text-brand-cyan mt-0.5 truncate">🏁 ${srv.track || 'Circuito Desconhecido'}</p>
          </div>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold ml-2">
            ${srv.ping || 'Online'}
          </span>
        </div>

        <div class="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800">
          <span>IP: ${srv.ip}</span>
          <span>${srv.car_count || ''}</span>
        </div>

        <div class="flex gap-2 pt-1">
          ${
            srv.cm_link 
              ? `<a href="${srv.cm_link}" target="_blank" class="flex-1 py-2 rounded-xl bg-brand-red text-center font-racing text-xs font-bold text-white uppercase tracking-wider shadow-md hover:bg-brand-darkred active:scale-95 transition-transform flex items-center justify-center gap-1.5">
                   <span>🚀</span> JUNTAR VIA CONTENT MANAGER
                 </a>`
              : `<button onclick="copyToClipboard('${srv.ip}')" class="flex-1 py-2 rounded-xl bg-brand-red text-center font-racing text-xs font-bold text-white uppercase tracking-wider shadow-md active:scale-95 transition-transform">
                   COPIAR IP / PORTA
                 </button>`
          }
          <button onclick="deleteServer('${srv.id}')" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 active:scale-95 transition-transform text-xs">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openAddServerModal() {
  hapticPulse('light');
  const modal = document.getElementById('modal-add-server');
  if (modal) {
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.classList.add('opacity-100', 'pointer-events-auto');
  }
}

function closeAddServerModal() {
  hapticPulse('light');
  const modal = document.getElementById('modal-add-server');
  if (modal) {
    modal.classList.remove('opacity-100', 'pointer-events-auto');
    modal.classList.add('opacity-0', 'pointer-events-none');
  }
}

async function saveNewServer() {
  const name = document.getElementById('new-srv-name').value.trim();
  const ip = document.getElementById('new-srv-ip').value.trim();
  const track = document.getElementById('new-srv-track').value.trim();

  if (!name || !ip) {
    showToast('Preenche pelo menos o nome e o IP do servidor', '⚠️');
    return;
  }

  const isCm = ip.startsWith('http') || ip.startsWith('acmanager:');
  const newServer = {
    id: `srv-${Date.now()}`,
    name,
    ip: isCm ? 'Content Manager' : ip,
    track: track || 'Pista Online',
    ping: '20ms',
    cm_link: isCm ? ip : null
  };

  const currentList = state.config.favorite_servers || [];
  currentList.push(newServer);
  state.config.favorite_servers = currentList;

  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite_servers: currentList })
    });
    renderServersList(currentList);
    closeAddServerModal();
    showToast('Servidor adicionado aos favoritos!', '✅');
  } catch (err) {
    showToast('Erro ao guardar servidor', '❌');
  }
}

async function deleteServer(srvId) {
  hapticPulse('medium');
  const currentList = (state.config.favorite_servers || []).filter(s => s.id !== srvId);
  state.config.favorite_servers = currentList;

  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite_servers: currentList })
    });
    renderServersList(currentList);
    showToast('Servidor removido', '🗑️');
  } catch (err) {
    showToast('Erro ao remover servidor', '❌');
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`IP copiado: ${text}`, '📋');
  });
}

// ================= DEFINIÇÕES & CAMINHOS =================

async function saveSettings() {
  hapticPulse('medium');
  const acPath = document.getElementById('input-ac-path').value.trim();
  const raceIni = document.getElementById('input-race-ini').value.trim();
  const remotePc = document.getElementById('input-remote-pc') ? document.getElementById('input-remote-pc').value.trim() : '';

  localStorage.setItem('ac_remote_pc_url', remotePc);
  state.config.remote_pc_url = remotePc;

  try {
    const res = await apiFetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ac_path: acPath,
        race_ini: raceIni,
        remote_pc_url: remotePc
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Definições guardadas com sucesso!', '💾');
      await reloadACData();
    } else {
      showToast('Erro ao guardar definições', '❌');
    }
  } catch (err) {
    showToast('Falha na comunicação com o PC', '❌');
  }
}

async function reloadACData() {
  showToast('A atualizar garagem e pistas...', '🔄');
  await fetchStatus();
  await fetchCars();
  await fetchTracks();
  showToast('Dados do Assetto Corsa atualizados!', '🏎️');
}

// ================= SISTEMA DE TOASTS =================

let toastTimer = null;
function showToast(message, icon = '🚀') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  const toastIcon = document.getElementById('toast-icon');

  if (!toast) return;

  if (toastMsg) toastMsg.textContent = message;
  if (toastIcon) toastIcon.textContent = icon;

  toast.classList.remove('opacity-0', '-translate-y-4');
  toast.classList.add('opacity-100', 'translate-y-0');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', '-translate-y-4');
  }, 2500);
}
