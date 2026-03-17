export const CONSTANTS = {
  g: 9.80665,
  waterDensity: 1000,
  pressureToHead: 1_000_000 / (1000 * 9.80665),
  defaultC: 110,
  velocityReference: 2.0,
  standardFixtureFlowsLpm: {
    13: 17,
    20: 40,
    25: 65,
  },
  usageRatioTable: [
    { count: 1, ratio: 1.0 },
    { count: 2, ratio: 1.4 },
    { count: 3, ratio: 1.7 },
    { count: 4, ratio: 2.0 },
    { count: 5, ratio: 2.2 },
    { count: 6, ratio: 2.4 },
    { count: 7, ratio: 2.6 },
    { count: 8, ratio: 2.8 },
    { count: 9, ratio: 2.9 },
    { count: 10, ratio: 3.0 },
    { count: 15, ratio: 3.5 },
    { count: 20, ratio: 4.0 },
    { count: 30, ratio: 5.0 },
  ],
  defaultCandidateDiametersMm: [13, 20, 25, 30, 40, 50, 75, 100],
};

function ensureFiniteNumber(value, label) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${label} を正しく入力してください。`);
  }
  return numeric;
}

function ensurePositive(value, label, allowZero = false) {
  const numeric = ensureFiniteNumber(value, label);
  if (allowZero ? numeric < 0 : numeric <= 0) {
    throw new Error(`${label} は${allowZero ? '0以上' : '0より大きい値'}で入力してください。`);
  }
  return numeric;
}

export function round(value, digits = 3) {
  if (!Number.isFinite(value)) {
    return NaN;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function lpmToM3s(lpm) {
  return Number(lpm) / 60000;
}

export function m3sToLpm(m3s) {
  return Number(m3s) * 60000;
}

export function mmToM(mm) {
  return Number(mm) / 1000;
}

export function pressureMpaToHeadM(pressureMpa) {
  return Number(pressureMpa) * CONSTANTS.pressureToHead;
}

export function calcDemandByHouseholds(households) {
  const n = ensurePositive(households, '戸数');
  if (n < 10) {
    return {
      demandLpm: 42 * Math.pow(n, 0.33),
      formula: 'Q = 42N^0.33',
      range: '10戸未満',
    };
  }
  if (n < 600) {
    return {
      demandLpm: 19 * Math.pow(n, 0.67),
      formula: 'Q = 19N^0.67',
      range: '10戸以上600戸未満',
    };
  }
  throw new Error('戸数式の適用範囲は 600 戸未満を想定しています。');
}

export function calcDemandByResidents(residents) {
  const p = ensurePositive(residents, '人数');
  if (p <= 30) {
    return {
      demandLpm: 26 * Math.pow(p, 0.36),
      formula: 'Q = 26P^0.36',
      range: '30人以下',
    };
  }
  if (p <= 200) {
    return {
      demandLpm: 13 * Math.pow(p, 0.56),
      formula: 'Q = 13P^0.56',
      range: '31人以上200人以下',
    };
  }
  throw new Error('居住人数式のMVP実装範囲は 200 人以下です。');
}

export function calcUsageRatioByFixtureCount(fixtureCount) {
  const count = ensurePositive(fixtureCount, '総給水用具数');
  const table = CONSTANTS.usageRatioTable;
  if (count > table[table.length - 1].count) {
    throw new Error('使用水量比表は現在 30 器具まで内蔵しています。');
  }

  const exact = table.find((item) => item.count === count);
  if (exact) {
    return exact.ratio;
  }

  for (let index = 0; index < table.length - 1; index += 1) {
    const current = table[index];
    const next = table[index + 1];
    if (count > current.count && count < next.count) {
      const position = (count - current.count) / (next.count - current.count);
      return current.ratio + (next.ratio - current.ratio) * position;
    }
  }

  throw new Error('使用水量比の計算に失敗しました。');
}

export function calcStandardizedDemandFromManual(totalFixtureFlowLpm, fixtureCount) {
  const totalFlow = ensurePositive(totalFixtureFlowLpm, '全使用水量');
  const count = ensurePositive(fixtureCount, '総給水用具数');
  const usageRatio = calcUsageRatioByFixtureCount(count);
  return {
    demandLpm: (totalFlow / count) * usageRatio,
    totalFixtureFlowLpm: totalFlow,
    totalFixtureCount: count,
    usageRatio,
    formula: 'Q = 全使用水量 / 総給水用具数 × 使用水量比',
  };
}

export function calcStandardizedDemandFromCounts({ fixture13 = 0, fixture20 = 0, fixture25 = 0 }) {
  const count13 = ensurePositive(fixture13, '13mm 器具数', true);
  const count20 = ensurePositive(fixture20, '20mm 器具数', true);
  const count25 = ensurePositive(fixture25, '25mm 器具数', true);

  const totalFixtureCount = count13 + count20 + count25;
  if (totalFixtureCount <= 0) {
    throw new Error('標準化法では器具数を 1 以上入力してください。');
  }

  const totalFixtureFlowLpm =
    count13 * CONSTANTS.standardFixtureFlowsLpm[13] +
    count20 * CONSTANTS.standardFixtureFlowsLpm[20] +
    count25 * CONSTANTS.standardFixtureFlowsLpm[25];

  const usageRatio = calcUsageRatioByFixtureCount(totalFixtureCount);
  return {
    demandLpm: (totalFixtureFlowLpm / totalFixtureCount) * usageRatio,
    totalFixtureFlowLpm,
    totalFixtureCount,
    usageRatio,
    formula: 'Q = 全使用水量 / 総給水用具数 × 使用水量比',
  };
}

function calcVelocity(qM3s, dM) {
  const area = (Math.PI * dM ** 2) / 4;
  return qM3s / area;
}

export function chooseFormula(diameterMm, formulaMode = 'auto') {
  const d = ensurePositive(diameterMm, '口径');
  if (formulaMode === 'weston' || formulaMode === 'hazen') {
    return formulaMode;
  }
  if (d <= 50) {
    return 'weston';
  }
  if (d >= 75) {
    return 'hazen';
  }
  throw new Error('自動判定は 50mm 以下を Weston、75mm 以上を Hazen-Williams としています。51〜74mm は公式を明示選択してください。');
}

export function calcWeston({ flowLpm, diameterMm, lengthM }) {
  const qM3s = lpmToM3s(ensurePositive(flowLpm, '流量'));
  const dM = mmToM(ensurePositive(diameterMm, '口径'));
  const l = ensurePositive(lengthM, '延長');
  const velocity = calcVelocity(qM3s, dM);
  if (velocity <= 0) {
    throw new Error('Weston 公式の流速が 0 以下になりました。入力を確認してください。');
  }
  const h =
    (0.0126 + (0.01739 - 0.1087 * dM) / Math.sqrt(velocity)) *
    (l / dM) *
    ((velocity ** 2) / (2 * CONSTANTS.g));
  return {
    formula: 'Weston',
    flowLpm: ensurePositive(flowLpm, '流量'),
    qM3s,
    diameterMm: ensurePositive(diameterMm, '口径'),
    diameterM: dM,
    lengthM: l,
    velocityMps: velocity,
    headLossM: h,
    headLossPer100M: (h / l) * 100,
  };
}

export function calcHazenWilliams({ flowLpm, diameterMm, lengthM, cValue = CONSTANTS.defaultC }) {
  const qM3s = lpmToM3s(ensurePositive(flowLpm, '流量'));
  const dM = mmToM(ensurePositive(diameterMm, '口径'));
  const l = ensurePositive(lengthM, '延長');
  const c = ensurePositive(cValue, 'C値');
  const h = 10.666 * Math.pow(c, -1.85) * Math.pow(dM, -4.87) * Math.pow(qM3s, 1.85) * l;
  const velocity = calcVelocity(qM3s, dM);
  return {
    formula: 'Hazen-Williams',
    flowLpm: ensurePositive(flowLpm, '流量'),
    qM3s,
    diameterMm: ensurePositive(diameterMm, '口径'),
    diameterM: dM,
    lengthM: l,
    cValue: c,
    velocityMps: velocity,
    headLossM: h,
    headLossPer100M: (h / l) * 100,
  };
}

export function calcFriction({ flowLpm, diameterMm, lengthM, formulaMode = 'auto', cValue = CONSTANTS.defaultC }) {
  const formula = chooseFormula(diameterMm, formulaMode);
  if (formula === 'weston') {
    return calcWeston({ flowLpm, diameterMm, lengthM });
  }
  return calcHazenWilliams({ flowLpm, diameterMm, lengthM, cValue });
}

export function calcHeadCheck({
  dynamicPressureMpa,
  staticPressureMpa = null,
  elevationM,
  terminalRequiredHeadM,
  meterLossM = 0,
  localLossM = 0,
  frictionLossM = 0,
}) {
  const dynamicPressure = ensurePositive(dynamicPressureMpa, '動水圧', true);
  const elevation = ensureFiniteNumber(elevationM, '高低差');
  const terminal = ensurePositive(terminalRequiredHeadM, '器具必要水頭', true);
  const meterLoss = ensurePositive(meterLossM, '水道メータ損失', true);
  const localLoss = ensurePositive(localLossM, '局部損失', true);
  const frictionLoss = ensurePositive(frictionLossM, '摩擦損失', true);

  const availableHeadM = pressureMpaToHeadM(dynamicPressure);
  const totalRequiredHeadM = elevation + terminal + meterLoss + localLoss + frictionLoss;
  const headMarginM = availableHeadM - totalRequiredHeadM;

  const dynamicPressurePass = dynamicPressure >= 0.15;
  const staticPressureNumeric =
    staticPressureMpa === null || staticPressureMpa === '' || Number.isNaN(Number(staticPressureMpa))
      ? null
      : ensurePositive(staticPressureMpa, '静水圧', true);
  const staticPressurePass = staticPressureNumeric === null ? null : staticPressureNumeric <= 0.74;

  return {
    availableHeadM,
    totalRequiredHeadM,
    headMarginM,
    dynamicPressureMpa: dynamicPressure,
    dynamicPressurePass,
    staticPressureMpa: staticPressureNumeric,
    staticPressurePass,
    elevationM: elevation,
    terminalRequiredHeadM: terminal,
    meterLossM: meterLoss,
    localLossM: localLoss,
    frictionLossM: frictionLoss,
    serviceable: dynamicPressurePass && headMarginM >= 0 && (staticPressurePass !== false),
  };
}

function normalizeCandidateDiameters(candidateDiameters) {
  if (Array.isArray(candidateDiameters)) {
    return [...new Set(candidateDiameters.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b);
  }

  if (typeof candidateDiameters === 'string') {
    return normalizeCandidateDiameters(
      candidateDiameters
        .split(/[\s,、]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }

  return [...CONSTANTS.defaultCandidateDiametersMm];
}

export function calcSizing({
  flowLpm,
  candidateDiameters = CONSTANTS.defaultCandidateDiametersMm,
  lengthM,
  dynamicPressureMpa,
  elevationM,
  terminalRequiredHeadM,
  meterLossM = 0,
  localLossM = 0,
  cValue = CONSTANTS.defaultC,
}) {
  const diameters = normalizeCandidateDiameters(candidateDiameters);
  if (diameters.length === 0) {
    throw new Error('候補口径を 1 つ以上入力してください。');
  }

  const rows = diameters.map((diameterMm) => {
    try {
      const friction = calcFriction({ flowLpm, diameterMm, lengthM, formulaMode: 'auto', cValue });
      const head = calcHeadCheck({
        dynamicPressureMpa,
        elevationM,
        terminalRequiredHeadM,
        meterLossM,
        localLossM,
        frictionLossM: friction.headLossM,
      });
      return {
        diameterMm,
        formula: friction.formula,
        velocityMps: friction.velocityMps,
        frictionLossM: friction.headLossM,
        totalRequiredHeadM: head.totalRequiredHeadM,
        headMarginM: head.headMarginM,
        pass: head.serviceable,
        note:
          friction.velocityMps > CONSTANTS.velocityReference
            ? '流速参考値超過'
            : '適正域',
      };
    } catch (error) {
      return {
        diameterMm,
        formula: '-',
        velocityMps: NaN,
        frictionLossM: NaN,
        totalRequiredHeadM: NaN,
        headMarginM: NaN,
        pass: false,
        note: error.message,
      };
    }
  });

  const recommended = rows.find((row) => row.pass) ?? null;
  return {
    rows,
    recommended,
  };
}
