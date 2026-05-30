const DEFAULTS = {
  electricityUse: 41150,
  heatUse: 189000,
  roofArea: 303,
  stHeatPct: 40,
  electricityMix: 'wwz',
  heatMethod: 'districtWood',
  newElectricityMix: 'wwz',
  newHeatMethod: 'districtWood',
  electricityPrice: 0.30,
  heatPrice: 0.068,
  feedInTariff: 0.11,
  discountRate: 2.5,
  horizonYears: 25,
  gridFactor: 0.078,
  currentPvArea: 0,
  currentStArea: 0,
  pvArea: 120,
  pvYield: 180,
  pvSelfShare: 0.4,
  stArea: 0,
  stYield: 450,
  stUtilization: 0.5,
  pvDegradation: 0.7,
  stDegradation: 0.5,
  pvCapexPerM2: 450,
  stCapexPerM2: 900,
  pvCapexTotal: 54000,
  stCapexTotal: 0,
  hpCapex: 85000,
  hpEnabled: false,
  cop: 3.5,
  omPct: 1,
  co2Wwz: 0.078,        // WWZ supplier-specific (from Rathaus Excel)
  co2Swiss: 0.125,      // KBOB 45.020 CH-Verbrauchermix
  co2Hydro: 0.012,      // KBOB 45.016 Wasserkraft
  co2DistrictWood: 0.025, // KBOB 42.003 Heizzentrale Holz ≈ 0.0245
  co2Oil: 0.324,        // KBOB 41.001 Heizöl EL
  co2Gas: 0.230,        // KBOB 41.002 Erdgas
  co2Pellets: 0.028,    // KBOB 41.008 Pellets
  co2DistrictMix: 0.066, // KBOB 42.016 Fernwärme Durchschnitt Netze CH
};

const ELECTRICITY_MIXES = {
  wwz:    { label: 'WWZ WasserSonneStrom', factorId: 'co2Wwz' },
  swiss:  { label: 'Swiss consumption mix', factorId: 'co2Swiss' },
  hydro:  { label: 'Hydropower-heavy supply', factorId: 'co2Hydro' },
  custom: { label: 'Custom grid factor', factorId: null },
};

const HEAT_METHODS = {
  districtWood: { label: 'Wood-chip district heat', factorId: 'co2DistrictWood' },
  oil:          { label: 'Heating oil', factorId: 'co2Oil' },
  gas:          { label: 'Natural gas', factorId: 'co2Gas' },
  pellets:      { label: 'Wood pellets', factorId: 'co2Pellets' },
  districtMix:  { label: 'District heat mix', factorId: 'co2DistrictMix' },
  hp:           { label: 'Heat pump (existing)', factorId: null },
};

const EMBODIED = { pvPerM2: 420, stPerM2: 90, hpUnit: 1200 };

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 0) => Number.isFinite(n) ? n.toLocaleString('de-CH', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—';
const pct = (n, d = 0) => Number.isFinite(n) ? `${fmt(n, d)}%` : '—';

const ids = [
  'electricityUse', 'heatUse', 'roofArea', 'stHeatPct',
  'electricityMix', 'heatMethod', 'newElectricityMix', 'newHeatMethod',
  'electricityPrice', 'heatPrice', 'feedInTariff',
  'discountRate', 'horizonYears', 'gridFactor',
  'currentPvArea', 'currentStArea',
  'pvArea', 'pvYield', 'pvSelfShare',
  'stArea', 'stYield', 'stUtilization',
  'pvDegradation', 'stDegradation',
  'pvCapexPerM2', 'stCapexPerM2',
  'pvCapexTotal', 'stCapexTotal',
  'hpCapex', 'hpEnabled', 'cop', 'omPct',
  'co2Wwz', 'co2Swiss', 'co2Hydro',
  'co2DistrictWood', 'co2Oil', 'co2Gas', 'co2Pellets', 'co2DistrictMix',
];

const rangeIds = {
  currentPvArea: 'currentPvAreaValue',
  currentStArea: 'currentStAreaValue',
  pvArea: 'pvAreaValue',
  pvYield: 'pvYieldValue',
  pvSelfShare: 'pvSelfShareValue',
  stArea: 'stAreaValue',
  stYield: 'stYieldValue',
  stUtilization: 'stUtilizationValue',
  pvDegradation: 'pvDegradationValue',
  stDegradation: 'stDegradationValue',
};

const EXPORT_DISPLACEMENT = 0.85;

function readState() {
  const state = {};
  ids.forEach((id) => {
    const el = $(id);
    if (!el) return;
    if (el.type === 'checkbox') state[id] = el.checked;
    else if (el.type === 'number' || el.type === 'range') state[id] = Number(el.value);
    else state[id] = el.value;
  });
  return state;
}

function writeState(state) {
  Object.entries(state).forEach(([key, value]) => {
    const el = $(key);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = value;
  });
  syncRanges(state);
}

function updateCapexHints(pvArea, stArea, pvRate, stRate) {
  const pvDefault = Math.round(pvArea * pvRate);
  const stDefault = Math.round(stArea * stRate);

  const pvHint = $('pvCapexHint');
  const stHint = $('stCapexHint');
  if (pvHint) pvHint.textContent = pvArea > 0 ? `${fmt(pvArea, 0)} m² × ${fmt(pvRate, 0)} CHF/m²` : 'No PV area selected';
  if (stHint) stHint.textContent = stArea > 0 ? `${fmt(stArea, 0)} m² × ${fmt(stRate, 0)} CHF/m²` : 'No ST area selected';

  const pvEl = $('pvCapexTotal');
  const stEl = $('stCapexTotal');
  if (pvEl && pvEl.dataset.auto !== 'false') pvEl.value = pvDefault;
  if (stEl && stEl.dataset.auto !== 'false') stEl.value = stDefault;
}

function syncRanges(state) {
  $(rangeIds.currentPvArea).textContent = state.roofArea > 0
    ? `${fmt(state.currentPvArea, 0)} m² (${Math.round(state.currentPvArea / state.roofArea * 100)}%)`
    : fmt(state.currentPvArea, 0);
  $(rangeIds.currentStArea).textContent = state.roofArea > 0
    ? `${fmt(state.currentStArea, 0)} m² (${Math.round(state.currentStArea / state.roofArea * 100)}%)`
    : fmt(state.currentStArea, 0);
  $(rangeIds.pvArea).textContent = state.roofArea > 0
    ? `${fmt(state.pvArea, 0)} m² (${Math.round(state.pvArea / state.roofArea * 100)}%)`
    : fmt(state.pvArea, 0);
  $(rangeIds.pvYield).textContent = fmt(state.pvYield, 0);
  $(rangeIds.pvSelfShare).textContent = pct(state.pvSelfShare * 100, 0);
  $(rangeIds.stArea).textContent = fmt(state.stArea, 0);
  $(rangeIds.stYield).textContent = fmt(state.stYield, 0);
  $(rangeIds.stUtilization).textContent = pct(state.stUtilization * 100, 0);
  $(rangeIds.pvDegradation).textContent = `${fmt(state.pvDegradation, 1)}%`;
  $(rangeIds.stDegradation).textContent = `${fmt(state.stDegradation, 1)}%`;

  // Update slider maxes to roof area
  ['pvArea', 'stArea', 'currentPvArea', 'currentStArea', 'rPvArea', 'rStArea'].forEach((id) => {
    const el = $(id);
    if (el) el.max = state.roofArea;
  });

  const newExceedsRoof = state.pvArea + state.stArea > state.roofArea + 1e-9;
  const curExceedsRoof = state.currentPvArea + state.currentStArea > state.roofArea + 1e-9;
  $('roofWarning').classList.toggle('visible', newExceedsRoof || curExceedsRoof);

  // Update roof usage visual bars
  if (state.roofArea > 0) {
    const pvPct = Math.min((state.pvArea / state.roofArea) * 100, 100);
    const stPct = Math.min((state.stArea / state.roofArea) * 100, 100 - pvPct);
    const pvFill = $('pvRoofFill');
    const stPvFill = $('stPvFill');
    const stStFill = $('stStFill');
    if (pvFill) pvFill.style.width = `${pvPct}%`;
    if (stPvFill) stPvFill.style.width = `${pvPct}%`;
    if (stStFill) stStFill.style.width = `${stPct}%`;
    const totalPct = Math.round(pvPct + stPct);
    const usageLabel = $('roofUsageLabel');
    if (usageLabel) {
      usageLabel.textContent = totalPct > 0 ? `${totalPct}% of roof used (${fmt(state.pvArea + state.stArea, 0)} / ${fmt(state.roofArea, 0)} m²)` : '';
    }
  }

  $('mixBadge').textContent = ELECTRICITY_MIXES[state.electricityMix].label;
  $('gridFactorField').style.display = state.electricityMix === 'custom' ? '' : 'none';

  updateCapexHints(state.pvArea, state.stArea, state.pvCapexPerM2, state.stCapexPerM2);
}

function electricityFactor(state) {
  if (state.electricityMix === 'custom') return state.gridFactor;
  const factorId = ELECTRICITY_MIXES[state.electricityMix].factorId;
  const el = factorId ? $(factorId) : null;
  return el ? Number(el.value) : 0;
}

function heatFactor(state) {
  if (state.heatMethod === 'hp') return electricityFactor(state) / Math.max(state.cop, 1e-6);
  const factorId = HEAT_METHODS[state.heatMethod].factorId;
  const el = factorId ? $(factorId) : null;
  return el ? Number(el.value) : 0;
}

function newElectricityFactor(state) {
  if (state.newElectricityMix === 'custom') return state.gridFactor;
  const factorId = ELECTRICITY_MIXES[state.newElectricityMix].factorId;
  const el = factorId ? $(factorId) : null;
  return el ? Number(el.value) : 0;
}

function newHeatFactor(state) {
  if (state.hpEnabled) return newElectricityFactor(state) / Math.max(state.cop, 1e-6);
  if (state.newHeatMethod === 'hp') return newElectricityFactor(state) / Math.max(state.cop, 1e-6);
  const factorId = HEAT_METHODS[state.newHeatMethod].factorId;
  const el = factorId ? $(factorId) : null;
  return el ? Number(el.value) : 0;
}

function annualScenario(state, yearIndex = 0, overrides = {}) {
  const gridEF = electricityFactor(state);
  const heatEF = heatFactor(state);
  const newGridEF = newElectricityFactor(state);
  const newHeatEF = newHeatFactor(state);
  const pvDeg = Math.max(0, 1 - state.pvDegradation / 100);
  const stDeg = Math.max(0, 1 - state.stDegradation / 100);
  const pvFactor = Math.pow(pvDeg, yearIndex);
  const stFactor = Math.pow(stDeg, yearIndex);
  const pvArea = overrides.pvArea ?? state.pvArea;
  const stArea = overrides.stArea ?? state.stArea;

  const curPvGen = state.currentPvArea * state.pvYield * pvFactor;
  const curPvSelf = Math.min(curPvGen * state.pvSelfShare, state.electricityUse);
  // stHeatPct: fraction of raw ST yield deliverable to the building (seasonal match)
  const curStHeat = Math.min(state.currentStArea * state.stYield * stFactor * (state.stHeatPct / 100), state.heatUse);

  const baselineElectricity = Math.max(state.electricityUse - curPvSelf, 0);
  const baselineHeat = Math.max(state.heatUse - curStHeat, 0);
  const baselineCO2 = baselineElectricity * gridEF + baselineHeat * heatEF;
  const baselineCost = baselineElectricity * state.electricityPrice + baselineHeat * state.heatPrice;

  const pvGeneration = pvArea * state.pvYield * pvFactor;
  const pvPotentialSelf = pvGeneration * state.pvSelfShare;

  const heatThermalUseful = Math.min(stArea * state.stYield * stFactor * (state.stHeatPct / 100), baselineHeat);
  const heatAfterThermal = Math.max(baselineHeat - heatThermalUseful, 0);

  const hpElectricity = state.hpEnabled ? heatAfterThermal / Math.max(state.cop, 1e-6) : 0;
  const netElectricDemand = baselineElectricity + hpElectricity;
  const pvSelf = Math.min(pvPotentialSelf, netElectricDemand);
  const pvExport = Math.max(pvGeneration - pvSelf, 0);

  const electricityResidual = Math.max(netElectricDemand - pvSelf, 0);
  const heatResidual = state.hpEnabled ? 0 : heatAfterThermal;

  const scenarioCO2 = electricityResidual * newGridEF + heatResidual * newHeatEF;
  const scenarioCost = electricityResidual * state.electricityPrice + heatResidual * state.heatPrice - pvExport * state.feedInTariff;
  const savings = baselineCost - scenarioCost;

  // Derive effective per-m² rates from total investment fields (scales correctly in optimizer)
  const pvCapexRate = state.pvArea > 0 ? state.pvCapexTotal / state.pvArea : state.pvCapexPerM2;
  const stCapexRate = state.stArea > 0 ? state.stCapexTotal / state.stArea : state.stCapexPerM2;
  const pvCapex = pvArea * pvCapexRate;
  const stCapex = stArea * stCapexRate;
  const hpCapex = state.hpEnabled ? state.hpCapex : 0;
  const capex = pvCapex + stCapex + hpCapex;

  const omRate = state.omPct / 100;
  const om = (pvCapex + stCapex) * omRate + hpCapex * (omRate * 1.5);

  const annualCashflow = savings - om;
  const annualAvoided = baselineCO2 - scenarioCO2;

  return {
    yearIndex, gridEF, heatEF, newGridEF, newHeatEF,
    baselineElectricity, baselineHeat, baselineCO2, baselineCost,
    pvGeneration, pvSelf, pvExport,
    heatThermalUseful, heatAfterThermal, hpElectricity,
    electricityResidual, heatResidual,
    scenarioCO2, scenarioCost, savings,
    capex, om, annualCashflow, annualAvoided,
    pvCapex, stCapex, hpCapex,
  };
}

function lifecycleSeries(state) {
  const horizon = Math.max(1, Math.round(state.horizonYears));
  const discount = state.discountRate / 100;
  const years = [];
  const pvGeneration = [];
  const stGeneration = [];
  const annualAvoided = [];
  const cumulativeNpv = [];
  let npv = -annualScenario(state, 0).capex;

  for (let year = 0; year < horizon; year += 1) {
    const s = annualScenario(state, year);
    years.push(year + 1);
    pvGeneration.push(s.pvGeneration);
    stGeneration.push(s.heatThermalUseful);
    annualAvoided.push(s.annualAvoided / 1000);
    const discounted = s.annualCashflow / Math.pow(1 + discount, year + 1);
    npv += discounted;
    cumulativeNpv.push(npv);
  }

  return { years, pvGeneration, stGeneration, annualAvoided, cumulativeNpv };
}

function annuityFactor(rate, years) {
  if (!Number.isFinite(rate) || !Number.isFinite(years) || years <= 0) return 0;
  if (Math.abs(rate) < 1e-12) return 1 / years;
  return (rate * Math.pow(1 + rate, years)) / (Math.pow(1 + rate, years) - 1);
}

function renderSvg(el, svg) { el.innerHTML = svg; }

function axisTicks(max, count = 5, min = 0) {
  if (max <= min) return [min];
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => min + i * step);
}

function renderStackedBarChart(el, state, scenario) {
  const width = 860;
  const height = 440;
  const pad = { top: 24, right: 30, bottom: 54, left: 68 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const baseElec = scenario.baselineElectricity * scenario.gridEF / 1000;
  const baseHeat = scenario.baselineHeat * scenario.heatEF / 1000;
  const scenElec = scenario.electricityResidual * scenario.newGridEF / 1000;
  const scenHeat = scenario.heatResidual * scenario.newHeatEF / 1000;
  const baseTotal = baseElec + baseHeat;
  const scenTotal = scenElec + scenHeat;
  const maxY = Math.max(baseTotal, scenTotal) * 1.18 || 1;

  const barW = 120;
  const x1 = pad.left + innerW * 0.32 - barW / 2;
  const x2 = pad.left + innerW * 0.72 - barW / 2;

  const toY = (v) => pad.top + (1 - v / maxY) * innerH;
  const segH = (v) => (v / maxY) * innerH;

  const yTicks = axisTicks(maxY, 5);
  const tickMarks = yTicks.map((tick) => {
    const y = toY(tick);
    return `
      <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(105,114,122,0.18)" />
      <text x="${pad.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#67727a">${fmt(tick, 1)}</text>`;
  }).join('');

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Annual snapshot chart">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(255,255,255,0.01)"></rect>
      ${tickMarks}
      <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <text x="${x1 + barW / 2}" y="${height - 18}" text-anchor="middle" font-size="12" fill="#516069">Baseline</text>
      <text x="${x2 + barW / 2}" y="${height - 18}" text-anchor="middle" font-size="12" fill="#516069">Scenario</text>

      <rect x="${x1}" y="${toY(baseHeat)}" width="${barW}" height="${segH(baseHeat)}" rx="10" fill="#8da85f"></rect>
      <rect x="${x1}" y="${toY(baseTotal)}" width="${barW}" height="${segH(baseElec)}" rx="10" fill="#cddab0"></rect>
      <text x="${x1 + barW / 2}" y="${toY(baseTotal) - 8}" text-anchor="middle" font-size="13" font-weight="700" fill="#27413a">${fmt(baseTotal, 2)} t</text>

      <rect x="${x2}" y="${toY(scenHeat)}" width="${barW}" height="${segH(scenHeat)}" rx="10" fill="#6a8b6f"></rect>
      <rect x="${x2}" y="${toY(scenTotal)}" width="${barW}" height="${Math.max(segH(scenElec), 3)}" rx="10" fill="#dfe8cb"></rect>
      <text x="${x2 + barW / 2}" y="${toY(scenTotal) - 8}" text-anchor="middle" font-size="13" font-weight="700" fill="#27413a">${fmt(scenTotal, 2)} t</text>

      <text x="${pad.left - 10}" y="${pad.top - 8}" text-anchor="end" font-size="11" fill="#67727a">tCO₂/y</text>
      <rect x="${width - 212}" y="${pad.top + 6}" width="14" height="14" rx="4" fill="#cddab0"></rect>
      <text x="${width - 192}" y="${pad.top + 17}" font-size="12" fill="#516069">Electricity</text>
      <rect x="${width - 118}" y="${pad.top + 6}" width="14" height="14" rx="4" fill="#8da85f"></rect>
      <text x="${width - 98}" y="${pad.top + 17}" font-size="12" fill="#516069">Heat</text>
    </svg>`;
  renderSvg(el, svg);
}

function renderPvLifecycleChart(el, state, lifecycle) {
  const width = 860;
  const height = 500;
  const pad = { top: 32, right: 28, bottom: 48, left: 72 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const hasST = lifecycle.stGeneration.some((v) => v > 0);
  const allValues = [...lifecycle.pvGeneration, ...(hasST ? lifecycle.stGeneration : [])];
  const maxY = Math.max(...allValues) * 1.15 || 1;
  const n = lifecycle.years.length;

  const toX = (i) => pad.left + (i / Math.max(n - 1, 1)) * innerW;
  const toY = (v) => pad.top + (1 - v / maxY) * innerH;

  const pvPath = lifecycle.pvGeneration.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');
  const stPath = hasST
    ? lifecycle.stGeneration.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ')
    : '';

  const pvFillPath = `${pvPath} L ${toX(n - 1).toFixed(1)} ${(pad.top + innerH).toFixed(1)} L ${pad.left} ${(pad.top + innerH).toFixed(1)} Z`;

  const yTicks = axisTicks(maxY, 5);
  const gridLines = yTicks.map((tick) => {
    const y = toY(tick);
    return `
      <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(105,114,122,0.15)" />
      <text x="${pad.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#67727a">${fmt(tick / 1000, 1)}k</text>`;
  }).join('');

  const xTicks = lifecycle.years.map((yr, i) => {
    if (n > 10 && i % Math.ceil(n / 6) !== 0 && i !== n - 1) return '';
    return `<text x="${toX(i)}" y="${height - 14}" text-anchor="middle" font-size="11" fill="#67727a">${yr}</text>`;
  }).join('');

  const pvFirst = lifecycle.pvGeneration[0];
  const pvLast = lifecycle.pvGeneration[n - 1];
  const dropPct = pvFirst > 0 ? ((pvFirst - pvLast) / pvFirst) * 100 : 0;
  const totalPvKwh = lifecycle.pvGeneration.reduce((a, b) => a + b, 0);

  const lastX = toX(n - 1);
  const lastY = toY(pvLast);
  const annotation = `
    <circle cx="${lastX}" cy="${lastY}" r="4" fill="#3d5b43" />
    <rect x="${lastX - 96}" y="${lastY - 34}" width="92" height="28" rx="8" fill="rgba(39,65,58,0.88)" />
    <text x="${lastX - 50}" y="${lastY - 20}" text-anchor="middle" font-size="11" fill="#e8f0e9">${fmt(pvLast, 0)} kWh</text>
    <text x="${lastX - 50}" y="${lastY - 8}" text-anchor="middle" font-size="10" fill="#a8c9ab">−${fmt(dropPct, 1)}% vs yr 1</text>`;

  const pbYear = lifecycle.cumulativeNpv.findIndex((v) => v >= 0);
  let paybackLine = '';
  if (pbYear >= 0) {
    const pbX = toX(pbYear);
    paybackLine = `
      <line x1="${pbX}" y1="${pad.top}" x2="${pbX}" y2="${pad.top + innerH}" stroke="rgba(179,107,43,0.55)" stroke-width="1.5" stroke-dasharray="5 4" />
      <text x="${pbX + 5}" y="${pad.top + 14}" font-size="11" fill="#b36b2b">Payback yr ${lifecycle.years[pbYear]}</text>`;
  }

  const legend = `
    <rect x="${pad.left}" y="8" width="12" height="12" rx="3" fill="#3d5b43" opacity="0.22"></rect>
    <line x1="${pad.left}" y1="14" x2="${pad.left + 12}" y2="14" stroke="#3d5b43" stroke-width="2.5"></line>
    <text x="${pad.left + 18}" y="18" font-size="12" fill="#516069">PV output (kWh/y)</text>
    ${hasST ? `<line x1="${pad.left + 148}" y1="14" x2="${pad.left + 162}" y2="14" stroke="#5a7680" stroke-width="2.5" stroke-dasharray="5 3"></line>
    <text x="${pad.left + 168}" y="18" font-size="12" fill="#516069">ST heat (kWh/y)</text>` : ''}
    <text x="${width - pad.right}" y="18" text-anchor="end" font-size="11" fill="#66727a">Total PV over ${n}y: ${fmt(totalPvKwh / 1000, 0)}k kWh</text>`;

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="PV production lifecycle chart">
      ${gridLines}
      <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      ${paybackLine}
      <path d="${pvFillPath}" fill="rgba(61,91,67,0.10)" />
      <path d="${pvPath}" fill="none" stroke="#3d5b43" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${hasST ? `<path d="${stPath}" fill="none" stroke="#5a7680" stroke-width="2" stroke-dasharray="6 4" stroke-linecap="round" stroke-linejoin="round" />` : ''}
      ${annotation}
      ${xTicks}
      <text x="${pad.left - 10}" y="${pad.top - 12}" text-anchor="end" font-size="11" fill="#67727a">kWh/y</text>
      ${legend}
    </svg>`;
  renderSvg(el, svg);
}

function linePath(values, width, height, pad) {
  const n = values.length;
  if (!n) return '';
  const maxV = Math.max(...values, 0.0001);
  const minV = Math.min(...values, 0);
  const span = Math.max(maxV - minV, 1e-9);
  return values.map((v, i) => {
    const x = pad.left + (i / Math.max(n - 1, 1)) * (width - pad.left - pad.right);
    const y = pad.top + (1 - ((v - minV) / span)) * (height - pad.top - pad.bottom);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function renderLineChart(el, series, labels, options = {}) {
  const width = 860;
  const height = 500;
  const pad = { top: 22, right: 24, bottom: 48, left: 68 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxValue = Math.max(...series.flatMap((s) => s.values), 0.0001);
  const minValue = Math.min(0, ...series.flatMap((s) => s.values));
  const span = Math.max(maxValue - minValue, 1e-9);
  const yTicks = axisTicks(maxValue, 5, minValue < 0 ? minValue : 0);

  const axes = yTicks.map((tick) => {
    const y = pad.top + (1 - ((tick - minValue) / span)) * innerH;
    return `
      <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(105,114,122,0.18)" />
      <text x="${pad.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#67727a">${fmt(tick, options.tickDecimals ?? 0)}</text>`;
  }).join('');

  const xTicks = labels.map((label, i) => {
    if (labels.length > 10 && i % Math.ceil(labels.length / 6) !== 0 && i !== labels.length - 1) return '';
    const x = pad.left + (i / Math.max(labels.length - 1, 1)) * innerW;
    return `<text x="${x}" y="${height - 14}" text-anchor="middle" font-size="11" fill="#67727a">${label}</text>`;
  }).join('');

  const palette = ['#b36b2b', '#3d5b43', '#5a7680', '#7b5f8f'];
  const zeroY = pad.top + (1 - ((0 - minValue) / span)) * innerH;

  const fills = series.map((s, i) => {
    const d = linePath(s.values, width, height, pad);
    const n = s.values.length;
    const fillClose = `L ${pad.left + ((n - 1) / Math.max(n - 1, 1)) * innerW} ${zeroY} L ${pad.left} ${zeroY} Z`;
    return `<path d="${d} ${fillClose}" fill="${s.color ?? palette[i % palette.length]}" opacity="0.07" />`;
  }).join('');

  const paths = series.map((s, i) => {
    const d = linePath(s.values, width, height, pad);
    return `<path d="${d}" fill="none" stroke="${s.color ?? palette[i % palette.length]}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`;
  }).join('');

  const dots = series.flatMap((s, si) => s.values.map((v, vi) => {
    const x = pad.left + (vi / Math.max(s.values.length - 1, 1)) * innerW;
    const y = pad.top + (1 - ((v - minValue) / span)) * innerH;
    return `<circle cx="${x}" cy="${y}" r="2.6" fill="${s.color ?? palette[si % palette.length]}" opacity="0.9"></circle>`;
  })).join('');

  const legend = series.map((s, i) => `
    <g transform="translate(${width - 260 + i * 130}, 10)">
      <rect x="0" y="0" width="12" height="12" rx="3" fill="${s.color ?? palette[i % palette.length]}"></rect>
      <text x="18" y="10" font-size="12" fill="#516069">${s.label}</text>
    </g>`).join('');

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Lifecycle chart">
      ${axes}
      <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      ${minValue < 0 ? `<line x1="${pad.left}" y1="${zeroY}" x2="${width - pad.right}" y2="${zeroY}" stroke="rgba(23,33,38,0.22)" stroke-dasharray="4 3" />` : ''}
      ${fills}${paths}${dots}${legend}${xTicks}
    </svg>`;
  renderSvg(el, svg);
}

function renderOptimizerChart(el, state) {
  const width = 860;
  const height = 480;
  const pad = { top: 44, right: 24, bottom: 56, left: 64 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const points = [];
  let bestCost = { x: 0, value: Infinity };
  let bestCo2 = { x: 0, value: -Infinity };

  const totalElec = Math.max(state.electricityUse, 1);
  const totalHeat = Math.max(state.heatUse, 1);

  for (let i = 0; i <= 48; i += 1) {
    const x = i / 48;
    const pvArea = state.roofArea * x;
    const stArea = state.roofArea * (1 - x);
    const s = annualScenario(state, 0, { pvArea, stArea });
    const annualizedCapex = s.capex * annuityFactor(state.discountRate / 100, Math.max(1, Math.round(state.horizonYears)));
    const abatement = s.annualAvoided > 0 ? ((annualizedCapex + s.om - s.savings) / (s.annualAvoided / 1000)) : Infinity;
    const pvCoverage = s.pvSelf / totalElec;
    const stCoverage = s.heatThermalUseful / totalHeat;
    points.push({ x, pvCoverage, stCoverage, avoided: s.annualAvoided / 1000 });
    if (Number.isFinite(abatement) && abatement < bestCost.value) bestCost = { x, value: abatement };
    if (s.annualAvoided > bestCo2.value) bestCo2 = { x, value: s.annualAvoided };
  }

  // Find equilibrium: crossing point where pvCoverage == stCoverage
  let equilibrium = null;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const da = a.pvCoverage - a.stCoverage;
    const db = b.pvCoverage - b.stCoverage;
    if (da * db <= 0 && da !== db) {
      const t = da / (da - db);
      equilibrium = a.x + t * (b.x - a.x);
      break;
    }
  }

  // Actual selection as fraction of roof
  const selFrac = state.roofArea > 0 ? Math.min(state.pvArea / state.roofArea, 1) : null;

  const toX = (f) => (pad.left + f * innerW).toFixed(1);
  const toY = (v) => (pad.top + (1 - Math.min(Math.max(v, 0), 1)) * innerH).toFixed(1);

  const pvPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x)} ${toY(p.pvCoverage)}`).join(' ');
  const stPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x)} ${toY(p.stCoverage)}`).join(' ');

  const gridLines = [0, 25, 50, 75, 100].map((pct) => {
    const y = toY(pct / 100);
    return `
      <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(105,114,122,0.15)" />
      <text x="${pad.left - 8}" y="${+y + 4}" text-anchor="end" font-size="11" fill="#67727a">${pct}%</text>`;
  }).join('');

  const xLabels = Array.from({ length: 6 }, (_, i) => {
    const f = i / 5;
    return `<text x="${toX(f)}" y="${pad.top + innerH + 16}" text-anchor="middle" font-size="11" fill="#67727a">${Math.round(f * 100)}%</text>`;
  }).join('');

  // x* line: lowest abatement cost split
  const optSvg = (() => {
    const ox = toX(bestCost.x);
    return `
      <line x1="${ox}" y1="${pad.top}" x2="${ox}" y2="${pad.top + innerH}" stroke="#2e7d32" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6"/>
      <text x="${ox}" y="${pad.top - 8}" text-anchor="middle" font-size="10" fill="#2e7d32">x* ${Math.round(bestCost.x * 100)}% PV</text>`;
  })();

  const eqSvg = equilibrium != null ? (() => {
    const ex = toX(equilibrium);
    const eqPt = points[Math.min(Math.round(equilibrium * 48), points.length - 1)];
    const ey = toY(eqPt.pvCoverage);
    return `
      <line x1="${ex}" y1="${pad.top}" x2="${ex}" y2="${pad.top + innerH}" stroke="#1565c0" stroke-width="1.5" stroke-dasharray="5 3" opacity="0.7"/>
      <circle cx="${ex}" cy="${ey}" r="5" fill="#1565c0" opacity="0.85"/>
      <text x="${ex}" y="${pad.top - 8}" text-anchor="middle" font-size="10" fill="#1565c0">Equilibrium ${Math.round(equilibrium * 100)}% PV</text>`;
  })() : '';

  const selSvg = selFrac != null ? (() => {
    const sx = toX(selFrac);
    return `
      <line x1="${sx}" y1="${pad.top}" x2="${sx}" y2="${pad.top + innerH}" stroke="#b36b2b" stroke-width="2" opacity="0.9"/>
      <text x="${sx}" y="${pad.top - 20}" text-anchor="middle" font-size="10" fill="#b36b2b">Selected</text>
      <text x="${sx}" y="${pad.top - 8}" text-anchor="middle" font-size="10" fill="#b36b2b">${Math.round(state.pvArea)}m² PV / ${Math.round(state.stArea)}m² ST</text>`;
  })() : '';

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Roof optimizer chart">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(255,255,255,0.01)"></rect>
      ${gridLines}
      <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      ${optSvg}
      ${eqSvg}
      ${selSvg}
      <path d="${pvPath}" fill="none" stroke="#2e7d32" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${stPath}" fill="none" stroke="#8b5e3c" stroke-width="2.5" stroke-dasharray="7 4" stroke-linecap="round" stroke-linejoin="round" />
      ${xLabels}
      <text x="${pad.left + 4}" y="${height - 4}" text-anchor="start" font-size="11" fill="#67727a">← 100% Solar Thermal</text>
      <text x="${width - pad.right - 4}" y="${height - 4}" text-anchor="end" font-size="11" fill="#67727a">100% PV →</text>
      <text x="${pad.left - 48}" y="${pad.top + innerH / 2}" text-anchor="middle" font-size="11" fill="#67727a" transform="rotate(-90 ${pad.left - 48} ${pad.top + innerH / 2})">% of total demand covered</text>
      <line x1="${pad.left + 10}" y1="${pad.top + 22}" x2="${pad.left + 28}" y2="${pad.top + 22}" stroke="#2e7d32" stroke-width="2.5" />
      <text x="${pad.left + 34}" y="${pad.top + 26}" font-size="12" fill="#516069">PV covers electricity demand</text>
      <line x1="${pad.left + 236}" y1="${pad.top + 22}" x2="${pad.left + 254}" y2="${pad.top + 22}" stroke="#8b5e3c" stroke-width="2.5" stroke-dasharray="6 3" />
      <text x="${pad.left + 260}" y="${pad.top + 26}" font-size="12" fill="#516069">ST covers heat demand</text>
      <line x1="${pad.left + 402}" y1="${pad.top + 22}" x2="${pad.left + 420}" y2="${pad.top + 22}" stroke="#2e7d32" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6" />
      <text x="${pad.left + 426}" y="${pad.top + 26}" font-size="12" fill="#516069">x* optimal</text>
      <line x1="${pad.left + 502}" y1="${pad.top + 22}" x2="${pad.left + 520}" y2="${pad.top + 22}" stroke="#1565c0" stroke-width="1.5" stroke-dasharray="5 3" opacity="0.7" />
      <text x="${pad.left + 526}" y="${pad.top + 26}" font-size="12" fill="#516069">Equilibrium</text>
      <line x1="${pad.left + 614}" y1="${pad.top + 22}" x2="${pad.left + 632}" y2="${pad.top + 22}" stroke="#b36b2b" stroke-width="2" />
      <text x="${pad.left + 638}" y="${pad.top + 26}" font-size="12" fill="#516069">Selected</text>
    </svg>`;
  renderSvg(el, svg);
  $('optimizerCostBadge').textContent = `x* = ${Math.round(bestCost.x * 100)}% PV / ${fmt(bestCost.value, 0)} CHF/t`;
  $('optimizerCo2Badge').textContent = `max CO₂ = ${Math.round(bestCo2.x * 100)}% PV / ${fmt(bestCo2.value / 1000, 2)} t/y`;
}

function renderSummaryTable(state, scenario, lifecycle) {
  const n = lifecycle.years.length;
  const pvFirst = lifecycle.pvGeneration[0];
  const pvLast = lifecycle.pvGeneration[n - 1];
  const totalPv = lifecycle.pvGeneration.reduce((a, b) => a + b, 0);
  const rows = [
    ['Baseline CO₂', `${fmt(scenario.baselineCO2 / 1000, 2)} tCO₂/y`],
    ['Scenario CO₂', `${fmt(scenario.scenarioCO2 / 1000, 2)} tCO₂/y`],
    ['CO₂ avoided (yr 1)', `${fmt(scenario.annualAvoided / 1000, 2)} tCO₂/y`],
    ['Baseline cost', `${fmt(scenario.baselineCost, 0)} CHF/y`],
    ['Scenario cost', `${fmt(scenario.scenarioCost, 0)} CHF/y`],
    ['Annual savings', `${fmt(scenario.savings, 0)} CHF/y`],
    ['PV output yr 1', `${fmt(pvFirst, 0)} kWh`],
    [`PV output yr ${n}`, `${fmt(pvLast, 0)} kWh`],
    [`Total PV over ${n} years`, `${fmt(totalPv / 1000, 0)} MWh`],
    ['PV self-consumption', `${fmt(scenario.pvSelf, 0)} kWh/y`],
    ['PV export', `${fmt(scenario.pvExport, 0)} kWh/y`],
    ['Solar thermal useful heat', `${fmt(scenario.heatThermalUseful, 0)} kWh/y`],
    ['Lifecycle NPV', `${fmt(lifecycle.cumulativeNpv[n - 1], 0)} CHF`],
    ['Total CAPEX', `${fmt(scenario.capex, 0)} CHF`],
  ];
  const tbody = $('summaryTable').querySelector('tbody');
  tbody.innerHTML = rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('');
}

function renderKpis(state, scenario, lifecycle) {
  const n = lifecycle.years.length;
  const annualized = scenario.capex * annuityFactor(state.discountRate / 100, Math.max(1, Math.round(state.horizonYears)));
  const abatement = scenario.annualAvoided > 0 ? ((annualized + scenario.om - scenario.savings) / (scenario.annualAvoided / 1000)) : NaN;
  const lcoe = (state.pvArea > 0 && state.pvCapexTotal > 0)
    ? (state.pvCapexTotal * annuityFactor(state.discountRate / 100, Math.max(1, n)) + state.pvCapexTotal * (state.omPct / 100)) / Math.max(scenario.pvGeneration, 1e-6)
    : NaN;
  const selfSuff = scenario.baselineElectricity > 0 ? (scenario.pvSelf / scenario.baselineElectricity) * 100 : 0;
  const embodied = state.pvArea * EMBODIED.pvPerM2 + state.stArea * EMBODIED.stPerM2 + (state.hpEnabled ? EMBODIED.hpUnit : 0);
  const carbonPb = scenario.annualAvoided > 0 ? embodied / scenario.annualAvoided : NaN;
  const payback = scenario.annualCashflow > 0 ? scenario.capex / scenario.annualCashflow : NaN;

  $('kpiCo2').textContent = `${fmt(scenario.annualAvoided / 1000, 2)} t`;
  $('kpiCo2Sub').textContent = scenario.baselineCO2 > 0 ? `${fmt((scenario.annualAvoided / scenario.baselineCO2) * 100, 0)}% of baseline` : 'of baseline';
  $('kpiAbatement').textContent = Number.isFinite(abatement) ? `${fmt(abatement, 0)}` : '—';
  $('kpiNpv').textContent = `${fmt(lifecycle.cumulativeNpv[n - 1], 0)} CHF`;
  $('kpiPayback').textContent = Number.isFinite(payback) ? fmt(payback, 1) : '—';
  $('kpiLcoe').textContent = Number.isFinite(lcoe) ? fmt(lcoe, 2) : '—';
  $('kpiSelfSuff').textContent = `${fmt(selfSuff, 0)}%`;
  $('kpiCarbonPb').textContent = Number.isFinite(carbonPb) ? fmt(carbonPb, 1) : '—';
  $('kpiCapex').textContent = `${fmt(scenario.capex, 0)} CHF`;
}

function refresh() {
  const state = readState();
  syncRanges(state);

  const scenario = annualScenario(state, 0);
  const lifecycle = lifecycleSeries(state);

  renderStackedBarChart($('snapshotChart'), state, scenario);
  renderPvLifecycleChart($('pvLifecycleChart'), state, lifecycle);
  renderLineChart($('cashflowChart'), [{ label: 'Cumulative NPV (CHF)', values: lifecycle.cumulativeNpv, color: '#b36b2b' }], lifecycle.years.map(String), { tickDecimals: 0 });
  renderKpis(state, scenario, lifecycle);
  renderSummaryTable(state, scenario, lifecycle);
  renderOptimizerChart($('optimizerChart'), state);
}

function syncResultSliders(state) {
  const map = [
    ['rPvArea', 'pvArea', (v) => fmt(v, 0), 'rPvAreaValue'],
    ['rStArea', 'stArea', (v) => fmt(v, 0), 'rStAreaValue'],
    ['rPvSelfShare', 'pvSelfShare', (v) => pct(v * 100, 0), 'rPvSelfShareValue'],
  ];
  map.forEach(([rid, key, format, rvid]) => {
    const el = $(rid);
    if (el) { el.value = state[key]; $(rvid).textContent = format(state[key]); }
  });
}

function calculate() {
  const state = readState();
  syncRanges(state);
  syncResultSliders(state);
  refresh();
  document.querySelector('.shell').classList.replace('show-inputs', 'show-results');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showInputs() {
  document.querySelector('.shell').classList.replace('show-results', 'show-inputs');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetToDefaults() {
  writeState(DEFAULTS);
  const pvEl = $('pvCapexTotal');
  const stEl = $('stCapexTotal');
  if (pvEl) pvEl.dataset.auto = 'true';
  if (stEl) stEl.dataset.auto = 'true';
  updateCapexHints(DEFAULTS.pvArea, DEFAULTS.stArea, DEFAULTS.pvCapexPerM2, DEFAULTS.stCapexPerM2);
  syncRangeLabels();
  showInputs();
}

function loadRathausBaseline() {
  const baseline = {
    ...DEFAULTS,
    electricityUse: 41150,
    heatUse: 189000,
    electricityMix: 'wwz',
    heatMethod: 'districtWood',
    electricityPrice: 0.30,
    heatPrice: 0.068,
    pvArea: 0,
    stArea: 0,
    pvCapexTotal: 0,
    stCapexTotal: 0,
    hpEnabled: false,
  };
  writeState(baseline);
  const pvEl = $('pvCapexTotal');
  const stEl = $('stCapexTotal');
  if (pvEl) pvEl.dataset.auto = 'true';
  if (stEl) stEl.dataset.auto = 'true';
  updateCapexHints(0, 0, DEFAULTS.pvCapexPerM2, DEFAULTS.stCapexPerM2);
  syncRangeLabels();
  showInputs();
}

function exportCsv() {
  const state = readState();
  const lifecycle = lifecycleSeries(state);
  const scenario = annualScenario(state, 0);
  const n = lifecycle.years.length;
  const rows = [
    ['Metric', 'Value'],
    ['Electricity use (kWh/y)', state.electricityUse],
    ['Heat use (kWh/y)', state.heatUse],
    ['Roof area (m²)', state.roofArea],
    ['Electricity mix', ELECTRICITY_MIXES[state.electricityMix].label],
    ['Heat method', HEAT_METHODS[state.heatMethod].label],
    ['PV area (m²)', state.pvArea],
    ['ST area (m²)', state.stArea],
    ['PV output yr 1 (kWh)', Math.round(lifecycle.pvGeneration[0])],
    [`PV output yr ${n} (kWh)`, Math.round(lifecycle.pvGeneration[n - 1])],
    [`Total PV over ${n} years (MWh)`, (lifecycle.pvGeneration.reduce((a, b) => a + b, 0) / 1000).toFixed(1)],
    ['Annual avoided CO₂ (t)', (scenario.annualAvoided / 1000).toFixed(3)],
    ['Scenario cost (CHF/y)', Math.round(scenario.scenarioCost)],
    ['Annual savings (CHF/y)', Math.round(scenario.savings)],
    ['Total CAPEX (CHF)', Math.round(scenario.capex)],
    ['Lifecycle NPV (CHF)', Math.round(lifecycle.cumulativeNpv[n - 1])],
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'carbon-reduction-oberageri-scenario.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function syncRangeLabels() {
  const state = readState();
  syncRanges(state);
}

// Enforce roof area constraint: when any PV or ST area slider moves,
// clamp the paired slider so their sum never exceeds roofArea.
function applyRoofConstraint(movedId) {
  const roofArea = Number($('roofArea').value);

  if (movedId === 'currentPvArea' || movedId === 'currentStArea') {
    const pvEl = $('currentPvArea');
    const stEl = $('currentStArea');
    if (movedId === 'currentPvArea') {
      const pv = Math.min(Number(pvEl.value), roofArea);
      pvEl.value = pv;
      const maxSt = Math.max(0, roofArea - pv);
      if (Number(stEl.value) > maxSt) stEl.value = maxSt;
    } else {
      const st = Math.min(Number(stEl.value), roofArea);
      stEl.value = st;
      const maxPv = Math.max(0, roofArea - st);
      if (Number(pvEl.value) > maxPv) pvEl.value = maxPv;
    }
    return;
  }

  const pvEl = $('pvArea');
  const stEl = $('stArea');
  const rPvEl = $('rPvArea');
  const rStEl = $('rStArea');

  if (movedId === 'pvArea' || movedId === 'rPvArea') {
    const pv = Math.min(Number(pvEl.value), roofArea);
    pvEl.value = pv;
    if (rPvEl) rPvEl.value = pv;
    const maxSt = Math.max(0, roofArea - pv);
    if (Number(stEl.value) > maxSt) {
      stEl.value = maxSt;
      if (rStEl) rStEl.value = maxSt;
    }
  } else {
    const st = Math.min(Number(stEl.value), roofArea);
    stEl.value = st;
    if (rStEl) rStEl.value = st;
    const maxPv = Math.max(0, roofArea - st);
    if (Number(pvEl.value) > maxPv) {
      pvEl.value = maxPv;
      if (rPvEl) rPvEl.value = maxPv;
    }
  }
}

function bindEvents() {
  Object.keys(rangeIds).forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => {
      if (id === 'pvArea' || id === 'stArea' || id === 'currentPvArea' || id === 'currentStArea') {
        applyRoofConstraint(id);
      }
      if (id === 'pvArea' || id === 'stArea') {
        updateCapexHints(
          Number($('pvArea').value),
          Number($('stArea').value),
          Number($('pvCapexPerM2').value) || DEFAULTS.pvCapexPerM2,
          Number($('stCapexPerM2').value) || DEFAULTS.stCapexPerM2,
        );
      }
      syncRangeLabels();
    });
  });

  $('electricityMix').addEventListener('change', syncRangeLabels);

  // Expert panel rates affect CAPEX hints
  ['pvCapexPerM2', 'stCapexPerM2'].forEach((id) => {
    const el = $(id);
    if (el) {
      el.addEventListener('input', () => {
        updateCapexHints(
          Number($('pvArea').value),
          Number($('stArea').value),
          Number($('pvCapexPerM2').value) || DEFAULTS.pvCapexPerM2,
          Number($('stCapexPerM2').value) || DEFAULTS.stCapexPerM2,
        );
      });
    }
  });

  // Mark CAPEX fields as manually overridden when user edits them
  const pvCapexEl = $('pvCapexTotal');
  const stCapexEl = $('stCapexTotal');
  if (pvCapexEl) pvCapexEl.addEventListener('input', () => { pvCapexEl.dataset.auto = 'false'; });
  if (stCapexEl) stCapexEl.addEventListener('input', () => { stCapexEl.dataset.auto = 'false'; });

  // Reset CAPEX to area-based default
  const pvResetBtn = $('pvCapexResetBtn');
  if (pvResetBtn) {
    pvResetBtn.addEventListener('click', () => {
      const pvEl = $('pvCapexTotal');
      if (pvEl) { pvEl.dataset.auto = 'true'; }
      updateCapexHints(
        Number($('pvArea').value),
        Number($('stArea').value),
        Number($('pvCapexPerM2').value) || DEFAULTS.pvCapexPerM2,
        Number($('stCapexPerM2').value) || DEFAULTS.stCapexPerM2,
      );
    });
  }
  const stResetBtn = $('stCapexResetBtn');
  if (stResetBtn) {
    stResetBtn.addEventListener('click', () => {
      const stEl = $('stCapexTotal');
      if (stEl) { stEl.dataset.auto = 'true'; }
      updateCapexHints(
        Number($('pvArea').value),
        Number($('stArea').value),
        Number($('pvCapexPerM2').value) || DEFAULTS.pvCapexPerM2,
        Number($('stCapexPerM2').value) || DEFAULTS.stCapexPerM2,
      );
    });
  }

  // HP CAPEX estimate from heat demand
  const hpEstBtn = $('hpCapexEstBtn');
  if (hpEstBtn) {
    hpEstBtn.addEventListener('click', () => {
      const heatUse = Number($('heatUse').value) || DEFAULTS.heatUse;
      const estimated = Math.round(heatUse / 2000 * 900 / 1000) * 1000;
      $('hpCapex').value = estimated;
      const hint = $('hpCapexHint');
      if (hint) hint.textContent = `${fmt(heatUse, 0)} kWh ÷ 2000 h × 900 CHF/kW_th`;
    });
  }

  $('calculateBtn').addEventListener('click', calculate);
  $('backBtn').addEventListener('click', showInputs);
  $('resetBtn').addEventListener('click', resetToDefaults);
  $('rathausBtn').addEventListener('click', loadRathausBaseline);
  $('csvBtn').addEventListener('click', exportCsv);

  // Results quick-adjust sliders with roof constraint
  [
    ['rPvArea', 'pvArea', (v) => fmt(v, 0), 'rPvAreaValue'],
    ['rStArea', 'stArea', (v) => fmt(v, 0), 'rStAreaValue'],
    ['rPvSelfShare', 'pvSelfShare', (v) => pct(v * 100, 0), 'rPvSelfShareValue'],
  ].forEach(([rid, iid, format, rvid]) => {
    const el = $(rid);
    if (!el) return;
    el.addEventListener('input', () => {
      $(iid).value = el.value;
      if (rid === 'rPvArea' || rid === 'rStArea') {
        applyRoofConstraint(rid);
        // Sync display values after constraint
        $(rvid).textContent = format(Number($(iid).value));
        el.value = $(iid).value;
        // Also update the other result slider display
        if (rid === 'rPvArea') {
          $('rStAreaValue').textContent = fmt(Number($('stArea').value), 0);
          $('rStArea').value = $('stArea').value;
        } else {
          $('rPvAreaValue').textContent = fmt(Number($('pvArea').value), 0);
          $('rPvArea').value = $('pvArea').value;
        }
      } else {
        $(rvid).textContent = format(Number(el.value));
      }
      refresh();
    });
  });
}

function init() {
  writeState(DEFAULTS);
  const pvEl = $('pvCapexTotal');
  const stEl = $('stCapexTotal');
  if (pvEl) pvEl.dataset.auto = 'true';
  if (stEl) stEl.dataset.auto = 'true';
  bindEvents();
  syncRangeLabels();
}

window.addEventListener('DOMContentLoaded', init);
