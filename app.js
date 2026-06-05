const DEFAULTS = {
  electricityUse: 41150,
  heatUse: 189000,
  roofArea: 303,
  buildAreaLimit: 303,
  electricityMix: 'wwz',
  heatMethod: 'districtWood',
  newElectricityMix: 'wwz',
  newHeatMethod: 'districtWood',
  electricityPrice: 0.208,
  electricityFixedCost: 127.08,
  heatPrice: 0.076,
  feedInTariff: 0.11,
  optimizationWeight: 0.5,
  budgetEnabled: false,
  budgetLimit: 100000,
  batteryEnabled: false,
  batteryCostInput: 16940,
  batteryDegradation: 2,
  batteryGamma: 0.5,
  inflationEnabled: false,
  inflationRate: 2,
  discountRate: 2.5,
  horizonYears: 25,
  gridFactor: 0.078,
  pvArea: 120,
  pvYield: 180,
  pvSelfShare: 0.4,
  stArea: 0,
  stYield: 450,
  stUtilization: 0.6,
  pvDegradation: 0.7,
  stDegradation: 0.5,
  pvCapexPerM2: 450,
  stCapexPerM2: 900,
  pvMaintenancePerM2: 7,
  stMaintenancePerM2: 6,
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
};

const EMBODIED = { pvPerM2: 420, stPerM2: 90 };

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 0) => Number.isFinite(n) ? n.toLocaleString('de-CH', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—';
const pct = (n, d = 0) => Number.isFinite(n) ? `${fmt(n, d)}%` : '—';

const ids = [
  'electricityUse', 'heatUse', 'roofArea', 'buildAreaLimit',
  'electricityMix', 'heatMethod', 'newElectricityMix', 'newHeatMethod',
  'electricityPrice', 'electricityFixedCost', 'heatPrice', 'feedInTariff',
  'optimizationWeight', 'budgetEnabled', 'budgetLimit',
  'batteryEnabled', 'batteryCostInput', 'batteryDegradation', 'batteryGamma',
  'inflationEnabled', 'inflationRate',
  'discountRate', 'horizonYears', 'gridFactor',
  'pvArea', 'pvYield', 'pvSelfShare',
  'stArea', 'stYield', 'stUtilization',
  'pvDegradation', 'stDegradation',
  'pvCapexPerM2', 'stCapexPerM2',
  'pvMaintenancePerM2', 'stMaintenancePerM2',
  'co2Wwz', 'co2Swiss', 'co2Hydro',
  'co2DistrictWood', 'co2Oil', 'co2Gas', 'co2Pellets', 'co2DistrictMix',
  'efPvPlant', 'efStPlant',
];

const rangeIds = {
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

function syncRanges(state) {
  $(rangeIds.pvArea).textContent = fmt(state.pvArea, 0);
  $(rangeIds.pvYield).textContent = fmt(state.pvYield, 0);
  $(rangeIds.pvSelfShare).textContent = pct(state.pvSelfShare * 100, 0);
  if ($(rangeIds.optimizationWeight)) $(rangeIds.optimizationWeight).textContent = pct(state.optimizationWeight * 100, 0);
  if ($('budgetLimit')) $('budgetLimit').disabled = !state.budgetEnabled;
  if ($('budgetLimitField')) $('budgetLimitField').hidden = !state.budgetEnabled;
  if ($('batteryFields')) $('batteryFields').hidden = !state.batteryEnabled;
  ['batteryCostInput', 'batteryDegradation', 'batteryGamma'].forEach((id) => {
    if ($(id)) $(id).disabled = !state.batteryEnabled;
  });
  if ($('inflationRate')) $('inflationRate').disabled = !state.inflationEnabled;
  if ($('inflationRateField')) $('inflationRateField').hidden = !state.inflationEnabled;
  $(rangeIds.stArea).textContent = fmt(state.stArea, 0);
  $(rangeIds.stYield).textContent = fmt(state.stYield, 0);
  $(rangeIds.stUtilization).textContent = pct(state.stUtilization * 100, 0);
  $(rangeIds.pvDegradation).textContent = `${fmt(state.pvDegradation, 1)}%`;
  $(rangeIds.stDegradation).textContent = `${fmt(state.stDegradation, 1)}%`;
  const pvSelfShareHint = $('pvSelfShareHint');
  if (pvSelfShareHint) {
    pvSelfShareHint.textContent = `Reference share at full available-roof PV coverage (${fmt(state.roofArea, 0)} m²).`;
  }
  const stUtilizationHint = $('stUtilizationHint');
  if (stUtilizationHint) {
    stUtilizationHint.textContent = `Usable share is 100% at 1 m² and declines to this minimum at full available-roof ST coverage (${fmt(state.roofArea, 0)} m²).`;
  }

  // Update manual slider maxes for area, heat demand, and optional investment budget.
  ['pvArea', 'stArea', 'rPvArea', 'rStArea'].forEach((id) => {
    const el = $(id);
    if (el) {
      const stHeatCap = state.stYield > 0 ? state.heatUse / state.stYield : 0;
      const areaLimit = Math.min(state.roofArea, state.buildAreaLimit);
      const batteryInvestment = state.batteryEnabled ? Math.max(0, state.batteryCostInput) : 0;
      const availableBudget = state.budgetEnabled ? Math.max(0, state.budgetLimit - batteryInvestment) : Infinity;
      const pvRate = Math.max(0, state.pvCapexPerM2);
      const stRate = Math.max(0, state.stCapexPerM2);
      const isPv = id === 'pvArea' || id === 'rPvArea';
      const isManual = id === 'pvArea' || id === 'rPvArea' || id === 'stArea' || id === 'rStArea';
      const ownRate = isPv ? pvRate : stRate;
      const budgetMax = isManual && Number.isFinite(availableBudget) && ownRate > 0
        ? Math.max(0, availableBudget / ownRate)
        : areaLimit;
      const technologyMax = isPv ? areaLimit : Math.min(areaLimit, stHeatCap);
      el.max = Math.max(0, Math.min(technologyMax, budgetMax));
    }
  });

  const areaLimit = Math.min(state.roofArea, state.buildAreaLimit);
  const newExceedsRoof = state.pvArea + state.stArea > areaLimit + 1e-9;
  $('roofWarning').classList.toggle('visible', newExceedsRoof);

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

}

function electricityFactor(state) {
  if (state.electricityMix === 'custom') return state.gridFactor;
  const factorId = ELECTRICITY_MIXES[state.electricityMix].factorId;
  const el = factorId ? $(factorId) : null;
  return el ? Number(el.value) : 0;
}

function heatFactor(state) {
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
  const factorId = HEAT_METHODS[state.newHeatMethod].factorId;
  const el = factorId ? $(factorId) : null;
  return el ? Number(el.value) : 0;
}

function yieldFactor(degradationPct, yearIndex) {
  return Math.max(0, 1 - yearIndex * (Math.max(0, degradationPct) / 100));
}

function estimatedBatteryCapacity(costInput) {
  const cost = Math.max(0, costInput);
  if (cost < 16940) return cost / 847;
  if (cost < 30000) return 20 + (cost - 16940) / 163.25;
  return 100 + (cost - 30000) / 266.67;
}

function dynamicSelfConsumptionShare(state, pvArea, availableRoofArea, pvFactor, batteryFactor) {
  if (pvArea <= 0 || availableRoofArea <= 0) return 0;
  const controllerShare = Math.max(0, Math.min(state.pvSelfShare, 1));
  const baseShare = 1 - (1 - controllerShare) * (pvArea / availableRoofArea);
  const estimatedCapacity = state.batteryEnabled ? estimatedBatteryCapacity(state.batteryCostInput) : 0;
  const annualPvProduction = pvArea * Math.max(0, state.pvYield) * pvFactor;
  const gamma = Math.max(0, Math.min(1, state.batteryGamma));
  const effectiveGamma = gamma * Math.max(0, state.pvYield);
  const batteryBonus = state.batteryEnabled && annualPvProduction > 0
    ? Math.min(0.5, effectiveGamma * estimatedCapacity * batteryFactor / annualPvProduction)
    : 0;
  return Math.max(0, Math.min(1, baseShare + batteryBonus));
}

function solarThermalUsableFraction(state, stArea, stFactor = 1) {
  const availableRoofArea = Math.max(0, state.roofArea);
  if (stArea <= 0 || availableRoofArea <= 0) return 1;
  const minimumFraction = Math.max(0, Math.min(1, state.stUtilization));
  if (availableRoofArea <= 1) return minimumFraction;
  const effectiveArea = Math.max(0, stArea * stFactor);
  return Math.max(
    minimumFraction,
    Math.min(1, 1 - (1 - minimumFraction) * ((effectiveArea - 1) / (availableRoofArea - 1))),
  );
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
  const baselineElectricity = Math.max(state.electricityUse, 0);
  const baselineHeat = Math.max(state.heatUse, 0);
  const baselineCost = baselineElectricity * state.electricityPrice + baselineHeat * state.heatPrice + Math.max(0, state.electricityFixedCost);
  const baselineCO2 = baselineElectricity * gridEF + baselineHeat * heatEF;
  const pvCapex = x * Math.max(0, state.pvCapexPerM2);
  const stCapex = y * Math.max(0, state.stCapexPerM2);
  const batteryCapacity = state.batteryEnabled ? estimatedBatteryCapacity(state.batteryCostInput) : 0;
  const batteryCapex = state.batteryEnabled ? Math.max(0, state.batteryCostInput) : 0;
  const pvMaintenance = x * Math.max(0, state.pvMaintenancePerM2);
  const stMaintenance = y * Math.max(0, state.stMaintenancePerM2);
  const years = [];
  let totalCost = 0;
  let totalEmissions = 0;
  let pvPlantCO2 = 0;
  let stPlantCO2 = 0;
  let baselineCostTotal = 0;
  let baselineCO2Total = 0;
  let cumulativeDiscountedSavings = 0;
  let investmentNpv = -(pvCapex + stCapex + batteryCapex);

  for (let yearIndex = 0; yearIndex < horizon; yearIndex += 1) {
    const pvFactor = yieldFactor(state.pvDegradation, yearIndex);
    const stFactor = yieldFactor(state.stDegradation, yearIndex);
    const batteryFactor = yieldFactor(state.batteryDegradation, yearIndex);
    const batteryEffectiveCapacity = batteryCapacity * batteryFactor;
    const inflationFactor = state.inflationEnabled
      ? Math.pow(1 + Math.max(0, state.inflationRate) / 100, yearIndex)
      : 1;
    const electricityPrice = state.electricityPrice * inflationFactor;
    const electricityFixedCost = Math.max(0, state.electricityFixedCost) * inflationFactor;
    const heatPrice = state.heatPrice * inflationFactor;
    const maintenance = (pvMaintenance + stMaintenance) * inflationFactor;
    const yearBaselineCost = baselineElectricity * electricityPrice + baselineHeat * heatPrice + electricityFixedCost;
    const pvGeneration = x * pvFactor * qPv;
    const selfConsumptionShare = dynamicSelfConsumptionShare(state, x, Math.max(0, state.roofArea), pvFactor, batteryFactor);
    const pvPotentialSelfConsumption = pvGeneration * selfConsumptionShare;
    const pvSelfConsumption = Math.min(pvPotentialSelfConsumption, baselineElectricity);
    const pvExport = Math.max(0, pvGeneration - pvSelfConsumption);
    const stUsableFraction = solarThermalUsableFraction(state, y, stFactor);
    const stGenerationRaw = y * stFactor * qSt;
    const stGeneration = stGenerationRaw * stUsableFraction;
    const electricityResidual = Math.max(0, baselineElectricity - pvSelfConsumption);
    const heatResidual = Math.max(0, baselineHeat - stGeneration);
    const investment = yearIndex === 0 ? pvCapex + stCapex + batteryCapex : 0;
    const operatingCost = maintenance
      + electricityFixedCost
      + electricityResidual * electricityPrice
      + heatResidual * heatPrice
      - pvExport * state.feedInTariff;
    const yearCost = investment
      + operatingCost;
    const avoidedElectricityCost = (baselineElectricity - electricityResidual) * electricityPrice;
    const avoidedHeatCost = (baselineHeat - heatResidual) * heatPrice;
    const feedInRevenue = pvExport * state.feedInTariff;
    const operatingSavings = avoidedElectricityCost
      + avoidedHeatCost
      + feedInRevenue
      - maintenance;
    const yearPvPlantCO2 = pvGeneration * Math.max(0, state.efPvPlant);
    const yearStPlantCO2 = stGenerationRaw * Math.max(0, state.efStPlant);
    const yearPlantCO2 = yearPvPlantCO2 + yearStPlantCO2;
    const yearCO2 = yearPlantCO2
      + electricityResidual * newGridEF
      + heatResidual * newHeatEF;
    const discountFactor = 1 / Math.pow(1 + discount, yearIndex + 1);
    const npvDiscountFactor = discountFactor;
    totalCost += investment + operatingCost * discountFactor;
    totalEmissions += yearCO2;
    pvPlantCO2 += yearPvPlantCO2;
    stPlantCO2 += yearStPlantCO2;
    baselineCostTotal += yearBaselineCost * discountFactor;
    baselineCO2Total += baselineCO2;
    cumulativeDiscountedSavings += (yearBaselineCost - operatingCost) * discountFactor - investment;
    investmentNpv += operatingSavings * npvDiscountFactor;
    years.push({
      yearIndex,
      pvFactor,
      stFactor,
      batteryFactor,
      batteryEffectiveCapacity,
      selfConsumptionShare,
      inflationFactor,
      electricityPrice,
      electricityFixedCost,
      heatPrice,
      baselineCost: yearBaselineCost,
      pvGeneration,
      stGeneration,
      stGenerationRaw,
      stUsableFraction,
      pvSelfConsumption,
      electricityResidual,
      heatResidual,
      pvExport,
      yearCost,
      operatingCost,
      operatingSavings,
      avoidedElectricityCost,
      avoidedHeatCost,
      feedInRevenue,
      investment,
      maintenance,
      yearCO2,
      pvPlantCO2: yearPvPlantCO2,
      stPlantCO2: yearStPlantCO2,
      plantCO2: yearPlantCO2,
      cumulativeDiscountedSavings,
    });
  }

  const npvObjectiveRatio = baselineCostTotal > 0 ? 1 - investmentNpv / baselineCostTotal : 1;
  const emissionRatio = baselineCO2Total > 0 ? totalEmissions / baselineCO2Total : 0;
  const objective = state.optimizationWeight * npvObjectiveRatio + (1 - state.optimizationWeight) * emissionRatio;

  return {
    x, y, gridEF, heatEF, newGridEF, newHeatEF,
    baselineElectricity, baselineHeat, baselineCost, baselineCO2,
    baselineCostTotal, baselineCO2Total,
    pvCapex, stCapex, batteryCapex, capex: pvCapex + stCapex + batteryCapex,
    pvMaintenance, stMaintenance,
    pvPlantCO2, stPlantCO2, plantCO2: pvPlantCO2 + stPlantCO2,
    totalCost, totalEmissions, investmentNpv, npvObjectiveRatio, emissionRatio, objective, years,
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
    const savings = year.baselineCost - scenarioCost;
    const annualAvoided = totals.baselineCO2 - scenarioCO2;

    return {
      yearIndex, gridEF: totals.gridEF, heatEF: totals.heatEF, newGridEF: totals.newGridEF, newHeatEF: totals.newHeatEF,
      baselineElectricity: totals.baselineElectricity, baselineHeat: totals.baselineHeat,
      baselineCO2: totals.baselineCO2, baselineCost: year.baselineCost,
      baselineCO2Total: totals.baselineCO2Total, baselineCostTotal: totals.baselineCostTotal,
      pvGeneration: year.pvGeneration, pvSelf: year.pvSelfConsumption, pvExport: year.pvExport,
      heatThermalUseful: Math.min(year.stGeneration, totals.baselineHeat), heatAfterThermal: year.heatResidual,
      electricityResidual: year.electricityResidual, heatResidual: year.heatResidual,
      scenarioCO2, scenarioCost, savings,
      totalCost: totals.totalCost, totalEmissions: totals.totalEmissions,
      capex: totals.capex, om: totals.pvMaintenance + totals.stMaintenance, annualCashflow: savings, annualAvoided,
      pvCapex: totals.pvCapex, stCapex: totals.stCapex, batteryCapex: totals.batteryCapex,
      effectivePvArea: totals.x, effectiveStArea: totals.y,
      pvPlantCO2: year.pvPlantCO2, stPlantCO2: year.stPlantCO2, plantCO2: year.plantCO2,
      annualizedCapex: 0, investmentNpv: totals.investmentNpv, npvObjectiveRatio: totals.npvObjectiveRatio, emissionRatio: totals.emissionRatio, objective: totals.objective,
      multiPeriod: totals,
    };
  }

  const baselineElectricity = Math.max(state.electricityUse, 0);
  const baselineHeat = Math.max(state.heatUse, 0);
  const baselineCO2 = baselineElectricity * gridEF + baselineHeat * heatEF;
  const baselineCost = baselineElectricity * state.electricityPrice + baselineHeat * state.heatPrice + Math.max(0, state.electricityFixedCost);

  const pvGeneration = pvArea * state.pvYield * pvFactor;
  const pvPotentialSelf = pvGeneration * state.pvSelfShare;

  const stUsableFraction = solarThermalUsableFraction(state, stArea, stFactor);
  const heatThermalRaw = stArea * state.stYield * stFactor * stUsableFraction;
  const heatThermalUseful = Math.min(heatThermalRaw, baselineHeat);
  const heatAfterThermal = Math.max(baselineHeat - heatThermalUseful, 0);

  const netElectricDemand = baselineElectricity;
  const pvSelf = Math.min(pvPotentialSelf, netElectricDemand);
  const pvExport = Math.max(pvGeneration - pvSelf, 0);

  const electricityResidual = Math.max(netElectricDemand - pvSelf, 0);
  const heatResidual = heatAfterThermal;

  const scenarioCO2 = electricityResidual * newGridEF + heatResidual * newHeatEF;
  const scenarioCost = Math.max(0, state.electricityFixedCost) + electricityResidual * state.electricityPrice + heatResidual * state.heatPrice - pvExport * state.feedInTariff;
  const savings = baselineCost - scenarioCost;

  const pvCapex = pvArea * state.pvCapexPerM2;
  const stCapex = stArea * state.stCapexPerM2;
  const capex = pvCapex + stCapex;
  const om = 0;

  const annualCashflow = savings - om;
  const annualAvoided = baselineCO2 - scenarioCO2;

  return {
    yearIndex, gridEF, heatEF, newGridEF, newHeatEF,
    baselineElectricity, baselineHeat, baselineCO2, baselineCost,
    pvGeneration, pvSelf, pvExport,
    heatThermalUseful, heatAfterThermal, stUsableFraction,
    electricityResidual, heatResidual,
    scenarioCO2, scenarioCost, savings,
    capex, om, annualCashflow, annualAvoided,
    pvCapex, stCapex,
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

function attachLineChartTooltip(el, series, labels, options, width, pad) {
  const svg = el.querySelector('svg');
  const hoverOverlay = svg?.querySelector('.chart-hover-overlay');
  if (!svg || !hoverOverlay || !labels.length) return;

  if (el._lineChartTooltip) el._lineChartTooltip.remove();
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  document.body.appendChild(tooltip);
  el._lineChartTooltip = tooltip;

  const palette = ['#b36b2b', '#3d5b43', '#5a7680', '#7b5f8f'];
  const innerWidth = width - pad.left - pad.right;

  hoverOverlay.addEventListener('pointermove', (event) => {
    const rect = svg.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const ratio = Math.max(0, Math.min(1, (svgX - pad.left) / innerWidth));
    const fractionalIndex = ratio * Math.max(labels.length - 1, 0);
    const lowerIndex = Math.floor(fractionalIndex);
    const upperIndex = Math.min(labels.length - 1, Math.ceil(fractionalIndex));
    const fraction = fractionalIndex - lowerIndex;
    const displayedYear = fractionalIndex + 1;

    tooltip.replaceChildren();
    const heading = document.createElement('b');
    heading.textContent = `Year ${fmt(displayedYear, 2)}`;
    tooltip.appendChild(heading);

    series.forEach((item, seriesIndex) => {
      const row = document.createElement('div');
      row.className = 'chart-tooltip-row';
      const swatch = document.createElement('span');
      swatch.className = 'chart-tooltip-swatch';
      swatch.style.background = item.color ?? palette[seriesIndex % palette.length];
      const value = document.createElement('span');
      const lowerValue = item.values[lowerIndex] ?? 0;
      const upperValue = item.values[upperIndex] ?? lowerValue;
      const interpolatedValue = lowerValue + (upperValue - lowerValue) * fraction;
      value.textContent = `${item.label}: ${fmt(interpolatedValue, options.tickDecimals ?? 0)}`;
      row.append(swatch, value);
      tooltip.appendChild(row);
    });

    tooltip.hidden = false;
    const maxX = Math.max(4, window.innerWidth - tooltip.offsetWidth - 4);
    const maxY = Math.max(4, window.innerHeight - tooltip.offsetHeight - 4);
    tooltip.style.left = `${Math.max(4, Math.min(event.clientX + 14, maxX))}px`;
    tooltip.style.top = `${Math.max(4, Math.min(event.clientY + 14, maxY))}px`;
  });

  hoverOverlay.addEventListener('pointerleave', () => {
    tooltip.hidden = true;
  });
}

function axisTicks(max, count = 5, min = 0) {
  if (max <= min) return [min];
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => min + i * step);
}

function renderStackedBarChart(el, state, scenario, optimum) {
  const width = 860;
  const height = 440;
  const pad = { top: 24, right: 30, bottom: 54, left: 68 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const optimized = optimum.scenario;
  const selectedYear = Math.max(1, Math.min(Math.round(Number($('resultYear')?.value) || 1), Math.max(1, Math.round(state.horizonYears))));
  const manualYears = scenario.multiPeriod?.years ?? [];
  const optimizedYears = optimized.multiPeriod?.years ?? [];
  const manualYear = manualYears[selectedYear - 1] ?? manualYears[0];
  const optimizedYear = optimizedYears[selectedYear - 1] ?? optimizedYears[0];
  const baseElec = scenario.baselineElectricity * scenario.gridEF / 1000;
  const baseHeat = scenario.baselineHeat * scenario.heatEF / 1000;
  const scenElec = (manualYear?.electricityResidual ?? 0) * scenario.newGridEF / 1000;
  const scenHeat = (manualYear?.heatResidual ?? 0) * scenario.newHeatEF / 1000;
  const scenPv = (manualYear?.pvPlantCO2 ?? 0) / 1000;
  const scenSt = (manualYear?.stPlantCO2 ?? 0) / 1000;
  const optElec = (optimizedYear?.electricityResidual ?? 0) * optimized.newGridEF / 1000;
  const optHeat = (optimizedYear?.heatResidual ?? 0) * optimized.newHeatEF / 1000;
  const optPv = (optimizedYear?.pvPlantCO2 ?? 0) / 1000;
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
      <text x="${pad.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#67727a">${fmt(tick, 3)}</text>`;
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
      <text x="${x1 + barW / 2}" y="${toY(baseTotal) - 8}" text-anchor="middle" font-size="13" font-weight="700" fill="#27413a">${fmt(baseTotal, 3)} t</text>

      <rect x="${x2}" y="${toY(scenHeat)}" width="${barW}" height="${segH(scenHeat)}" rx="10" fill="${colors.heating}"></rect>
      <rect x="${x2}" y="${toY(scenHeatTotal)}" width="${barW}" height="${visibleSegH(scenSt)}" rx="10" fill="${colors.solarThermal}"></rect>
      <rect x="${x2}" y="${toY(scenElecTotal)}" width="${barW}" height="${visibleSegH(scenElec)}" rx="10" fill="${colors.electricity}"></rect>
      <rect x="${x2}" y="${toY(scenTotal)}" width="${barW}" height="${visibleSegH(scenPv)}" rx="10" fill="${colors.pv}"></rect>
      <text x="${x2 + barW / 2}" y="${toY(scenTotal) - 8}" text-anchor="middle" font-size="13" font-weight="700" fill="#27413a">${fmt(scenTotal, 3)} t</text>

      <rect x="${x3}" y="${toY(optHeat)}" width="${barW}" height="${segH(optHeat)}" rx="10" fill="${colors.heating}"></rect>
      <rect x="${x3}" y="${toY(optHeatTotal)}" width="${barW}" height="${visibleSegH(optSt)}" rx="10" fill="${colors.solarThermal}"></rect>
      <rect x="${x3}" y="${toY(optElecTotal)}" width="${barW}" height="${visibleSegH(optElec)}" rx="10" fill="${colors.electricity}"></rect>
      <rect x="${x3}" y="${toY(optTotal)}" width="${barW}" height="${visibleSegH(optPv)}" rx="10" fill="${colors.pv}"></rect>
      <text x="${x3 + barW / 2}" y="${toY(optTotal) - 8}" text-anchor="middle" font-size="13" font-weight="700" fill="#27413a">${fmt(optTotal, 3)} t</text>

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

  const totalPvKwh = lifecycle.pvGeneration.reduce((a, b) => a + b, 0);

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
      <path d="${pvFillPath}" fill="rgba(61,91,67,0.10)" />
      <path d="${pvPath}" fill="none" stroke="#3d5b43" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${hasST ? `<path d="${stPath}" fill="none" stroke="#5a7680" stroke-width="2" stroke-dasharray="6 4" stroke-linecap="round" stroke-linejoin="round" />` : ''}
      ${xTicks}
      <text x="${pad.left - 10}" y="${pad.top - 12}" text-anchor="end" font-size="11" fill="#67727a">kWh/y</text>
      ${legend}
      <rect class="chart-hover-overlay" x="${pad.left}" y="${pad.top}" width="${innerW}" height="${innerH}" fill="transparent" pointer-events="all"></rect>
    </svg>`;
  renderSvg(el, svg);
  attachLineChartTooltip(el, [
    { label: 'PV output (kWh/y)', values: lifecycle.pvGeneration, color: '#3d5b43' },
    ...(hasST ? [{ label: 'ST heat (kWh/y)', values: lifecycle.stGeneration, color: '#5a7680' }] : []),
  ], lifecycle.years.map(String), { tickDecimals: 0 }, width, pad);
}

function linePath(values, width, height, pad, minValue, maxValue) {
  const n = values.length;
  if (!n) return '';
  const span = Math.max(maxValue - minValue, 1e-9);
  return values.map((v, i) => {
    const x = pad.left + (i / Math.max(n - 1, 1)) * (width - pad.left - pad.right);
    const y = pad.top + (1 - ((v - minValue) / span)) * (height - pad.top - pad.bottom);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function renderLineChart(el, series, labels, options = {}) {
  const width = 860;
  const height = 500;
  const paybackItems = options.paybackItems ?? (
    options.paybackYearIndex !== undefined
      ? [{ seriesIndex: 0, yearIndex: options.paybackYearIndex }]
      : []
  );
  const visiblePaybackItems = paybackItems.filter((item) => (
    series[item.seriesIndex ?? 0] && item.yearIndex >= 0 && item.yearIndex < labels.length
  ));
  const paybackHeaderHeight = visiblePaybackItems.length * 24;
  const pad = { top: 22 + paybackHeaderHeight, right: 24, bottom: 48, left: 68 };
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
    const d = linePath(s.values, width, height, pad, minValue, maxValue);
    const n = s.values.length;
    const fillClose = `L ${pad.left + ((n - 1) / Math.max(n - 1, 1)) * innerW} ${zeroY} L ${pad.left} ${zeroY} Z`;
    return `<path d="${d} ${fillClose}" fill="${s.color ?? palette[i % palette.length]}" opacity="0.07" />`;
  }).join('');

  const paths = series.map((s, i) => {
    const d = linePath(s.values, width, height, pad, minValue, maxValue);
    return `<path d="${d}" fill="none" stroke="${s.color ?? palette[i % palette.length]}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`;
  }).join('');

  const dots = series.flatMap((s, si) => s.values.map((v, vi) => {
    const x = pad.left + (vi / Math.max(s.values.length - 1, 1)) * innerW;
    const y = pad.top + (1 - ((v - minValue) / span)) * innerH;
    return `<circle cx="${x}" cy="${y}" r="2.6" fill="${s.color ?? palette[si % palette.length]}" opacity="0.9"></circle>`;
  })).join('');

  const lWidth = 160;
  const lStart = Math.max(pad.left, width - series.length * lWidth - pad.right);
  const legend = series.map((s, i) => `
    <g transform="translate(${lStart + i * lWidth}, 10)">
      <rect x="0" y="0" width="12" height="12" rx="3" fill="${s.color ?? palette[i % palette.length]}"></rect>
      <text x="18" y="10" font-size="12" fill="#516069">${s.label}</text>
    </g>`).join('');

  const paybackAnnotation = visiblePaybackItems.map((item, annotationIndex) => {
    const pbIdx = item.yearIndex;
    const npvSeries = series[item.seriesIndex ?? 0];
    if (!npvSeries || pbIdx < 0 || pbIdx >= labels.length) return '';
    const npvValues = npvSeries.values ?? [];
    // Linearly interpolate exact zero-crossing between pbIdx-1 and pbIdx
    let fracIdx = pbIdx;
    if (pbIdx > 0 && npvValues[pbIdx - 1] < 0 && npvValues[pbIdx] >= 0) {
      const v0 = npvValues[pbIdx - 1];
      const v1 = npvValues[pbIdx];
      fracIdx = pbIdx - 1 + (-v0) / (v1 - v0);
    }
    const pbX = pad.left + (fracIdx / Math.max(labels.length - 1, 1)) * innerW;
    const pbYear = (fracIdx + 1).toFixed(2);
    const color = npvSeries.color ?? palette[(item.seriesIndex ?? 0) % palette.length];
    const label = item.label ?? npvSeries.label.replace(' NPV (CHF)', '');
    const labelText = `${label} break-even: year ${pbYear}`;
    const labelWidth = Math.max(150, labelText.length * 6.2 + 18);
    const labelX = pad.left;
    const labelY = 22 + annotationIndex * 24;
    return `
      <line x1="${pbX}" y1="${pad.top}" x2="${pbX}" y2="${pad.top + innerH}" stroke="${color}" stroke-opacity="0.7" stroke-width="1.5" stroke-dasharray="5 4" />
      <circle cx="${pbX}" cy="${zeroY}" r="4" fill="${color}" />
      <rect x="${labelX}" y="${labelY}" width="${labelWidth}" height="20" rx="4" fill="white" stroke="${color}" stroke-opacity="0.65" />
      <text x="${labelX + 9}" y="${labelY + 14}" font-size="11" font-weight="600" fill="${color}">${labelText}</text>`;
  }).join('');

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Lifecycle chart">
      ${axes}
      <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="rgba(23,33,38,0.38)" />
      ${minValue < 0 ? `<line x1="${pad.left}" y1="${zeroY}" x2="${width - pad.right}" y2="${zeroY}" stroke="rgba(23,33,38,0.22)" stroke-dasharray="4 3" />` : ''}
      ${fills}${paths}${paybackAnnotation}${dots}${legend}${xTicks}
      <rect class="chart-hover-overlay" x="${pad.left}" y="${pad.top}" width="${innerW}" height="${innerH}" fill="transparent" pointer-events="all"></rect>
    </svg>`;
  renderSvg(el, svg);
  attachLineChartTooltip(el, series, labels, options, width, pad);
}

function findOptimalScenario(state) {
  const roof = Math.max(0, Math.floor(Math.min(state.roofArea, state.buildAreaLimit)));
  const qSt = Math.max(0, state.stYield);
  const maxStByHeat = qSt > 0 ? Math.floor(state.heatUse / qSt) : 0;
  const budget = Math.max(0, state.budgetLimit);
  const pvInvestmentRate = Math.max(0, state.pvCapexPerM2);
  const stInvestmentRate = Math.max(0, state.stCapexPerM2);
  const batteryInvestment = state.batteryEnabled
    ? Math.max(0, state.batteryCostInput)
    : 0;
  let best = null;

  for (let x = 0; x <= roof; x += 1) {
    const maxY = Math.max(0, Math.min(roof - x, maxStByHeat));
    for (let y = 0; y <= maxY; y += 1) {
      const initialInvestment = x * pvInvestmentRate + y * stInvestmentRate + batteryInvestment;
      if (state.budgetEnabled && initialInvestment > budget + 1e-9) continue;
      const scenario = annualScenario(state, 0, { pvArea: x, stArea: y });
      if (!best || scenario.objective < best.scenario.objective) {
        best = { x, y, scenario };
      }
    }
  }

  return best ?? { x: 0, y: 0, scenario: annualScenario(state, 0, { pvArea: 0, stArea: 0 }) };
}

function renderSummaryTable(state, scenario, lifecycle, optimum) {
  const n = lifecycle.years.length;
  const optimized = optimum.scenario;
  const manualAvgCo2 = scenario.totalEmissions / Math.max(1, n);
  const optimizedAvgCo2 = optimized.totalEmissions / Math.max(1, n);
  const baselineAvgCo2 = scenario.baselineCO2Total / Math.max(1, n);
  const rows = [
    ['PV area x', '0 m²', `${fmt(scenario.effectivePvArea ?? state.pvArea, 0)} m²`, `${fmt(optimum.x, 0)} m²`],
    ['Solar-thermal area y', '0 m²', `${fmt(scenario.effectiveStArea ?? state.stArea, 0)} m²`, `${fmt(optimum.y, 0)} m²`],
    ['Initial investment', '0 CHF', `${fmt(scenario.capex, 0)} CHF`, `${fmt(optimized.capex, 0)} CHF`],
    ['Investment NPV', '—', `${fmt(scenario.investmentNpv, 0)} CHF`, `${fmt(optimized.investmentNpv, 0)} CHF`],
    [`CO₂ total over ${n} years`, `${fmt(scenario.baselineCO2Total / 1000, 2)} t`, `${fmt(scenario.totalEmissions / 1000, 2)} t`, `${fmt(optimized.totalEmissions / 1000, 2)} t`],
    ['Average annual CO₂', `${fmt(baselineAvgCo2 / 1000, 3)} t/y`, `${fmt(manualAvgCo2 / 1000, 3)} t/y`, `${fmt(optimizedAvgCo2 / 1000, 3)} t/y`],
    ['CO₂ saved vs baseline', '—', `${fmt((scenario.baselineCO2Total - scenario.totalEmissions) / 1000, 2)} t`, `${fmt((optimized.baselineCO2Total - optimized.totalEmissions) / 1000, 2)} t`],
    ['Objective score Z', '—', fmt(scenario.objective, 3), fmt(optimized.objective, 3)],
    ['PV self-consumption share year 1', '—', pct((scenario.multiPeriod?.years?.[0]?.selfConsumptionShare ?? 0) * 100, 1), pct((optimized.multiPeriod?.years?.[0]?.selfConsumptionShare ?? 0) * 100, 1)],
    ['PV self-consumed year 1', '—', `${fmt(scenario.pvSelf, 0)} kWh`, `${fmt(optimized.pvSelf, 0)} kWh`],
    ['PV export year 1', '—', `${fmt(scenario.pvExport, 0)} kWh`, `${fmt(optimized.pvExport, 0)} kWh`],
    ['Grid electricity remaining year 1', `${fmt(scenario.baselineElectricity, 0)} kWh`, `${fmt(scenario.electricityResidual, 0)} kWh`, `${fmt(optimized.electricityResidual, 0)} kWh`],
    ['Solar-thermal useful heat year 1', '—', `${fmt(scenario.heatThermalUseful, 0)} kWh`, `${fmt(optimized.heatThermalUseful, 0)} kWh`],
    ['Solar-thermal usable fraction year 1', '—', pct((scenario.multiPeriod?.years?.[0]?.stUsableFraction ?? 1) * 100, 1), pct((optimized.multiPeriod?.years?.[0]?.stUsableFraction ?? 1) * 100, 1)],
  ];
  const tbody = $('summaryTable').querySelector('tbody');
  tbody.innerHTML = rows.map(([label, baseline, manual, optimizedValue]) => `
    <tr>
      <td>${label}</td>
      <td>${baseline}</td>
      <td>${manual}</td>
      <td>${optimizedValue}</td>
    </tr>
  `).join('');
}

function renderEmissionsComparison(state, scenario, optimum) {
  const el = $('emissionsComparison');
  if (!el) return;
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

function renderKpis(state, scenario, lifecycle, optimum) {
  const best = optimum;
  const optimized = best.scenario;
  const n = Math.max(1, Math.round(state.horizonYears));
  const selfSuff = optimized.baselineElectricity > 0
    ? Math.min(100, (optimized.pvSelf / optimized.baselineElectricity) * 100)
    : 0;
  const pvSelfConsumption = optimized.pvGeneration > 0
    ? Math.min(100, (optimized.pvSelf / optimized.pvGeneration) * 100)
    : 0;

  $('kpiCo2').textContent = `${fmt((optimized.baselineCO2Total - optimized.totalEmissions) / 1000, 2)} t`;
  $('kpiCo2Sub').textContent = optimized.baselineCO2Total > 0
    ? `${fmt(((optimized.baselineCO2Total - optimized.totalEmissions) / optimized.baselineCO2Total) * 100, 0)}% over ${n} years`
    : 'of baseline';
  $('kpiAbatement').textContent = fmt(optimized.objective, 3);
  $('kpiPayback').textContent = `${fmt(best.x, 0)} / ${fmt(best.y, 0)}`;
  $('kpiPvSelfConsumption').textContent = `${fmt(pvSelfConsumption, 0)}%`;
  $('kpiSelfSuff').textContent = `${fmt(selfSuff, 0)}%`;
  $('kpiCarbonPb').textContent = `${fmt(optimized.totalEmissions / 1000, 2)} t`;
  $('kpiCapex').textContent = `${fmt(optimized.capex, 0)} CHF`;
}

function renderEmissionsTimelineChart(el, state, scenario, optimum) {
  if (!el) return;
  const years = scenario.multiPeriod?.years ?? [];
  if (!years.length) return;
  const yearLabels = years.map((_, i) => String(i + 1));
  const baselinePerYear = years.map(() => scenario.baselineCO2 / 1000);
  const manualPerYear = years.map((y) => y.yearCO2 / 1000);
  const optYears = optimum.scenario.multiPeriod?.years ?? [];
  const optimizedPerYear = optYears.length ? optYears.map((y) => y.yearCO2 / 1000) : years.map(() => 0);
  renderLineChart(el, [
    { label: 'Baseline (tCO₂/y)', values: baselinePerYear, color: '#6a8b6f' },
    { label: 'Manuell (tCO₂/y)', values: manualPerYear, color: '#5a7680' },
    { label: 'Z-optimiert (tCO₂/y)', values: optimizedPerYear, color: '#3d5b43' },
  ], yearLabels, { tickDecimals: 2 });
}

let _refreshRAF = null;
function scheduleRefresh() {
  if (_refreshRAF) cancelAnimationFrame(_refreshRAF);
  _refreshRAF = requestAnimationFrame(() => { _refreshRAF = null; refresh(); });
}

function refresh() {
  const state = readState();
  syncRanges(state);
  syncResultYearOptions(state);

  const scenario = annualScenario(state, 0);
  const optimum = findOptimalScenario(state);
  const lifecycle = lifecycleSeries(state);
  const optimizedLifecycle = lifecycleSeries(state, { pvArea: optimum.x, stArea: optimum.y });
  const cashflowScenario = $('cashflowScenario')?.value ?? 'optimized';
  const manualPaybackYear = lifecycle.cumulativeNpv.findIndex((v) => v >= 0);
  const optimizedPaybackYear = optimizedLifecycle.cumulativeNpv.findIndex((v) => v >= 0);
  const cashflowSeries = cashflowScenario === 'manual'
    ? [{ label: 'Manual NPV (CHF)', values: lifecycle.cumulativeNpv, color: '#5a7680' }]
    : cashflowScenario === 'both'
      ? [
          { label: 'Manual NPV (CHF)', values: lifecycle.cumulativeNpv, color: '#5a7680' },
          { label: 'Z-optimized NPV (CHF)', values: optimizedLifecycle.cumulativeNpv, color: '#3d5b43' },
        ]
      : [{ label: 'Z-optimized NPV (CHF)', values: optimizedLifecycle.cumulativeNpv, color: '#3d5b43' }];
  const cashflowPaybackYear = cashflowScenario === 'manual'
    ? manualPaybackYear
    : cashflowScenario === 'optimized'
      ? optimizedPaybackYear
      : -1;
  const cashflowPaybackItems = cashflowScenario === 'both'
    ? [
        { seriesIndex: 0, yearIndex: manualPaybackYear, label: 'Manual' },
        { seriesIndex: 1, yearIndex: optimizedPaybackYear, label: 'Z-optimized' },
      ]
    : undefined;
  const cashflowNote = $('cashflowChartNote');
  if (cashflowNote) {
    cashflowNote.textContent = cashflowScenario === 'manual'
      ? 'NPV of the current manual scenario.'
      : cashflowScenario === 'both'
        ? 'Manual and Z-optimized NPV compared over the project horizon.'
        : 'NPV of the current Z-optimized recommendation.';
  }

  renderStackedBarChart($('snapshotChart'), state, scenario, optimum);
  renderEmissionsTimelineChart($('emissionsTimelineChart'), state, scenario, optimum);
  renderPvLifecycleChart($('pvLifecycleChart'), state, lifecycle);
  renderLineChart($('cashflowChart'), cashflowSeries, lifecycle.years.map(String), {
    tickDecimals: 0,
    paybackYearIndex: cashflowPaybackYear,
    paybackItems: cashflowPaybackItems,
  });
  renderKpis(state, scenario, lifecycle, optimum);
  renderSummaryTable(state, scenario, lifecycle, optimum);
  renderEmissionsComparison(state, scenario, optimum);
}

function syncResultSliders(state) {
  const map = [
    ['rPvArea', 'pvArea', (v) => fmt(v, 0), 'rPvAreaValue'],
    ['rStArea', 'stArea', (v) => fmt(v, 0), 'rStAreaValue'],
    ['rPvSelfShare', 'pvSelfShare', (v) => pct(v * 100, 0), 'rPvSelfShareValue'],
    ['rStUtilization', 'stUtilization', (v) => pct(v * 100, 0), 'rStUtilizationValue'],
    ['rOptimizationWeight', 'optimizationWeight', (v) => pct(v * 100, 0), 'rOptimizationWeightValue'],
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
    electricityPrice: 0.208,
    electricityFixedCost: 127.08,
    heatPrice: 0.076,
    pvArea: 0,
    stArea: 0,
  };
  writeState(baseline);
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
    ['Battery enabled', state.batteryEnabled ? 'Yes' : 'No'],
    ['Battery cost input K_Batt_Input (CHF)', state.batteryEnabled ? state.batteryCostInput : 0],
    ['Estimated battery capacity B (kWh)', state.batteryEnabled ? estimatedBatteryCapacity(state.batteryCostInput) : 0],
    ['Battery initial investment (CHF)', Math.round(scenario.batteryCapex ?? 0)],
    ['Battery degradation (%/y)', state.batteryEnabled ? state.batteryDegradation : 0],
    ['Battery calibration factor gamma', state.batteryEnabled ? state.batteryGamma : 0],
    ['Effective battery gamma (gamma × q_PV)', state.batteryEnabled ? state.batteryGamma * state.pvYield : 0],
    ['Battery effective capacity final year (kWh)', scenario.multiPeriod?.years?.at(-1)?.batteryEffectiveCapacity ?? 0],
    ['Inflation enabled', state.inflationEnabled ? 'Yes' : 'No'],
    ['Annual inflation factor (%)', state.inflationEnabled ? state.inflationRate : 0],
    ['PV output yr 1 (kWh)', Math.round(lifecycle.pvGeneration[0])],
    [`PV output yr ${n} (kWh)`, Math.round(lifecycle.pvGeneration[n - 1])],
    [`Total PV over ${n} years (MWh)`, (lifecycle.pvGeneration.reduce((a, b) => a + b, 0) / 1000).toFixed(1)],
    ['Total avoided CO₂ (t)', ((scenario.baselineCO2Total - scenario.totalEmissions) / 1000).toFixed(3)],
    ['Future cost present value K_total (CHF)', Math.round(scenario.totalCost)],
    ['Baseline cost present value (CHF)', Math.round(scenario.baselineCostTotal)],
    ['Annual savings (CHF/y)', Math.round(scenario.savings)],
    ['Manual initial investment cost (CHF)', Math.round(scenario.capex)],
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
  const budgetEnabled = $('budgetEnabled')?.checked ?? false;
  const batteryInvestment = $('batteryEnabled')?.checked ? Math.max(0, Number($('batteryCostInput').value)) : 0;
  const availableBudget = budgetEnabled
    ? Math.max(0, Number($('budgetLimit').value) - batteryInvestment)
    : Infinity;
  const pvRate = Math.max(0, Number($('pvCapexPerM2').value));
  const stRate = Math.max(0, Number($('stCapexPerM2').value));
  const pvEl = $('pvArea');
  const stEl = $('stArea');
  const rPvEl = $('rPvArea');
  const rStEl = $('rStArea');

  if (movedId === 'pvArea' || movedId === 'rPvArea') {
    const pvBudgetMax = Number.isFinite(availableBudget) && pvRate > 0 ? availableBudget / pvRate : roofArea;
    const pv = Math.max(0, Math.min(Number(pvEl.value), roofArea, pvBudgetMax));
    pvEl.value = pv;
    if (rPvEl) rPvEl.value = pv;
    const remainingBudget = availableBudget - pv * pvRate;
    const stBudgetMax = Number.isFinite(remainingBudget) && stRate > 0 ? remainingBudget / stRate : roofArea;
    const maxSt = Math.max(0, Math.min(roofArea - pv, stHeatCap, stBudgetMax));
    if (Number(stEl.value) > maxSt) {
      stEl.value = maxSt;
      if (rStEl) rStEl.value = maxSt;
    }
  } else {
    const stBudgetMax = Number.isFinite(availableBudget) && stRate > 0 ? availableBudget / stRate : roofArea;
    const st = Math.max(0, Math.min(Number(stEl.value), roofArea, stHeatCap, stBudgetMax));
    stEl.value = st;
    if (rStEl) rStEl.value = st;
    const remainingBudget = availableBudget - st * stRate;
    const pvBudgetMax = Number.isFinite(remainingBudget) && pvRate > 0 ? remainingBudget / pvRate : roofArea;
    const maxPv = Math.max(0, Math.min(roofArea - st, pvBudgetMax));
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
  applyRoofConstraint('pvArea');
  syncRangeLabels();
}

function bindEvents() {
  Object.keys(rangeIds).forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => {
      if (id === 'pvArea' || id === 'stArea') {
        applyRoofConstraint(id);
      }
      syncRangeLabels();
    });
  });

  $('electricityMix').addEventListener('change', syncRangeLabels);

  [
    'roofArea', 'buildAreaLimit', 'heatUse', 'stYield', 'optimizationWeight', 'budgetLimit',
    'batteryCostInput', 'batteryDegradation', 'batteryGamma',
    'inflationRate',
    'discountRate', 'horizonYears', 'pvMaintenancePerM2', 'stMaintenancePerM2',
    'pvCapexPerM2', 'stCapexPerM2', 'efPvPlant', 'efStPlant',
    'electricityPrice', 'electricityFixedCost', 'heatPrice', 'feedInTariff',
  ].forEach((id) => {
    const el = $(id);
    if (el) {
      el.addEventListener('input', () => {
        updateBuildableAreaLimit();
        if (document.querySelector('.shell').classList.contains('show-results')) scheduleRefresh();
      });
    }
  });

  const budgetEnabledEl = $('budgetEnabled');
  if (budgetEnabledEl) {
    budgetEnabledEl.addEventListener('change', () => {
      updateBuildableAreaLimit();
      if (document.querySelector('.shell').classList.contains('show-results')) scheduleRefresh();
    });
  }

  const batteryEnabledEl = $('batteryEnabled');
  if (batteryEnabledEl) {
    batteryEnabledEl.addEventListener('change', () => {
      updateBuildableAreaLimit();
      if (document.querySelector('.shell').classList.contains('show-results')) scheduleRefresh();
    });
  }

  const inflationEnabledEl = $('inflationEnabled');
  if (inflationEnabledEl) {
    inflationEnabledEl.addEventListener('change', () => {
      syncRangeLabels();
      if (document.querySelector('.shell').classList.contains('show-results')) scheduleRefresh();
    });
  }

  const cashflowScenarioEl = $('cashflowScenario');
  if (cashflowScenarioEl) {
    cashflowScenarioEl.addEventListener('change', () => {
      if (document.querySelector('.shell').classList.contains('show-results')) scheduleRefresh();
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
    ['rStUtilization', 'stUtilization', (v) => pct(v * 100, 0), 'rStUtilizationValue'],
    ['rOptimizationWeight', 'optimizationWeight', (v) => pct(v * 100, 0), 'rOptimizationWeightValue'],
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
      scheduleRefresh();
    });
  });
}

function init() {
  writeState(DEFAULTS);
  bindEvents();
  syncRangeLabels();
}

window.addEventListener('DOMContentLoaded', init);
