import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calcDemandByHouseholds,
  calcDemandByResidents,
  calcUsageRatioByFixtureCount,
  calcStandardizedDemandFromCounts,
  calcFriction,
  calcHeadCheck,
  calcSizing,
} from '../calc.js';

test('household demand formula switches at 10 units', () => {
  const underTen = calcDemandByHouseholds(9);
  const ten = calcDemandByHouseholds(10);
  assert.equal(underTen.formula, 'Q = 42N^0.33');
  assert.equal(ten.formula, 'Q = 19N^0.67');
  assert.ok(underTen.demandLpm > 0);
  assert.ok(ten.demandLpm > 0);
});

test('resident demand formula switches at 31 people', () => {
  const thirty = calcDemandByResidents(30);
  const thirtyOne = calcDemandByResidents(31);
  assert.equal(thirty.formula, 'Q = 26P^0.36');
  assert.equal(thirtyOne.formula, 'Q = 13P^0.56');
});

test('usage ratio interpolates between table values', () => {
  const ratio12 = calcUsageRatioByFixtureCount(12);
  assert.equal(ratio12, 3.2);
});

test('standardized demand from 13/20/25mm counts works', () => {
  const result = calcStandardizedDemandFromCounts({ fixture13: 4, fixture20: 1, fixture25: 0 });
  assert.equal(result.totalFixtureCount, 5);
  assert.equal(result.totalFixtureFlowLpm, 108);
  assert.equal(result.usageRatio, 2.2);
  assert.equal(result.demandLpm, (108 / 5) * 2.2);
});

test('friction auto-selects Weston for 25mm', () => {
  const result = calcFriction({ flowLpm: 60, diameterMm: 25, lengthM: 25, formulaMode: 'auto', cValue: 110 });
  assert.equal(result.formula, 'Weston');
  assert.ok(result.headLossM > 0);
  assert.ok(result.velocityMps > 0);
});

test('head check returns serviceable when pressure and margin are sufficient', () => {
  const result = calcHeadCheck({
    dynamicPressureMpa: 0.2,
    staticPressureMpa: 0.3,
    elevationM: 7,
    terminalRequiredHeadM: 5,
    meterLossM: 0,
    localLossM: 0,
    frictionLossM: 2,
  });
  assert.equal(result.dynamicPressurePass, true);
  assert.equal(result.staticPressurePass, true);
  assert.equal(result.serviceable, true);
});

test('sizing returns a recommended diameter for simple conditions', () => {
  const result = calcSizing({
    flowLpm: 60,
    candidateDiameters: [13, 20, 25, 30, 40, 50],
    lengthM: 25,
    dynamicPressureMpa: 0.2,
    elevationM: 7,
    terminalRequiredHeadM: 5,
    meterLossM: 0,
    localLossM: 0,
    cValue: 110,
  });
  assert.ok(result.rows.length > 0);
  assert.ok(result.recommended);
});
