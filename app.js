const DEFAULTS = {
  electricityUse: 41150,
  heatUse: 120000,
  roofArea: 220,
  usefulHeatLoad: 20600,
  electricityMix: 'wwz',
  heatMethod: 'districtWood',
  electricityPrice: 0.28,
  heatPrice: 0.12,
  feedInTariff: 0.11,
  discountRate: 2.5,
  horizonYears: 25,
  gridFactor: 0.019,
  pvArea: 120,
  pvYield: 180,
  pvSelfShare: 0.4,
  stArea: 0,
  stYield: 450,
  stUtilization: 0.5,
  pvDegradation: 0.7,
  stDegradation: 0.5,
  exportDisplacement: 0.85,
  ledReduction: 15,
  ledCapex: 18000,
  smartReduction: 10,
  smartCapex: 22000,
  pvCapexPerM2: 450,
  stCapexPerM2: 900,
  hpCapex: 85000,
  hpEnabled: false,
  cop: 3.5,
  omPct: 1,
  roofOptimizer: true,
  annualView: true,
  customGridVisible: false,
};

const ELECTRICITY_MIXES = {
  wwz: { label: 'WWZ WasserSonneStrom', factor: 0.019 },
  swiss: { label: 'Swiss consumption mix', factor: 0.128 },
  hydro: { label: 'Hydropower-heavy supply', factor: 0.006 },
  custom: { label: 'Custom grid factor', factor: null },
};

const HEAT_METHODS = {
  districtWood: { label: 'Wood-chip district heat', factor: 0.025 },
  oil: { label: 'Heating oil', factor: 0.30 },
  gas: { label: 'Natural gas', factor: 0.23 },
  pellets: { label: 'Wood pellets', factor: 0.03 },
  districtMix: { label: 'District heat mix', factor: 0.13 },
  hp: { label: 'Heat pump (existing)', factor: null },
};

const EMBODIED = { pvPerM2: 420, stPerM2: 90, hpUnit: 1200, ledFixed: 12 };

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 0) => Number.isFinite(n) ? n.toLocaleString('de-CH', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—';
const pct = (n, d = 0) => Number.isFinite(n) ? `${fmt(n, d)}%` : '—';

const ids = [
  'electricityUse','heatUse','roofArea','usefulHeatLoad','electricityMix','heatMethod','electricityPrice','heatPrice',
  'feedInTariff','discountRate','horizonYears','gridFactor','pvArea','pvYield','pvSelfShare','stArea','stYield',
  'stUtilization','pvDegradation','stDegradation','exportDisplacement','ledReduction','ledCapex','smartReduction',
  'smartCapex','pvCapexPerM2','stCapexPerM2','hpCapex','hpEnabled','cop','omPct','roofOptimizer','annualView',
  'customGridVisible'
];

const rangeIds = {
  pvArea: 'pvAreaValue',
  pvYield: 'pvYieldValue',
  pvSelfShare: 'pvSelfShareValue',
  stArea: 'stAreaValue',
  stYield: 'stYieldValue',
  stUtilization: 'stUtilizationValue',
  pvDegradation: 'pvDegradationValue',
  stDegradation: 'stDegradationValue',
  exportDisplacement: 'exportDisplacementValue',
  ledReduction: 'ledReductionValue',
  smartReduction: 'smartReductionValue'
};

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

function syncRanges(state) {
  $(rangeIds.pvArea).textContent = fmt(state.pvArea, 0);
  $(rangeIds.pvYield).textContent = fmt(state.pvYield, 0);
  $(rangeIds.pvSelfShare).textContent = pct(state.pvSelfShare * 100, 0);
  $(rangeIds.stArea).textContent = fmt(state.stArea, 0);
  $(rangeIds.stYield).textContent = fmt(state.stYield, 0);
  $(rangeIds.stUtilization).textContent = pct(state.stUtilization * 100, 0);
  $(rangeIds.pvDegradation).textContent = `${fmt(state.pvDegradation, 1)}%`;
  $(rangeIds.stDegradation).textContent = `${fmt(state.stDegradation, 1)}%`;
  $(rangeIds.exportDisplacement).textContent = pct(state.exportDisplacement * 100, 0);
  $(rangeIds.ledReduction).textContent = pct(state.ledReduction, 0);
  $(rangeIds.smartReduction).textContent = pct(state.smartReduction, 0);
  $('roofWarning').classList.toggle('visible', state.pvArea + state.stArea > state.roofArea + 1e-9);
  $('mixBadge').textContent = ELECTRICITY_MIXES[state.electricityMix].label;
  $('snapshotBadge').textContent = state.annualView ? 'Annual model active' : 'Annual model hidden';
  $('optimizerSection').style.display = state.roofOptimizer ? '' : 'none';
  $('annualView').checked = state.annualView;
  $('roofOptimizer').checked = state.roofOptimizer;
  $('customGridVisible').checked = state.customGridVisible;
  $('gridFactor').parentElement.style.display = state.customGridVisible || state.electricityMix === 'custom' ? '' : 'none';
}

function electricityFactor(state) {
  return state.electricityMix === 'custom' ? state.gridFactor : ELECTRICITY_MIXES[state.electricityMix].factor;
}

function heatFactor(state) {
  const method = HEAT_METHODS[state.heatMethod];
  if (state.heatMethod === 'hp') return electricityFactor(state) / Math.max(state.cop, 1e-6);
  return method.factor;
}

function annualScenario(state, yearIndex = 0, overrides = {}) {
  const gridEF = electricityFactor(state);
  const heatEF = heatFactor(state);
  const pvDeg = Math.max(0, 1 - state.pvDegradation / 100);
  const stDeg = Math.max(0, 1 - state.stDegradation / 100);
  const pvFactor = Math.pow(pvDeg, yearIndex);
  const stFactor = Math.pow(stDeg, yearIndex);
  const pvArea = overrides.pvArea ?? state.pvArea;
  const stArea = overrides.stArea ?? state.stArea;

  const baselineElectricity = state.electricityUse;
  const baselineHeat = state.heatUse;
  const baselineCO2 = baselineElectricity * gridEF + baselineHeat * heatEF;

  const reducedElectricity = baselineElectricity * (1 - state.ledReduction / 100);
  const reducedHeat = baselineHeat * (1 - state.smartReduction / 100);

  const pvGeneration = pvArea * state.pvYield * pvFactor;
  const pvPotentialSelf = pvGeneration * state.pvSelfShare;

  const heatThermalRaw = stArea * state.stYield * stFactor * state.stUtilization;
  const heatThermalUseful = Math.min(heatThermalRaw, state.usefulHeatLoad);
  const heatAfterThermal = Math.max(reducedHeat - heatThermalUseful, 0);

  const hpElectricity = state.hpEnabled ? heatAfterThermal / Math.max(state.cop, 1e-6) : 0;
  const netElectricDemandBeforePV = reducedElectricity + hpElectricity;
  const pvSelf = Math.min(pvPotentialSelf, netElectricDemandBeforePV);
  const pvExport = Math.max(pvGeneration - pvSelf, 0);

  const electricityResidual = Math.max(netElectricDemandBeforePV - pvSelf, 0);
  const heatResidual = state.hpEnabled ? 0 : heatAfterThermal;

  const avoidedLED = baselineElectricity * (state.ledReduction / 100) * gridEF;
  const avoidedSmart = state.hpEnabled
    ? baselineHeat * (state.smartReduction / 100) * (gridEF / Math.max(state.cop, 1e-6))
    : baselineHeat * (state.smartReduction / 100) * heatEF;
  const avoidedST = state.hpEnabled
    ? heatThermalUseful * (gridEF / Math.max(state.cop, 1e-6))
    : heatThermalUseful * heatEF;
  const avoidedHP = state.hpEnabled
    ? heatAfterThermal * (heatEF - gridEF / Math.max(state.cop, 1e-6))
    : 0;
  const avoidedPV = pvSelf * gridEF + pvExport * gridEF * state.exportDisplacement;

  const scenarioCO2 = baselineCO2 - (avoidedLED + avoidedSmart + avoidedST + avoidedHP + avoidedPV);
  const scenarioCost = electricityResidual * state.electricityPrice + heatResidual * state.heatPrice - pvExport * state.feedInTariff;
  const baselineCost = baselineElectricity * state.electricityPrice + baselineHeat * state.heatPrice;
  const savings = baselineCost - scenarioCost;

  const pvCapex = pvArea * state.pvCapexPerM2;
  const stCapex = stArea * state.stCapexPerM2;
  const hpCapex = state.hpEnabled ? state.hpCapex : 0;
  const capex = pvCapex + stCapex + state.ledCapex + state.smartCapex + hpCapex;

  const omRate = state.omPct / 100;
  const om = (pvCapex + stCapex) * omRate + stCapex * omRate + hpCapex * (omRate * 1.5);

  const annualCashflow = savings - om;
  const annualAvoided = baselineCO2 - scenarioCO2;

  return {
    yearIndex, gridEF, heatEF,
    baselineElectricity, baselineHeat, baselineCO2, baselineCost,
    reducedElectricity, reducedHeat,
    pvGeneration, pvSelf, pvExport,
    heatThermalUseful, heatAfterThermal, hpElectricity,
    electricityResidual, heatResidual,
    avoidedLED, avoidedSmart, avoidedST, avoidedHP, avoidedPV,
    scenarioCO2, scenarioCost, savings,
    capex, om, annualCashflow, annualAvoided,
    pvCapex, stCapex, hpCapex,
  };
}

function lifecycleSeries(state) {
  const horizon = Math.max(1, Math.round(state.horizonYears));
  const discount = state.discountRate / 100;
  const years = [];
  const annualAvoided = [];
  const annualCashflow = [];
  const cumulativeNpv = [];
  let npv = -annualScenario(state, 0).capex;

  for (let year = 0; year < horizon; year += 1) {
    const s = annualScenario(state, year);
    years.push(year + 1);
    annualAvoided.push(s.annualAvoided / 1000);
    annualCashflow.push(s.annualCashflow);
    const discounted = s.annualCashflow / Math.pow(1 + discount, year + 1);
    npv += discounted;
    cumulativeNpv.push(npv);
  }

  return { years, annualAvoided, annualCashflow, cumulativeNpv };
}

function annuityFactor(rate, years) {
  if (!Number.isFinite(rate) || !Number.isFinite(years) || years <= 0) return 0;
  if (Math.abs(rate) < 1e-12) return 1 / years;
  return (rate * Math.pow(1 + rate, years)) / (Math.pow(1 + rate, years) - 1);
}

function renderSvg(el, svg) { el.innerHTML = svg; }

function axisTicks(max, count = 5) {
  if (max <= 0) return [0];
  const step = max / count;
  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

function renderStackedBarChart(el, state, scenario) {
  const width = 860;
  const height = 340;
  const pad = { top: 24, right: 30, bottom: 54, left: 68 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const baseElectricity = scenario.baselineElectricity * scenario.gridEF / 1000;
  const baseHeat = scenario.baselineHeat * scenario.heatEF / 1000;
  const scenarioElectricity = (scenario.electricityResidual * scenario.gridEF) / 1000;
  const scenarioHeat = (scenario.heatResidual * scenario.heatEF) / 1000;
  const maxY = Math.max(baseElectricity + baseHeat, scenarioElectricity + scenarioHeat) * 1.18 || 1;
  const barW = 120;
  const x1 = pad.left + innerW * 0.32 - barW / 2;
  const x2 = pad.left + innerW * 0.72 - barW / 2;
  const scaleY = (value) => innerH - (value / maxY) * innerH;

  const yTicks = axisTicks(maxY, 5);
  const tickMarks = yTicks.map((tick) => {
    const y = pad.top + scaleY(tick);
    return `
      <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(105, 114, 122, 0.18)" />
      <text x="${pad.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#67727a">${fmt(tick, 1)}</text>
    `;
  }).join('');

  const baseElH = innerH - (baseElectricity / maxY) * innerH;
  const baseHeatH = innerH - ((baseElectricity + baseHeat) / maxY) * innerH;
  const scenElH = innerH - (scenarioElectricity / maxY) * innerH;
  const scenHeatH = innerH - ((scenarioElectricity + scenarioHeat) / maxY) * innerH;

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Annual snapshot chart">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(255,255,255,0.01)"></rect>
      ${tickMarks}
      <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />

      <text x="${x1 + barW / 2}" y="${height - 18}" text-anchor="middle" font-size="12" fill="#516069">Baseline</text>
      <text x="${x2 + barW / 2}" y="${height - 18}" text-anchor="middle" font-size="12" fill="#516069">Scenario</text>

      <rect x="${x1}" y="${pad.top + baseElH}" width="${barW}" height="${(baseHeat / maxY) * innerH}" rx="14" fill="#8da85f"></rect>
      <rect x="${x1}" y="${pad.top}" width="${barW}" height="${(baseElectricity / maxY) * innerH}" rx="14" fill="#cddab0"></rect>
      <rect x="${x2}" y="${pad.top + scenHeatH}" width="${barW}" height="${(scenarioHeat / maxY) * innerH}" rx="14" fill="#6a8b6f"></rect>
      <rect x="${x2}" y="${pad.top + scenElH}" width="${barW}" height="${(scenarioElectricity / maxY) * innerH}" rx="14" fill="#dfe8cb"></rect>

      <text x="${x1 + barW / 2}" y="${pad.top + baseElH - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#27413a">${fmt(baseElectricity + baseHeat, 1)}</text>
      <text x="${x2 + barW / 2}" y="${pad.top + scenElH - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#27413a">${fmt(scenarioElectricity + scenarioHeat, 1)}</text>

      <rect x="${width - 212}" y="${pad.top + 6}" width="14" height="14" rx="4" fill="#cddab0"></rect>
      <text x="${width - 192}" y="${pad.top + 17}" font-size="12" fill="#516069">Electricity</text>
      <rect x="${width - 118}" y="${pad.top + 6}" width="14" height="14" rx="4" fill="#8da85f"></rect>
      <text x="${width - 98}" y="${pad.top + 17}" font-size="12" fill="#516069">Heat</text>
    </svg>
  `;
  renderSvg(el, svg);
}

function linePath(values, width, height, pad) {
  const n = values.length;
  if (!n) return '';
  const max = Math.max(...values, 0.0001);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1e-9);
  return values.map((value, index) => {
    const x = pad.left + (index / Math.max(n - 1, 1)) * (width - pad.left - pad.right);
    const y = pad.top + (1 - ((value - min) / span)) * (height - pad.top - pad.bottom);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function renderLineChart(el, series, labels, options = {}) {
  const width = 860;
  const height = 340;
  const pad = { top: 22, right: 24, bottom: 48, left: 60 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxValue = Math.max(...series.flatMap((s) => s.values), 0.0001);
  const minValue = Math.min(0, ...series.flatMap((s) => s.values));
  const span = Math.max(maxValue - minValue, 1e-9);
  const yTicks = axisTicks(maxValue, 5);

  const axes = yTicks.map((tick) => {
    const y = pad.top + (1 - ((tick - minValue) / span)) * innerH;
    return `
      <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(105, 114, 122, 0.18)" />
      <text x="${pad.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#67727a">${fmt(tick, options.tickDecimals ?? 1)}</text>
    `;
  }).join('');

  const xTicks = labels.map((label, index) => {
    if (labels.length > 10 && index % Math.ceil(labels.length / 6) !== 0 && index !== labels.length - 1) return '';
    const x = pad.left + (index / Math.max(labels.length - 1, 1)) * innerW;
    return `
      <text x="${x}" y="${height - 18}" text-anchor="middle" font-size="11" fill="#67727a">${label}</text>
    `;
  }).join('');

  const palette = ['#3d5b43', '#b36b2b', '#5a7680', '#7b5f8f'];
  const paths = series.map((s, index) => {
    const d = linePath(s.values, width, height, pad);
    return `
      <path d="${d}" fill="none" stroke="${s.color ?? palette[index % palette.length]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    `;
  }).join('');

  const dots = series.flatMap((s, seriesIndex) => s.values.map((value, valueIndex) => {
    const x = pad.left + (valueIndex / Math.max(s.values.length - 1, 1)) * innerW;
    const y = pad.top + (1 - ((value - minValue) / span)) * innerH;
    return `<circle cx="${x}" cy="${y}" r="2.8" fill="${s.color ?? palette[seriesIndex % palette.length]}" opacity="0.9"></circle>`;
  })).join('');

  const legend = series.map((s, index) => `
    <g transform="translate(${width - 250 + index * 82}, 10)">
      <rect x="0" y="0" width="14" height="14" rx="4" fill="${s.color ?? palette[index % palette.length]}"></rect>
      <text x="20" y="11" font-size="12" fill="#516069">${s.label}</text>
    </g>
  `).join('');

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Lifecycle chart">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(255,255,255,0.01)"></rect>
      ${axes}
      <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      ${paths}
      ${dots}
      ${legend}
      ${xTicks}
    </svg>
  `;
  renderSvg(el, svg);
}

function renderOptimizerChart(el, state) {
  const width = 860;
  const height = 340;
  const pad = { top: 24, right: 24, bottom: 44, left: 56 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const points = [];
  let bestCost = { x: 0, value: Infinity };
  let bestCo2 = { x: 0, value: -Infinity };
  for (let i = 0; i <= 24; i += 1) {
    const x = i / 24;
    const pvArea = state.roofArea * x;
    const stArea = state.roofArea * (1 - x);
    const s = annualScenario(state, 0, { pvArea, stArea });
    const annualizedCapex = s.capex * annuityFactor(state.discountRate / 100, Math.max(1, Math.round(state.horizonYears)));
    const abatement = s.annualAvoided > 0 ? ((annualizedCapex + s.om - s.savings) / (s.annualAvoided / 1000)) : Infinity;
    points.push({ x, avoided: s.annualAvoided / 1000, cost: Number.isFinite(abatement) ? abatement : null });
    if (Number.isFinite(abatement) && abatement < bestCost.value) bestCost = { x, value: abatement };
    if (s.annualAvoided > bestCo2.value) bestCo2 = { x, value: s.annualAvoided };
  }

  const maxA = Math.max(...points.map((p) => p.avoided), 0.0001);
  const maxC = Math.max(...points.map((p) => p.cost ?? 0), 0.0001);
  const minC = Math.min(...points.map((p) => p.cost ?? 0), 0);
  const costSpan = Math.max(maxC - minC, 1e-9);

  const co2Path = points.map((point, index) => {
    const x = pad.left + (index / Math.max(points.length - 1, 1)) * innerW;
    const y = pad.top + (1 - (point.avoided / maxA)) * innerH;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');

  const costPath = points.filter((p) => p.cost !== null).map((point, index) => {
    const idx = points.indexOf(point);
    const x = pad.left + (idx / Math.max(points.length - 1, 1)) * innerW;
    const y = pad.top + (1 - ((point.cost - minC) / costSpan)) * innerH;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');

  const ticks = axisTicks(maxA, 4).map((tick) => {
    const y = pad.top + (1 - (tick / maxA)) * innerH;
    return `
      <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(105, 114, 122, 0.18)" />
      <text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#67727a">${fmt(tick, 1)}</text>
    `;
  }).join('');

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Roof optimizer chart">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(255,255,255,0.01)"></rect>
      ${ticks}
      <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <path d="${co2Path}" fill="none" stroke="#3d5b43" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${costPath}" fill="none" stroke="#b36b2b" stroke-width="3" stroke-dasharray="6 6" stroke-linecap="round" stroke-linejoin="round" />
      ${points.map((point, index) => {
        const x = pad.left + (index / Math.max(points.length - 1, 1)) * innerW;
        const y = pad.top + (1 - (point.avoided / maxA)) * innerH;
        return `<circle cx="${x}" cy="${y}" r="2.6" fill="#3d5b43"></circle>`;
      }).join('')}
      ${points.filter((p) => p.cost !== null).map((point) => {
        const idx = points.indexOf(point);
        const x = pad.left + (idx / Math.max(points.length - 1, 1)) * innerW;
        const y = pad.top + (1 - ((point.cost - minC) / costSpan)) * innerH;
        return `<circle cx="${x}" cy="${y}" r="2.5" fill="#b36b2b"></circle>`;
      }).join('')}
      ${Array.from({ length: 6 }, (_, i) => {
        const x = pad.left + (i / 5) * innerW;
        const label = (i / 5).toFixed(2);
        return `<text x="${x}" y="${height - 16}" text-anchor="middle" font-size="11" fill="#67727a">${label}</text>`;
      }).join('')}
      <rect x="${width - 242}" y="${pad.top + 4}" width="14" height="14" rx="4" fill="#3d5b43"></rect>
      <text x="${width - 222}" y="${pad.top + 15}" font-size="12" fill="#516069">CO2 avoided</text>
      <rect x="${width - 126}" y="${pad.top + 4}" width="14" height="14" rx="4" fill="#b36b2b"></rect>
      <text x="${width - 106}" y="${pad.top + 15}" font-size="12" fill="#516069">Cost</text>
    </svg>
  `;
  renderSvg(el, svg);
  $('optimizerCostBadge').textContent = `x* = ${bestCost.x.toFixed(2)} / ${fmt(bestCost.value, 0)} CHF/t`;
  $('optimizerCo2Badge').textContent = `max CO2 = ${bestCo2.x.toFixed(2)} / ${fmt(bestCo2.value / 1000, 2)} t`;
}

function renderSummaryTable(state, scenario, lifecycle) {
  const rows = [
    ['Baseline CO2', `${fmt(scenario.baselineCO2 / 1000, 2)} tCO2/y`],
    ['Scenario CO2', `${fmt(scenario.scenarioCO2 / 1000, 2)} tCO2/y`],
    ['CO2 avoided', `${fmt(scenario.annualAvoided / 1000, 2)} tCO2/y`],
    ['Baseline cost', `${fmt(scenario.baselineCost, 0)} CHF/y`],
    ['Scenario cost', `${fmt(scenario.scenarioCost, 0)} CHF/y`],
    ['Annual savings', `${fmt(scenario.savings, 0)} CHF/y`],
    ['PV self-consumption', `${fmt(scenario.pvSelf, 0)} kWh/y`],
    ['PV export', `${fmt(scenario.pvExport, 0)} kWh/y`],
    ['Solar thermal useful heat', `${fmt(scenario.heatThermalUseful, 0)} kWh/y`],
    ['Annual cashflow', `${fmt(scenario.annualCashflow, 0)} CHF/y`],
    ['Lifecycle NPV', `${fmt(lifecycle.cumulativeNpv[lifecycle.cumulativeNpv.length - 1], 0)} CHF`],
    ['Total CAPEX', `${fmt(scenario.capex, 0)} CHF`],
  ];
  const tbody = $('summaryTable').querySelector('tbody');
  tbody.innerHTML = rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('');
}

function renderKpis(state, scenario, lifecycle) {
  const annualized = scenario.capex * annuityFactor(state.discountRate / 100, Math.max(1, Math.round(state.horizonYears)));
  const abatement = scenario.annualAvoided > 0 ? ((annualized + scenario.om - scenario.savings) / (scenario.annualAvoided / 1000)) : NaN;
  const lcoe = state.pvArea > 0 ? ((state.pvCapexPerM2 * state.pvArea) * annuityFactor(state.discountRate / 100, Math.max(1, Math.round(state.horizonYears))) + (state.pvCapexPerM2 * state.pvArea) * (state.omPct / 100)) / Math.max(scenario.pvGeneration, 1e-6) : NaN;
  const selfSuff = scenario.baselineElectricity > 0 ? (scenario.pvSelf / scenario.baselineElectricity) * 100 : 0;
  const embodied = state.pvArea * EMBODIED.pvPerM2 + state.stArea * EMBODIED.stPerM2 + (state.hpEnabled ? EMBODIED.hpUnit : 0);
  const carbonPb = scenario.annualAvoided > 0 ? embodied / scenario.annualAvoided : NaN;
  const payback = scenario.annualCashflow > 0 ? scenario.capex / scenario.annualCashflow : NaN;

  $('kpiCo2').textContent = `${fmt(scenario.annualAvoided / 1000, 2)} t`;
  $('kpiCo2Sub').textContent = scenario.baselineCO2 > 0 ? `${fmt((scenario.annualAvoided / scenario.baselineCO2) * 100, 0)}% of baseline` : 'of baseline';
  $('kpiAbatement').textContent = Number.isFinite(abatement) ? `${fmt(abatement, 0)}` : '—';
  $('kpiNpv').textContent = `${fmt(lifecycle.cumulativeNpv[lifecycle.cumulativeNpv.length - 1], 0)} CHF`;
  $('kpiPayback').textContent = Number.isFinite(payback) ? fmt(payback, 1) : '—';
  $('kpiLcoe').textContent = Number.isFinite(lcoe) ? fmt(lcoe, 2) : '—';
  $('kpiSelfSuff').textContent = `${fmt(selfSuff, 0)}%`;
  $('kpiCarbonPb').textContent = Number.isFinite(carbonPb) ? fmt(carbonPb, 1) : '—';
  $('kpiCapex').textContent = `${fmt(scenario.capex, 0)} CHF`;

  return { annualized, abatement, lcoe, selfSuff, carbonPb, payback };
}

function renderLifecycleCharts(state, lifecycle) {
  const annualSeries = [
    { label: 'Avoided CO2 (t/y)', values: lifecycle.annualAvoided, color: '#3d5b43' },
  ];
  const cashflowSeries = [
    { label: 'Cumulative NPV (CHF)', values: lifecycle.cumulativeNpv, color: '#b36b2b' },
  ];
  renderLineChart($('lifecycleChart'), annualSeries, lifecycle.years.map(String), { tickDecimals: 1 });
  renderLineChart($('cashflowChart'), cashflowSeries, lifecycle.years.map(String), { tickDecimals: 0 });
}

function updateCustomGridVisibility(state) {
  $('gridFactor').parentElement.style.display = state.customGridVisible || state.electricityMix === 'custom' ? '' : 'none';
}

function refresh() {
  const state = readState();
  syncRanges(state);
  updateCustomGridVisibility(state);

  const scenario = annualScenario(state, 0);
  const lifecycle = lifecycleSeries(state);

  renderStackedBarChart($('snapshotChart'), state, scenario);
  renderLifecycleCharts(state, lifecycle);
  renderKpis(state, scenario, lifecycle);
  renderSummaryTable(state, scenario, lifecycle);

  if (state.roofOptimizer) renderOptimizerChart($('optimizerChart'), state);

  $('coverageText').textContent = '10 / 10 implemented';
}

function resetToDefaults() {
  writeState(DEFAULTS);
  refresh();
}

function loadRathausBaseline() {
  writeState({
    ...DEFAULTS,
    electricityUse: 41150,
    heatUse: 120000,
    electricityMix: 'wwz',
    heatMethod: 'districtWood',
    pvArea: 0,
    stArea: 0,
    ledReduction: 5,
    smartReduction: 0,
    hpEnabled: false,
  });
  refresh();
}

function exportCsv() {
  const state = readState();
  const lifecycle = lifecycleSeries(state);
  const scenario = annualScenario(state, 0);
  const rows = [
    ['Metric', 'Value'],
    ['Electricity use (kWh/y)', state.electricityUse],
    ['Heat use (kWh/y)', state.heatUse],
    ['Roof area (m²)', state.roofArea],
    ['Electricity mix', ELECTRICITY_MIXES[state.electricityMix].label],
    ['Heat method', HEAT_METHODS[state.heatMethod].label],
    ['PV area (m²)', state.pvArea],
    ['ST area (m²)', state.stArea],
    ['Annual avoided CO2 (t)', (scenario.annualAvoided / 1000).toFixed(3)],
    ['Scenario cost (CHF/y)', Math.round(scenario.scenarioCost)],
    ['Annual savings (CHF/y)', Math.round(scenario.savings)],
    ['Total CAPEX (CHF)', Math.round(scenario.capex)],
    ['Lifecycle NPV (CHF)', Math.round(lifecycle.cumulativeNpv[lifecycle.cumulativeNpv.length - 1])],
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

function bindEvents() {
  ids.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', refresh);
    el.addEventListener('change', refresh);
  });
  $('resetBtn').addEventListener('click', resetToDefaults);
  $('rathausBtn').addEventListener('click', loadRathausBaseline);
  $('csvBtn').addEventListener('click', exportCsv);
  $('customGridVisible').addEventListener('change', refresh);
  $('electricityMix').addEventListener('change', refresh);
}

function init() {
  writeState(DEFAULTS);
  bindEvents();
  refresh();
}

window.addEventListener('DOMContentLoaded', init);
