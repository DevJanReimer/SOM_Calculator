const DEFAULTS = {
  electricityUse: 41150,
  heatUse: 189000,
  roofArea: 303,
  buildAreaLimit: 303,
  usefulHeatLoad: 20600,
  electricityMix: 'wwz',
  heatMethod: 'districtWood',
  newElectricityMix: 'wwz',
  newHeatMethod: 'districtWood',
  electricityPrice: 0.30,
  heatPrice: 0.068,
  feedInTariff: 0.11,
  optimizationWeight: 0.5,
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
  pvMaintenancePerM2: 4.5,
  stMaintenancePerM2: 9,
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
  efPvPlant: 0.045,
  efStPlant: 0.020,
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
  'electricityUse', 'heatUse', 'roofArea', 'buildAreaLimit', 'usefulHeatLoad',
  'electricityMix', 'heatMethod', 'newElectricityMix', 'newHeatMethod',
  'electricityPrice', 'heatPrice', 'feedInTariff',
  'optimizationWeight',
  'discountRate', 'horizonYears', 'gridFactor',
  'currentPvArea', 'currentStArea',
  'pvArea', 'pvYield', 'pvSelfShare',
  'stArea', 'stYield', 'stUtilization',
  'pvDegradation', 'stDegradation',
  'pvCapexPerM2', 'stCapexPerM2',
  'pvMaintenancePerM2', 'stMaintenancePerM2',
  'pvCapexTotal', 'stCapexTotal',
  'hpCapex', 'hpEnabled', 'cop', 'omPct',
  'co2Wwz', 'co2Swiss', 'co2Hydro',
  'co2DistrictWood', 'co2Oil', 'co2Gas', 'co2Pellets', 'co2DistrictMix',
  'efPvPlant', 'efStPlant',
];

const rangeIds = {
  currentPvArea: 'currentPvAreaValue',
  currentStArea: 'currentStAreaValue',
  pvArea: 'pvAreaValue',
  pvYield: 'pvYieldValue',
  pvSelfShare: 'pvSelfShareValue',
  optimizationWeight: 'optimizationWeightValue',
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
  $(rangeIds.currentPvArea).textContent = fmt(state.currentPvArea, 0);
  $(rangeIds.currentStArea).textContent = fmt(state.currentStArea, 0);
  $(rangeIds.pvArea).textContent = fmt(state.pvArea, 0);
  $(rangeIds.pvYield).textContent = fmt(state.pvYield, 0);
  $(rangeIds.pvSelfShare).textContent = pct(state.pvSelfShare * 100, 0);
  if ($(rangeIds.optimizationWeight)) $(rangeIds.optimizationWeight).textContent = pct(state.optimizationWeight * 100, 0);
  $(rangeIds.stArea).textContent = fmt(state.stArea, 0);
  $(rangeIds.stYield).textContent = fmt(state.stYield, 0);
  $(rangeIds.stUtilization).textContent = pct(state.stUtilization * 100, 0);
  $(rangeIds.pvDegradation).textContent = `${fmt(state.pvDegradation, 1)}%`;
  $(rangeIds.stDegradation).textContent = `${fmt(state.stDegradation, 1)}%`;

  // Update slider maxes to the separately selected buildable area limit.
  ['pvArea', 'stArea', 'currentPvArea', 'currentStArea', 'rPvArea', 'rStArea'].forEach((id) => {
    const el = $(id);
    if (el) {
      const stHeatCap = state.stYield > 0 ? state.heatUse / state.stYield : 0;
      const areaLimit = Math.min(state.roofArea, state.buildAreaLimit);
      el.max = (id === 'stArea' || id === 'rStArea') ? Math.min(areaLimit, stHeatCap) : areaLimit;
    }
  });

  const areaLimit = Math.min(state.roofArea, state.buildAreaLimit);
  const newExceedsRoof = state.pvArea + state.stArea > areaLimit + 1e-9;
  const curExceedsRoof = state.currentPvArea + state.currentStArea > areaLimit + 1e-9;
  $('roofWarning').classList.toggle('visible', newExceedsRoof || curExceedsRoof);

  // Update roof usage visual bars
  if (state.roofArea > 0) {
    const pvPct = Math.min((state.pvArea / areaLimit) * 100, 100);
    const stPct = Math.min((state.stArea / areaLimit) * 100, 100 - pvPct);
    const pvFill = $('pvRoofFill');
    const stPvFill = $('stPvFill');
    const stStFill = $('stStFill');
    if (pvFill) pvFill.style.width = `${pvPct}%`;
    if (stPvFill) stPvFill.style.width = `${pvPct}%`;
    if (stStFill) stStFill.style.width = `${stPct}%`;
    const totalPct = Math.round(pvPct + stPct);
    const usageLabel = $('roofUsageLabel');
    if (usageLabel) {
      usageLabel.textContent = totalPct > 0 ? `${totalPct}% of selected area used (${fmt(state.pvArea + state.stArea, 0)} / ${fmt(areaLimit, 0)} m²)` : '';
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

function yieldFactor(degradationPct, yearIndex) {
  return Math.max(0, 1 - yearIndex * (Math.max(0, degradationPct) / 100));
}

function multiPeriodScenario(state, pvAreaInput, stAreaInput) {
  const gridEF = electricityFactor(state);
  const heatEF = heatFactor(state);
  const newGridEF = newElectricityFactor(state);
  const newHeatEF = newHeatFactor(state);
  const areaLimit = Math.max(0, Math.min(state.roofArea, state.buildAreaLimit));
  const qPv = Math.max(0, state.pvYield);
  const qSt = Math.max(0, state.stYield);
  const horizon = Math.max(1, Math.round(state.horizonYears));
  const discount = Math.max(0, state.discountRate) / 100;
  const x = Math.max(0, Math.min(pvAreaInput, areaLimit));
  const yHeatLimit = qSt > 0 ? state.heatUse / qSt : 0;
  const y = Math.max(0, Math.min(stAreaInput, areaLimit - x, yHeatLimit));
  const selfConsumptionShare = Math.max(0, Math.min(state.pvSelfShare, 1));
  const baselineElectricity = Math.max(state.electricityUse, 0);
  const baselineHeat = Math.max(state.heatUse, 0);
  const baselineCost = baselineElectricity * state.electricityPrice + baselineHeat * state.heatPrice;
  const baselineCO2 = baselineElectricity * gridEF + baselineHeat * heatEF;
  const pvCapex = x * Math.max(0, state.pvCapexPerM2);
  const stCapex = y * Math.max(0, state.stCapexPerM2);
  const pvMaintenance = x * Math.max(0, state.pvMaintenancePerM2);
  const stMaintenance = y * Math.max(0, state.stMaintenancePerM2);
  const pvPlantCO2 = x * qPv * state.efPvPlant;
  const stPlantCO2 = y * qSt * state.efStPlant;
  const years = [];
  let totalCost = 0;
  let totalEmissions = 0;
  let baselineCostTotal = 0;
  let baselineCO2Total = 0;
  let cumulativeDiscountedSavings = 0;

  for (let yearIndex = 0; yearIndex < horizon; yearIndex += 1) {
    const pvFactor = yieldFactor(state.pvDegradation, yearIndex);
    const stFactor = yieldFactor(state.stDegradation, yearIndex);
    const pvGeneration = x * pvFactor * qPv;
    const pvSelfConsumption = pvGeneration * selfConsumptionShare;
    const pvExport = pvGeneration * (1 - selfConsumptionShare);
    const stGeneration = y * stFactor * qSt;
    const electricityResidual = Math.max(0, baselineElectricity - pvSelfConsumption);
    const heatResidual = Math.max(0, baselineHeat - stGeneration);
    const investment = yearIndex === 0 ? pvCapex + stCapex : 0;
    const maintenance = pvMaintenance + stMaintenance;
    const operatingCost = maintenance
      + electricityResidual * state.electricityPrice
      + heatResidual * state.heatPrice
      - pvExport * state.feedInTariff;
    const yearCost = investment
      + operatingCost;
    const operatingSavings = baselineCost - operatingCost;
    const yearPlantCO2 = yearIndex === 0 ? pvPlantCO2 + stPlantCO2 : 0;
    const yearPvPlantCO2 = yearIndex === 0 ? pvPlantCO2 : 0;
    const yearStPlantCO2 = yearIndex === 0 ? stPlantCO2 : 0;
    const yearCO2 = yearPlantCO2
      + electricityResidual * newGridEF
      + heatResidual * newHeatEF;
    const discountFactor = 1 / Math.pow(1 + discount, yearIndex);
    totalCost += yearCost * discountFactor;
    totalEmissions += yearCO2;
    baselineCostTotal += baselineCost * discountFactor;
    baselineCO2Total += baselineCO2;
    cumulativeDiscountedSavings += (baselineCost - yearCost) * discountFactor;
    years.push({
      yearIndex,
      pvFactor,
      stFactor,
      pvGeneration,
      stGeneration,
      pvSelfConsumption,
      electricityResidual,
      heatResidual,
      pvExport,
      yearCost,
      operatingCost,
      operatingSavings,
      investment,
      maintenance,
      yearCO2,
      pvPlantCO2: yearPvPlantCO2,
      stPlantCO2: yearStPlantCO2,
      plantCO2: yearPlantCO2,
      cumulativeDiscountedSavings,
    });
  }

  const costRatio = baselineCostTotal > 0 ? totalCost / baselineCostTotal : 0;
  const emissionRatio = baselineCO2Total > 0 ? totalEmissions / baselineCO2Total : 0;
  const objective = state.optimizationWeight * costRatio + (1 - state.optimizationWeight) * emissionRatio;

  return {
    x, y, gridEF, heatEF, newGridEF, newHeatEF,
    baselineElectricity, baselineHeat, baselineCost, baselineCO2,
    baselineCostTotal, baselineCO2Total,
    pvCapex, stCapex, capex: pvCapex + stCapex,
    pvMaintenance, stMaintenance,
    pvPlantCO2, stPlantCO2, plantCO2: pvPlantCO2 + stPlantCO2,
    totalCost, totalEmissions, costRatio, emissionRatio, objective, years,
  };
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

  if (state.optimizationWeight !== undefined) {
    const totals = multiPeriodScenario(state, pvArea, stArea);
    const year = totals.years[Math.min(yearIndex, totals.years.length - 1)] ?? totals.years[0];
    const scenarioCO2 = year.yearCO2;
    const scenarioCost = year.yearCost;
    const savings = totals.baselineCost - scenarioCost;
    const annualAvoided = totals.baselineCO2 - scenarioCO2;

    return {
      yearIndex, gridEF: totals.gridEF, heatEF: totals.heatEF, newGridEF: totals.newGridEF, newHeatEF: totals.newHeatEF,
      baselineElectricity: totals.baselineElectricity, baselineHeat: totals.baselineHeat,
      baselineCO2: totals.baselineCO2, baselineCost: totals.baselineCost,
      baselineCO2Total: totals.baselineCO2Total, baselineCostTotal: totals.baselineCostTotal,
      pvGeneration: year.pvGeneration, pvSelf: year.pvSelfConsumption, pvExport: year.pvExport,
      heatThermalUseful: Math.min(year.stGeneration, totals.baselineHeat), heatAfterThermal: year.heatResidual, hpElectricity: 0,
      electricityResidual: year.electricityResidual, heatResidual: year.heatResidual,
      scenarioCO2, scenarioCost, savings,
      totalCost: totals.totalCost, totalEmissions: totals.totalEmissions,
      capex: totals.capex, om: totals.pvMaintenance + totals.stMaintenance, annualCashflow: savings, annualAvoided,
      pvCapex: totals.pvCapex, stCapex: totals.stCapex, hpCapex: 0,
      effectivePvArea: totals.x, effectiveStArea: totals.y,
      pvPlantCO2: year.pvPlantCO2, stPlantCO2: year.stPlantCO2, plantCO2: year.plantCO2,
      annualizedCapex: 0, costRatio: totals.costRatio, emissionRatio: totals.emissionRatio, objective: totals.objective,
      multiPeriod: totals,
    };
  }

  const curPvGen = state.currentPvArea * state.pvYield * pvFactor;
  const curPvSelf = Math.min(curPvGen * state.pvSelfShare, state.electricityUse);
  const curStHeat = Math.min(state.currentStArea * state.stYield * stFactor * state.stUtilization, state.usefulHeatLoad);

  const baselineElectricity = Math.max(state.electricityUse - curPvSelf, 0);
  const baselineHeat = Math.max(state.heatUse - curStHeat, 0);
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

function lifecycleSeries(state, overrides = {}) {
  const horizon = Math.max(1, Math.round(state.horizonYears));
  const discount = state.discountRate / 100;
  const years = [];
  const pvGeneration = [];
  const stGeneration = [];
  const annualAvoided = [];
  const cumulativeNpv = [];
  const initial = annualScenario(state, 0, overrides);
  let npv = -initial.capex;

  for (let year = 0; year < horizon; year += 1) {
    const s = annualScenario(state, year, overrides);
    years.push(year + 1);
    pvGeneration.push(s.pvGeneration);
    stGeneration.push(s.heatThermalUseful);
    annualAvoided.push(s.annualAvoided / 1000);
    const operatingSavings = s.multiPeriod?.years?.[year]?.operatingSavings ?? s.savings;
    const discounted = operatingSavings / Math.pow(1 + discount, year + 1);
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
  const optimized = findOptimalScenario(state).scenario;
  const selectedYear = Math.max(1, Math.min(Math.round(Number($('resultYear')?.value) || 1), Math.max(1, Math.round(state.horizonYears))));
  const manualYears = scenario.multiPeriod?.years ?? [];
  const optimizedYears = optimized.multiPeriod?.years ?? [];
  const manualYear = manualYears[selectedYear - 1] ?? manualYears[0];
  const optimizedYear = optimizedYears[selectedYear - 1] ?? optimizedYears[0];
  const horizon = Math.max(1, Math.round(state.horizonYears));

  const baseElec = scenario.baselineElectricity * scenario.gridEF / 1000;
  const baseHeat = scenario.baselineHeat * scenario.heatEF / 1000;
  const scenElec = (manualYear?.electricityResidual ?? 0) * scenario.newGridEF / 1000;
  const scenPv = (manualYear?.pvPlantCO2 ?? 0) / 1000;
  const scenHeat = (manualYear?.heatResidual ?? 0) * scenario.newHeatEF / 1000;
  const scenSt = (manualYear?.stPlantCO2 ?? 0) / 1000;
  const optElec = (optimizedYear?.electricityResidual ?? 0) * optimized.newGridEF / 1000;
  const optPv = (optimizedYear?.pvPlantCO2 ?? 0) / 1000;
  const optHeat = (optimizedYear?.heatResidual ?? 0) * optimized.newHeatEF / 1000;
  const optSt = (optimizedYear?.stPlantCO2 ?? 0) / 1000;
  const baseTotal = baseElec + baseHeat;
  const scenHeatTotal = scenHeat + scenSt;
  const scenElecTotal = scenHeatTotal + scenElec;
  const scenTotal = scenElecTotal + scenPv;
  const optHeatTotal = optHeat + optSt;
  const optElecTotal = optHeatTotal + optElec;
  const optTotal = optElecTotal + optPv;
  const maxY = Math.max(baseTotal, scenTotal, optTotal) * 1.18 || 1;

  const barW = 96;
  const x1 = pad.left + innerW * 0.22 - barW / 2;
  const x2 = pad.left + innerW * 0.52 - barW / 2;
  const x3 = pad.left + innerW * 0.82 - barW / 2;

  const toY = (v) => pad.top + (1 - v / maxY) * innerH;
  const segH = (v) => (v / maxY) * innerH;
  const visibleSegH = (v) => v > 0 ? Math.max(segH(v), 3) : 0;

  const yTicks = axisTicks(maxY, 5);
  const colors = {
    electricity: '#dfe8cb',
    pv: '#f0d28b',
    heating: '#6a8b6f',
    solarThermal: '#9fbf8a',
  };
  const tickMarks = yTicks.map((tick) => {
    const y = toY(tick);
    return `
      <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(105,114,122,0.18)" />
      <text x="${pad.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#67727a">${fmt(tick, 1)}</text>`;
  }).join('');

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Annual emissions chart">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(255,255,255,0.01)"></rect>
      ${tickMarks}
      <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <text x="${x1 + barW / 2}" y="${height - 18}" text-anchor="middle" font-size="12" fill="#516069">Baseline</text>
      <text x="${x2 + barW / 2}" y="${height - 18}" text-anchor="middle" font-size="12" fill="#516069">Manual</text>
      <text x="${x3 + barW / 2}" y="${height - 18}" text-anchor="middle" font-size="12" fill="#516069">Z-optimized</text>

      <rect x="${x1}" y="${toY(baseHeat)}" width="${barW}" height="${segH(baseHeat)}" rx="10" fill="${colors.heating}"></rect>
      <rect x="${x1}" y="${toY(baseTotal)}" width="${barW}" height="${segH(baseElec)}" rx="10" fill="${colors.electricity}"></rect>
      <text x="${x1 + barW / 2}" y="${toY(baseTotal) - 8}" text-anchor="middle" font-size="13" font-weight="700" fill="#27413a">${fmt(baseTotal, 2)} t</text>

      <rect x="${x2}" y="${toY(scenHeat)}" width="${barW}" height="${segH(scenHeat)}" rx="10" fill="${colors.heating}"></rect>
      <rect x="${x2}" y="${toY(scenHeatTotal)}" width="${barW}" height="${visibleSegH(scenSt)}" rx="10" fill="${colors.solarThermal}"></rect>
      <rect x="${x2}" y="${toY(scenElecTotal)}" width="${barW}" height="${visibleSegH(scenElec)}" rx="10" fill="${colors.electricity}"></rect>
      <rect x="${x2}" y="${toY(scenTotal)}" width="${barW}" height="${visibleSegH(scenPv)}" rx="10" fill="${colors.pv}"></rect>
      <text x="${x2 + barW / 2}" y="${toY(scenTotal) - 8}" text-anchor="middle" font-size="13" font-weight="700" fill="#27413a">${fmt(scenTotal, 2)} t</text>

      <rect x="${x3}" y="${toY(optHeat)}" width="${barW}" height="${segH(optHeat)}" rx="10" fill="${colors.heating}"></rect>
      <rect x="${x3}" y="${toY(optHeatTotal)}" width="${barW}" height="${visibleSegH(optSt)}" rx="10" fill="${colors.solarThermal}"></rect>
      <rect x="${x3}" y="${toY(optElecTotal)}" width="${barW}" height="${visibleSegH(optElec)}" rx="10" fill="${colors.electricity}"></rect>
      <rect x="${x3}" y="${toY(optTotal)}" width="${barW}" height="${visibleSegH(optPv)}" rx="10" fill="${colors.pv}"></rect>
      <text x="${x3 + barW / 2}" y="${toY(optTotal) - 8}" text-anchor="middle" font-size="13" font-weight="700" fill="#27413a">${fmt(optTotal, 2)} t</text>

      <text x="${pad.left - 10}" y="${pad.top - 8}" text-anchor="end" font-size="11" fill="#67727a">tCO₂/y</text>
      <rect x="${width - 324}" y="${pad.top + 6}" width="14" height="14" rx="4" fill="${colors.electricity}"></rect>
      <text x="${width - 304}" y="${pad.top + 17}" font-size="12" fill="#516069">Electricity</text>
      <rect x="${width - 220}" y="${pad.top + 6}" width="14" height="14" rx="4" fill="${colors.pv}"></rect>
      <text x="${width - 200}" y="${pad.top + 17}" font-size="12" fill="#516069">PV</text>
      <rect x="${width - 156}" y="${pad.top + 6}" width="14" height="14" rx="4" fill="${colors.heating}"></rect>
      <text x="${width - 136}" y="${pad.top + 17}" font-size="12" fill="#516069">Heating</text>
      <rect x="${width - 324}" y="${pad.top + 28}" width="14" height="14" rx="4" fill="${colors.solarThermal}"></rect>
      <text x="${width - 304}" y="${pad.top + 39}" font-size="12" fill="#516069">Solar thermal</text>
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

function findOptimalScenario(state) {
  const roof = Math.max(0, Math.floor(Math.min(state.roofArea, state.buildAreaLimit)));
  const qSt = Math.max(0, state.stYield);
  const maxStByHeat = qSt > 0 ? Math.floor(state.heatUse / qSt) : 0;
  let best = null;

  for (let x = 0; x <= roof; x += 1) {
    const maxY = Math.max(0, Math.min(roof - x, maxStByHeat));
    for (let y = 0; y <= maxY; y += 1) {
      const scenario = annualScenario(state, 0, { pvArea: x, stArea: y });
      if (!best || scenario.objective < best.scenario.objective) {
        best = { x, y, scenario };
      }
    }
  }

  return best ?? { x: 0, y: 0, scenario: annualScenario(state, 0, { pvArea: 0, stArea: 0 }) };
}

function renderOptimizerChart(el, state) {
  const width = 860;
  const height = 460;
  const pad = { top: 24, right: 24, bottom: 44, left: 56 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const points = [];
  const best = findOptimalScenario(state);
  let bestObjective = { x: 0, y: 0, value: Infinity };
  let bestCo2 = { x: 0, y: 0, value: -Infinity };

  for (let i = 0; i <= 24; i += 1) {
    const x = i / 24;
    const areaLimit = Math.min(state.roofArea, state.buildAreaLimit);
    const pvArea = areaLimit * x;
    const maxStByHeat = state.stYield > 0 ? state.heatUse / state.stYield : 0;
    const stArea = Math.min(areaLimit * (1 - x), maxStByHeat);
    const s = annualScenario(state, 0, { pvArea, stArea });
    points.push({ x, avoided: s.annualAvoided / 1000, cost: s.objective });
    if (s.objective < bestObjective.value) bestObjective = { x: pvArea, y: stArea, value: s.objective };
    if (s.annualAvoided > bestCo2.value) bestCo2 = { x: pvArea, y: stArea, value: s.annualAvoided };
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
      <text x="${width - 106}" y="${pad.top + 15}" font-size="12" fill="#516069">Objective Z</text>
    </svg>`;
  renderSvg(el, svg);
  $('optimizerCostBadge').textContent = `min Z: x=${fmt(best.x, 0)} m², y=${fmt(best.y, 0)} m², Z=${fmt(best.scenario.objective, 3)}`;
  $('optimizerCo2Badge').textContent = state.optimizationWeight === 0
    ? 'w = 0: pure CO2 optimization'
    : 'Set w = 0 for pure CO2 optimization';
  const base = annualScenario(state, 0, { pvArea: 0, stArea: 0 });
  const onePv = annualScenario(state, 0, { pvArea: 1, stArea: 0 });
  const oneSt = annualScenario(state, 0, { pvArea: 0, stArea: 1 });
  const pvGain = base.objective - onePv.objective;
  const stGain = base.objective - oneSt.objective;
  const reason = $('optimizerReason');
  if (reason) {
    const winner = pvGain >= stGain ? 'PV' : 'solar thermal';
    reason.textContent = `Marginal Z improvement per first m²: PV ${fmt(pvGain, 4)}, solar thermal ${fmt(stGain, 4)}. Current inputs therefore initially favor ${winner}.`;
  }
}

function renderSummaryTable(state, scenario, lifecycle) {
  const n = lifecycle.years.length;
  const optimum = findOptimalScenario(state);
  const optimized = optimum.scenario;
  const pvFirst = lifecycle.pvGeneration[0];
  const pvLast = lifecycle.pvGeneration[n - 1];
  const totalPv = lifecycle.pvGeneration.reduce((a, b) => a + b, 0);
  const rows = [
    ['Manual PV area x', `${fmt(state.pvArea, 0)} m²`],
    ['Manual solar-thermal area y', `${fmt(state.stArea, 0)} m²`],
    ['Manual effective x used', `${fmt(scenario.effectivePvArea ?? state.pvArea, 0)} m²`],
    ['Manual effective y used', `${fmt(scenario.effectiveStArea ?? state.stArea, 0)} m²`],
    ['Z-optimized PV area x*', `${fmt(optimum.x, 0)} m²`],
    ['Z-optimized solar-thermal area y*', `${fmt(optimum.y, 0)} m²`],
    ['Baseline CO₂ total', `${fmt(scenario.baselineCO2Total / 1000, 2)} tCO₂`],
    ['Manual emissions total', `${fmt(scenario.totalEmissions / 1000, 2)} tCO₂`],
    ['Z-optimized emissions total', `${fmt(optimized.totalEmissions / 1000, 2)} tCO₂`],
    ['Baseline cost present value', `${fmt(scenario.baselineCostTotal, 0)} CHF`],
    ['Manual future cost present value', `${fmt(scenario.totalCost, 0)} CHF`],
    ['Z-optimized future cost present value', `${fmt(optimized.totalCost, 0)} CHF`],
    ['Manual discounted savings', `${fmt(scenario.baselineCostTotal - scenario.totalCost, 0)} CHF`],
    ['Z-optimized discounted savings', `${fmt(optimized.baselineCostTotal - optimized.totalCost, 0)} CHF`],
    ['Manual objective Z', fmt(scenario.objective, 3)],
    ['Z-optimized objective Z', fmt(optimized.objective, 3)],
    ['Cost ratio K_total / K_baseline_total', fmt(scenario.costRatio, 3)],
    ['Emission ratio E_total / E_baseline_total', fmt(scenario.emissionRatio, 3)],
    ['PV output yr 1', `${fmt(pvFirst, 0)} kWh`],
    [`PV output yr ${n}`, `${fmt(pvLast, 0)} kWh`],
    [`Total PV over ${n} years`, `${fmt(totalPv / 1000, 0)} MWh`],
    ['PV self-consumption sc share', `${fmt(scenario.pvSelf, 0)} kWh/y`],
    ['PV export (1 - sc) share', `${fmt(scenario.pvExport, 0)} kWh/y`],
    ['Solar thermal useful heat', `${fmt(scenario.heatThermalUseful, 0)} kWh/y`],
    ['Lifecycle NPV', `${fmt(lifecycle.cumulativeNpv[n - 1], 0)} CHF`],
    ['Total CAPEX', `${fmt(scenario.capex, 0)} CHF`],
  ];
  const tbody = $('summaryTable').querySelector('tbody');
  tbody.innerHTML = rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('');
}

function renderEmissionsComparison(state, scenario) {
  const el = $('emissionsComparison');
  if (!el) return;
  const optimum = findOptimalScenario(state);
  const optimized = optimum.scenario;
  const years = Math.max(1, Math.round(state.horizonYears));
  const baseline = scenario.baselineCO2Total;
  const manual = scenario.totalEmissions;
  const optimizedTotal = optimized.totalEmissions;
  const manualAvgSavings = (baseline - manual) / years;
  const optimizedAvgSavings = (baseline - optimizedTotal) / years;
  const rows = [
    ['Baseline 25y CO2', `${fmt(baseline / 1000, 2)} t`, 'reference over project horizon'],
    ['Manual 25y CO2', `${fmt(manual / 1000, 2)} t`, `${fmt(manualAvgSavings / 1000, 2)} tCO2/y avg. saved vs baseline`],
    ['Z-optimized 25y CO2', `${fmt(optimizedTotal / 1000, 2)} t`, `${fmt(optimizedAvgSavings / 1000, 2)} tCO2/y avg. saved vs baseline`],
  ];
  el.innerHTML = rows.map(([label, value, sub]) => `
    <div class="summary-strip-item">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      <div class="sub">${sub}</div>
    </div>
  `).join('');
}

function renderKpis(state, scenario, lifecycle) {
  const n = lifecycle.years.length;
  const best = findOptimalScenario(state);
  const lcoe = (state.pvArea > 0 && state.pvCapexTotal > 0)
    ? ((state.pvCapexPerM2 * state.pvArea) / Math.max(1, n)) / Math.max(scenario.pvGeneration, 1e-6)
    : NaN;
  const selfSuff = scenario.baselineElectricity > 0 ? (scenario.pvSelf / scenario.baselineElectricity) * 100 : 0;

  $('kpiCo2').textContent = `${fmt((scenario.baselineCO2Total - scenario.totalEmissions) / 1000, 2)} t`;
  $('kpiCo2Sub').textContent = scenario.baselineCO2Total > 0 ? `${fmt(((scenario.baselineCO2Total - scenario.totalEmissions) / scenario.baselineCO2Total) * 100, 0)}% over 25 years` : 'of baseline';
  $('kpiAbatement').textContent = fmt(scenario.objective, 3);
  $('kpiNpv').textContent = `${fmt(scenario.totalCost, 0)} CHF`;
  $('kpiPayback').textContent = `${fmt(best.x, 0)} / ${fmt(best.y, 0)}`;
  $('kpiLcoe').textContent = Number.isFinite(lcoe) ? fmt(lcoe, 2) : '—';
  $('kpiSelfSuff').textContent = `${fmt(selfSuff, 0)}%`;
  $('kpiCarbonPb').textContent = `${fmt(scenario.totalEmissions / 1000, 2)} t`;
  $('kpiCapex').textContent = `${fmt(scenario.capex, 0)} CHF`;
}

function refresh() {
  const state = readState();
  syncRanges(state);
  syncResultYearOptions(state);

  const scenario = annualScenario(state, 0);
  const optimum = findOptimalScenario(state);
  const lifecycle = lifecycleSeries(state);
  const optimizedLifecycle = lifecycleSeries(state, { pvArea: optimum.x, stArea: optimum.y });

  renderStackedBarChart($('snapshotChart'), state, scenario);
  renderPvLifecycleChart($('pvLifecycleChart'), state, lifecycle);
  renderLineChart($('cashflowChart'), [
    { label: 'Z-optimized NPV (CHF)', values: optimizedLifecycle.cumulativeNpv, color: '#3d5b43' },
  ], lifecycle.years.map(String), { tickDecimals: 0 });
  renderKpis(state, scenario, lifecycle);
  renderSummaryTable(state, scenario, lifecycle);
  renderEmissionsComparison(state, scenario);
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
    roofArea: 303,
    buildAreaLimit: 303,
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
    ['Available roof area (m²)', state.roofArea],
    ['Build/optimization area x+y (m²)', state.buildAreaLimit],
    ['Electricity mix', ELECTRICITY_MIXES[state.electricityMix].label],
    ['Heat method', HEAT_METHODS[state.heatMethod].label],
    ['PV area (m²)', state.pvArea],
    ['ST area (m²)', state.stArea],
    ['PV output yr 1 (kWh)', Math.round(lifecycle.pvGeneration[0])],
    [`PV output yr ${n} (kWh)`, Math.round(lifecycle.pvGeneration[n - 1])],
    [`Total PV over ${n} years (MWh)`, (lifecycle.pvGeneration.reduce((a, b) => a + b, 0) / 1000).toFixed(1)],
    ['Total avoided CO₂ (t)', ((scenario.baselineCO2Total - scenario.totalEmissions) / 1000).toFixed(3)],
    ['Future cost present value K_total (CHF)', Math.round(scenario.totalCost)],
    ['Baseline cost present value (CHF)', Math.round(scenario.baselineCostTotal)],
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

// Enforce roof area constraint: when pvArea or stArea slider moves,
// clamp the other so their sum never exceeds roofArea.
function applyRoofConstraint(movedId) {
  const roofArea = Math.min(Number($('roofArea').value), Number($('buildAreaLimit').value));
  const heatUse = Number($('heatUse').value);
  const stYield = Math.max(Number($('stYield').value), 1e-9);
  const stHeatCap = Math.max(0, heatUse / stYield);
  const pvEl = $('pvArea');
  const stEl = $('stArea');
  const rPvEl = $('rPvArea');
  const rStEl = $('rStArea');

  if (movedId === 'pvArea' || movedId === 'rPvArea') {
    const pv = Math.min(Number(pvEl.value), roofArea);
    pvEl.value = pv;
    if (rPvEl) rPvEl.value = pv;
    const maxSt = Math.max(0, Math.min(roofArea - pv, stHeatCap));
    if (Number(stEl.value) > maxSt) {
      stEl.value = maxSt;
      if (rStEl) rStEl.value = maxSt;
    }
  } else {
    const st = Math.min(Number(stEl.value), roofArea, stHeatCap);
    stEl.value = st;
    if (rStEl) rStEl.value = st;
    const maxPv = Math.max(0, roofArea - st);
    if (Number(pvEl.value) > maxPv) {
      pvEl.value = maxPv;
      if (rPvEl) rPvEl.value = maxPv;
    }
  }
}

function syncResultYearOptions(state) {
  const select = $('resultYear');
  if (!select) return;
  const horizon = Math.max(1, Math.round(state.horizonYears));
  const current = Math.max(1, Math.min(Number(select.value) || 1, horizon));
  if (select.options.length !== horizon) {
    select.innerHTML = Array.from({ length: horizon }, (_, i) => `<option value="${i + 1}">Year ${i + 1}</option>`).join('');
  }
  select.value = current;
}

function updateBuildableAreaLimit() {
  const roofArea = Math.max(0, Math.min(Number($('roofArea').value), Number($('buildAreaLimit').value)));
  const heatUse = Math.max(0, Number($('heatUse').value));
  const stYield = Math.max(Number($('stYield').value), 1e-9);
  const stHeatCap = Math.max(0, heatUse / stYield);
  const pvEl = $('pvArea');
  const stEl = $('stArea');
  const rPvEl = $('rPvArea');
  const rStEl = $('rStArea');

  stEl.value = Math.min(Number(stEl.value), stHeatCap);
  if (Number(pvEl.value) + Number(stEl.value) > roofArea) {
    const pv = Math.min(Number(pvEl.value), roofArea);
    pvEl.value = pv;
    stEl.value = Math.min(Math.max(0, roofArea - pv), stHeatCap);
  }

  if (rPvEl) rPvEl.value = pvEl.value;
  if (rStEl) rStEl.value = stEl.value;
  syncRangeLabels();
}

function bindEvents() {
  Object.keys(rangeIds).forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => {
      if (id === 'pvArea' || id === 'stArea') {
        applyRoofConstraint(id);
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

  [
    'roofArea', 'buildAreaLimit', 'heatUse', 'stYield', 'optimizationWeight',
    'discountRate', 'horizonYears', 'pvMaintenancePerM2', 'stMaintenancePerM2',
    'pvCapexPerM2', 'stCapexPerM2', 'efPvPlant', 'efStPlant',
    'electricityPrice', 'heatPrice', 'feedInTariff',
  ].forEach((id) => {
    const el = $(id);
    if (el) {
      el.addEventListener('input', () => {
        updateBuildableAreaLimit();
        if (document.querySelector('.shell').classList.contains('show-results')) refresh();
      });
    }
  });

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
  const resultYearEl = $('resultYear');
  if (resultYearEl) resultYearEl.addEventListener('change', refresh);

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
