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
  pvCapexPerM2: 450,
  stCapexPerM2: 900,
  hpCapex: 85000,
  hpEnabled: false,
  cop: 3.5,
  omPct: 1,
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

const EMBODIED = { pvPerM2: 420, stPerM2: 90, hpUnit: 1200 };

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 0) => Number.isFinite(n) ? n.toLocaleString('de-CH', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—';
const pct = (n, d = 0) => Number.isFinite(n) ? `${fmt(n, d)}%` : '—';

const ids = [
  'electricityUse', 'heatUse', 'roofArea', 'usefulHeatLoad',
  'electricityMix', 'heatMethod',
  'electricityPrice', 'heatPrice', 'feedInTariff',
  'discountRate', 'horizonYears', 'gridFactor',
  'pvArea', 'pvYield', 'pvSelfShare',
  'stArea', 'stYield', 'stUtilization',
  'pvDegradation', 'stDegradation', 'exportDisplacement',
  'pvCapexPerM2', 'stCapexPerM2', 'hpCapex',
  'hpEnabled', 'cop', 'omPct',
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
  $('roofWarning').classList.toggle('visible', state.pvArea + state.stArea > state.roofArea + 1e-9);
  $('mixBadge').textContent = ELECTRICITY_MIXES[state.electricityMix].label;
  $('gridFactorField').style.display = state.electricityMix === 'custom' ? '' : 'none';
}

function electricityFactor(state) {
  return state.electricityMix === 'custom' ? state.gridFactor : ELECTRICITY_MIXES[state.electricityMix].factor;
}

function heatFactor(state) {
  if (state.heatMethod === 'hp') return electricityFactor(state) / Math.max(state.cop, 1e-6);
  return HEAT_METHODS[state.heatMethod].factor;
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
  const baselineCost = baselineElectricity * state.electricityPrice + baselineHeat * state.heatPrice;

  const pvGeneration = pvArea * state.pvYield * pvFactor;
  const pvPotentialSelf = pvGeneration * state.pvSelfShare;

  const heatThermalRaw = stArea * state.stYield * stFactor * state.stUtilization;
  const heatThermalUseful = Math.min(heatThermalRaw, state.usefulHeatLoad);
  const heatAfterThermal = Math.max(baselineHeat - heatThermalUseful, 0);

  const hpElectricity = state.hpEnabled ? heatAfterThermal / Math.max(state.cop, 1e-6) : 0;
  const netElectricDemand = baselineElectricity + hpElectricity;
  const pvSelf = Math.min(pvPotentialSelf, netElectricDemand);
  const pvExport = Math.max(pvGeneration - pvSelf, 0);

  const electricityResidual = Math.max(netElectricDemand - pvSelf, 0);
  const heatResidual = state.hpEnabled ? 0 : heatAfterThermal;

  const avoidedST = state.hpEnabled
    ? heatThermalUseful * (gridEF / Math.max(state.cop, 1e-6))
    : heatThermalUseful * heatEF;
  const avoidedHP = state.hpEnabled
    ? heatAfterThermal * (heatEF - gridEF / Math.max(state.cop, 1e-6))
    : 0;
  const avoidedPV = pvSelf * gridEF + pvExport * gridEF * state.exportDisplacement;

  const scenarioCO2 = baselineCO2 - (avoidedST + avoidedHP + avoidedPV);
  const scenarioCost = electricityResidual * state.electricityPrice + heatResidual * state.heatPrice - pvExport * state.feedInTariff;
  const savings = baselineCost - scenarioCost;

  const pvCapex = pvArea * state.pvCapexPerM2;
  const stCapex = stArea * state.stCapexPerM2;
  const hpCapex = state.hpEnabled ? state.hpCapex : 0;
  const capex = pvCapex + stCapex + hpCapex;

  const omRate = state.omPct / 100;
  const om = (pvCapex + stCapex) * omRate + hpCapex * (omRate * 1.5);

  const annualCashflow = savings - om;
  const annualAvoided = baselineCO2 - scenarioCO2;

  return {
    yearIndex, gridEF, heatEF,
    baselineElectricity, baselineHeat, baselineCO2, baselineCost,
    pvGeneration, pvSelf, pvExport,
    heatThermalUseful, heatAfterThermal, hpElectricity,
    electricityResidual, heatResidual,
    avoidedST, avoidedHP, avoidedPV,
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
  const baseElectricity = scenario.baselineElectricity * scenario.gridEF / 1000;
  const baseHeat = scenario.baselineHeat * scenario.heatEF / 1000;
  const scenarioElectricity = (scenario.electricityResidual * scenario.gridEF) / 1000;
  const scenarioHeat = (scenario.heatResidual * scenario.heatEF) / 1000;
  const maxY = Math.max(baseElectricity + baseHeat, scenarioElectricity + scenarioHeat) * 1.18 || 1;
  const barW = 120;
  const x1 = pad.left + innerW * 0.32 - barW / 2;
  const x2 = pad.left + innerW * 0.72 - barW / 2;
  const scaleY = (v) => innerH - (v / maxY) * innerH;

  const yTicks = axisTicks(maxY, 5);
  const tickMarks = yTicks.map((tick) => {
    const y = pad.top + scaleY(tick);
    return `
      <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(105,114,122,0.18)" />
      <text x="${pad.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#67727a">${fmt(tick, 1)}</text>`;
  }).join('');

  const baseElH = scaleY(baseElectricity);
  const scenElH = scaleY(scenarioElectricity);
  const scenHeatH = scaleY(scenarioElectricity + scenarioHeat);

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Annual snapshot chart">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(255,255,255,0.01)"></rect>
      ${tickMarks}
      <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <text x="${x1 + barW / 2}" y="${height - 18}" text-anchor="middle" font-size="12" fill="#516069">Baseline</text>
      <text x="${x2 + barW / 2}" y="${height - 18}" text-anchor="middle" font-size="12" fill="#516069">Scenario</text>
      <rect x="${x1}" y="${pad.top + scaleY(baseElectricity + baseHeat)}" width="${barW}" height="${(baseHeat / maxY) * innerH}" rx="14" fill="#8da85f"></rect>
      <rect x="${x1}" y="${pad.top}" width="${barW}" height="${(baseElectricity / maxY) * innerH}" rx="14" fill="#cddab0"></rect>
      <rect x="${x2}" y="${pad.top + scenHeatH}" width="${barW}" height="${(scenarioHeat / maxY) * innerH}" rx="14" fill="#6a8b6f"></rect>
      <rect x="${x2}" y="${pad.top + scenElH}" width="${barW}" height="${(scenarioElectricity / maxY) * innerH}" rx="14" fill="#dfe8cb"></rect>
      <text x="${x1 + barW / 2}" y="${pad.top + scaleY(baseElectricity + baseHeat) - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#27413a">${fmt(baseElectricity + baseHeat, 1)}</text>
      <text x="${x2 + barW / 2}" y="${pad.top + scenElH - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#27413a">${fmt(scenarioElectricity + scenarioHeat, 1)}</text>
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

  // filled area under PV curve
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

  // end-point annotation: show final output vs year-1
  const pvFirst = lifecycle.pvGeneration[0];
  const pvLast = lifecycle.pvGeneration[n - 1];
  const dropPct = pvFirst > 0 ? ((pvFirst - pvLast) / pvFirst) * 100 : 0;
  const totalPvKwh = lifecycle.pvGeneration.reduce((a, b) => a + b, 0);

  // dot at last point
  const lastX = toX(n - 1);
  const lastY = toY(pvLast);
  const annotation = `
    <circle cx="${lastX}" cy="${lastY}" r="4" fill="#3d5b43" />
    <rect x="${lastX - 96}" y="${lastY - 34}" width="92" height="28" rx="8" fill="rgba(39,65,58,0.88)" />
    <text x="${lastX - 50}" y="${lastY - 20}" text-anchor="middle" font-size="11" fill="#e8f0e9">${fmt(pvLast, 0)} kWh</text>
    <text x="${lastX - 50}" y="${lastY - 8}" text-anchor="middle" font-size="10" fill="#a8c9ab">−${fmt(dropPct, 1)}% vs yr 1</text>`;

  // payback year line (first year cumNPV turns positive)
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

  if (minValue < 0) {
    // zero line
  }

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
  const height = 460;
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

  const co2Path = points.map((point, i) => {
    const x = pad.left + (i / Math.max(points.length - 1, 1)) * innerW;
    const y = pad.top + (1 - (point.avoided / maxA)) * innerH;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');

  const costPath = points.filter((p) => p.cost !== null).map((point, i) => {
    const idx = points.indexOf(point);
    const x = pad.left + (idx / Math.max(points.length - 1, 1)) * innerW;
    const y = pad.top + (1 - ((point.cost - minC) / costSpan)) * innerH;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');

  const ticks = axisTicks(maxA, 4).map((tick) => {
    const y = pad.top + (1 - (tick / maxA)) * innerH;
    return `
      <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(105,114,122,0.18)" />
      <text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#67727a">${fmt(tick, 1)}</text>`;
  }).join('');

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Roof optimizer chart">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(255,255,255,0.01)"></rect>
      ${ticks}
      <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <path d="${co2Path}" fill="none" stroke="#3d5b43" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${costPath}" fill="none" stroke="#b36b2b" stroke-width="3" stroke-dasharray="6 6" stroke-linecap="round" stroke-linejoin="round" />
      ${points.map((point, i) => {
        const x = pad.left + (i / Math.max(points.length - 1, 1)) * innerW;
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
        return `<text x="${x}" y="${height - 14}" text-anchor="middle" font-size="11" fill="#67727a">${(i / 5).toFixed(2)}</text>`;
      }).join('')}
      <rect x="${width - 242}" y="${pad.top + 4}" width="14" height="14" rx="4" fill="#3d5b43"></rect>
      <text x="${width - 222}" y="${pad.top + 15}" font-size="12" fill="#516069">CO₂ avoided</text>
      <rect x="${width - 126}" y="${pad.top + 4}" width="14" height="14" rx="4" fill="#b36b2b"></rect>
      <text x="${width - 106}" y="${pad.top + 15}" font-size="12" fill="#516069">Abatement cost</text>
    </svg>`;
  renderSvg(el, svg);
  $('optimizerCostBadge').textContent = `x* = ${bestCost.x.toFixed(2)} / ${fmt(bestCost.value, 0)} CHF/t`;
  $('optimizerCo2Badge').textContent = `max CO₂ = ${bestCo2.x.toFixed(2)} / ${fmt(bestCo2.value / 1000, 2)} t`;
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
  const lcoe = state.pvArea > 0
    ? ((state.pvCapexPerM2 * state.pvArea) * annuityFactor(state.discountRate / 100, Math.max(1, n)) + (state.pvCapexPerM2 * state.pvArea) * (state.omPct / 100)) / Math.max(scenario.pvGeneration, 1e-6)
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
    hpEnabled: false,
  });
  refresh();
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
  $('electricityMix').addEventListener('change', refresh);
}

function init() {
  writeState(DEFAULTS);
  bindEvents();
  refresh();
}

window.addEventListener('DOMContentLoaded', init);
