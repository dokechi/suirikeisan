import {
  CONSTANTS,
  calcDemandByHouseholds,
  calcDemandByResidents,
  calcFriction,
  calcHeadCheck,
  calcSizing,
  calcStandardizedDemandFromCounts,
  calcStandardizedDemandFromManual,
  lpmToM3s,
  round,
} from './calc.js';

const state = {
  latestDemandLpm: null,
  latestFrictionLossM: null,
};

const demandForm = document.querySelector('#demand-form');
const frictionForm = document.querySelector('#friction-form');
const headForm = document.querySelector('#head-form');
const sizingForm = document.querySelector('#sizing-form');

const demandResult = document.querySelector('#demand-result');
const frictionResult = document.querySelector('#friction-result');
const headResult = document.querySelector('#head-result');
const sizingResult = document.querySelector('#sizing-result');

function setHtml(target, html) {
  target.innerHTML = html;
}

function safeNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatNumber(value, digits = 3) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return round(value, digits).toLocaleString('ja-JP', {
    maximumFractionDigits: digits,
  });
}

function statusBadge(label, tone = 'success') {
  return `<span class="badge ${tone}">${label}</span>`;
}

function resultShell(title, subtitle, content) {
  return `
    <div class="result-stack">
      <div class="summary">
        <h3>${title}</h3>
        <p>${subtitle}</p>
      </div>
      ${content}
    </div>
  `;
}

function renderError(target, message) {
  setHtml(
    target,
    resultShell('入力を確認してください', 'このセクションの計算を完了できませんでした。', `<div class="badge-row">${statusBadge(message, 'danger')}</div>`),
  );
}

function updateModePanels() {
  const selectedMode = demandForm.elements.demandMode.value;
  document.querySelectorAll('[data-mode-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.modePanel !== selectedMode);
  });
}

function renderDemandResult(result, detailHtml = '') {
  const demandM3s = lpmToM3s(result.demandLpm);
  const content = `
    <div class="metric-grid">
      <div class="metric-card">
        <span class="metric-label">同時使用水量</span>
        <span class="metric-value">${formatNumber(result.demandLpm, 3)} L/min</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">換算流量</span>
        <span class="metric-value">${formatNumber(demandM3s, 5)} m³/s</span>
      </div>
    </div>
    <div class="meta-list">
      <div class="meta-item"><span>式</span><strong class="mono">${result.formula}</strong></div>
      ${result.range ? `<div class="meta-item"><span>適用レンジ</span><strong>${result.range}</strong></div>` : ''}
      ${detailHtml}
    </div>
  `;

  setHtml(
    demandResult,
    resultShell('同時使用水量を計算しました', '次はこの値を摩擦損失または口径概算に流し込んでください。', content),
  );
}

function handleDemandSubmit(event) {
  event.preventDefault();
  try {
    const mode = demandForm.elements.demandMode.value;
    let result;
    let detailHtml = '';

    if (mode === 'households') {
      result = calcDemandByHouseholds(demandForm.elements.households.value);
    } else if (mode === 'residents') {
      result = calcDemandByResidents(demandForm.elements.residents.value);
    } else if (mode === 'standardized') {
      const manualTotal = safeNumber(demandForm.elements.manualTotalFixtureFlow.value);
      const manualCount = safeNumber(demandForm.elements.manualFixtureCount.value);
      if (manualTotal !== null && manualCount !== null && manualTotal > 0 && manualCount > 0) {
        result = calcStandardizedDemandFromManual(manualTotal, manualCount);
      } else {
        result = calcStandardizedDemandFromCounts({
          fixture13: demandForm.elements.fixture13.value,
          fixture20: demandForm.elements.fixture20.value,
          fixture25: demandForm.elements.fixture25.value,
        });
      }
      detailHtml = `
        <div class="meta-item"><span>全使用水量</span><strong>${formatNumber(result.totalFixtureFlowLpm, 3)} L/min</strong></div>
        <div class="meta-item"><span>総給水用具数</span><strong>${formatNumber(result.totalFixtureCount, 0)}</strong></div>
        <div class="meta-item"><span>使用水量比</span><strong>${formatNumber(result.usageRatio, 3)}</strong></div>
      `;
    } else {
      result = {
        demandLpm: Number(demandForm.elements.manualDemand.value),
        formula: '手入力',
        range: null,
      };
      if (!(result.demandLpm > 0)) {
        throw new Error('手入力の同時使用水量は 0 より大きい値にしてください。');
      }
    }

    state.latestDemandLpm = result.demandLpm;
    renderDemandResult(result, detailHtml);
  } catch (error) {
    renderError(demandResult, error.message);
  }
}

function renderFrictionResult(result) {
  const velocityTone = result.velocityMps > CONSTANTS.velocityReference ? 'warning' : 'success';
  const content = `
    <div class="metric-grid">
      <div class="metric-card">
        <span class="metric-label">摩擦損失水頭</span>
        <span class="metric-value">${formatNumber(result.headLossM, 4)} m</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">流速</span>
        <span class="metric-value">${formatNumber(result.velocityMps, 3)} m/s</span>
      </div>
    </div>
    <div class="badge-row">
      ${statusBadge(`採用式: ${result.formula}`, 'success')}
      ${statusBadge(
        result.velocityMps > CONSTANTS.velocityReference
          ? `参考流速 ${CONSTANTS.velocityReference.toFixed(1)} m/s を超過`
          : `参考流速 ${CONSTANTS.velocityReference.toFixed(1)} m/s 以下`,
        velocityTone,
      )}
    </div>
    <div class="meta-list">
      <div class="meta-item"><span>100m当たり損失</span><strong>${formatNumber(result.headLossPer100M, 4)} m/100m</strong></div>
      <div class="meta-item"><span>流量</span><strong>${formatNumber(result.flowLpm, 3)} L/min</strong></div>
      <div class="meta-item"><span>口径</span><strong>${formatNumber(result.diameterMm, 2)} mm</strong></div>
      <div class="meta-item"><span>延長</span><strong>${formatNumber(result.lengthM, 2)} m</strong></div>
      ${result.cValue ? `<div class="meta-item"><span>C値</span><strong>${formatNumber(result.cValue, 2)}</strong></div>` : ''}
    </div>
  `;

  setHtml(
    frictionResult,
    resultShell('摩擦損失を計算しました', '必要ならこの損失水頭をそのまま所要水頭判定へ反映できます。', content),
  );
}

function handleFrictionSubmit(event) {
  event.preventDefault();
  try {
    const result = calcFriction({
      flowLpm: frictionForm.elements.flowLpm.value,
      diameterMm: frictionForm.elements.diameterMm.value,
      lengthM: frictionForm.elements.lengthM.value,
      formulaMode: frictionForm.elements.formulaMode.value,
      cValue: frictionForm.elements.cValue.value,
    });
    state.latestFrictionLossM = result.headLossM;
    renderFrictionResult(result);
  } catch (error) {
    renderError(frictionResult, error.message);
  }
}

function renderHeadResult(result) {
  const content = `
    <div class="metric-grid">
      <div class="metric-card">
        <span class="metric-label">利用可能水頭</span>
        <span class="metric-value">${formatNumber(result.availableHeadM, 3)} m</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">余裕水頭</span>
        <span class="metric-value">${formatNumber(result.headMarginM, 3)} m</span>
      </div>
    </div>
    <div class="badge-row">
      ${statusBadge(result.dynamicPressurePass ? '最小動水圧 0.15 MPa 以上' : '最小動水圧 0.15 MPa 未満', result.dynamicPressurePass ? 'success' : 'danger')}
      ${result.staticPressureMpa === null ? statusBadge('最大静水圧チェック未入力', 'warning') : statusBadge(result.staticPressurePass ? '最大静水圧 0.74 MPa 以下' : '最大静水圧 0.74 MPa 超過', result.staticPressurePass ? 'success' : 'danger')}
      ${statusBadge(result.serviceable ? '概算上は成立' : '概算上は再検討', result.serviceable ? 'success' : 'danger')}
    </div>
    <div class="meta-list">
      <div class="meta-item"><span>必要水頭の合計</span><strong>${formatNumber(result.totalRequiredHeadM, 3)} m</strong></div>
      <div class="meta-item"><span>高低差</span><strong>${formatNumber(result.elevationM, 3)} m</strong></div>
      <div class="meta-item"><span>器具必要水頭</span><strong>${formatNumber(result.terminalRequiredHeadM, 3)} m</strong></div>
      <div class="meta-item"><span>メータ損失</span><strong>${formatNumber(result.meterLossM, 3)} m</strong></div>
      <div class="meta-item"><span>局部損失</span><strong>${formatNumber(result.localLossM, 3)} m</strong></div>
      <div class="meta-item"><span>摩擦損失</span><strong>${formatNumber(result.frictionLossM, 3)} m</strong></div>
      <div class="meta-item"><span>動水圧</span><strong>${formatNumber(result.dynamicPressureMpa, 3)} MPa</strong></div>
      ${result.staticPressureMpa !== null ? `<div class="meta-item"><span>静水圧</span><strong>${formatNumber(result.staticPressureMpa, 3)} MPa</strong></div>` : ''}
    </div>
  `;

  setHtml(
    headResult,
    resultShell('所要水頭・圧力を判定しました', '余裕水頭がマイナスなら、口径・圧力条件・損失条件の見直しが必要です。', content),
  );
}

function handleHeadSubmit(event) {
  event.preventDefault();
  try {
    const result = calcHeadCheck({
      dynamicPressureMpa: headForm.elements.dynamicPressureMpa.value,
      staticPressureMpa: headForm.elements.staticPressureMpa.value,
      elevationM: headForm.elements.elevationM.value,
      terminalRequiredHeadM: headForm.elements.terminalRequiredHeadM.value,
      meterLossM: headForm.elements.meterLossM.value,
      localLossM: headForm.elements.localLossM.value,
      frictionLossM: headForm.elements.frictionLossM.value,
    });
    renderHeadResult(result);
  } catch (error) {
    renderError(headResult, error.message);
  }
}

function renderSizingResult(result) {
  const recommendation = result.recommended
    ? `<div class="summary"><h3>推奨口径: ${formatNumber(result.recommended.diameterMm, 0)} mm</h3><p>最小適合径として概算上成立しました。</p></div>`
    : `<div class="summary"><h3>推奨口径なし</h3><p>候補の中に成立する口径がありませんでした。条件を見直してください。</p></div>`;

  const rowsHtml = result.rows
    .map((row) => {
      const tone = row.pass ? 'success' : 'danger';
      return `
        <tr>
          <td class="center">${formatNumber(row.diameterMm, 0)}</td>
          <td>${row.formula}</td>
          <td class="center">${formatNumber(row.velocityMps, 3)}</td>
          <td class="center">${formatNumber(row.frictionLossM, 3)}</td>
          <td class="center">${formatNumber(row.totalRequiredHeadM, 3)}</td>
          <td class="center">${formatNumber(row.headMarginM, 3)}</td>
          <td class="center">${statusBadge(row.pass ? '適合' : '再検討', tone)}</td>
          <td>${row.note}</td>
        </tr>
      `;
    })
    .join('');

  const content = `
    ${recommendation}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="center">口径</th>
            <th>採用式</th>
            <th class="center">流速 (m/s)</th>
            <th class="center">摩擦損失 (m)</th>
            <th class="center">総所要水頭 (m)</th>
            <th class="center">余裕水頭 (m)</th>
            <th class="center">判定</th>
            <th>備考</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;

  setHtml(
    sizingResult,
    resultShell('候補口径を比較しました', '最小適合径だけでなく、流速や余裕水頭の余白も見て判断してください。', content),
  );
}

function handleSizingSubmit(event) {
  event.preventDefault();
  try {
    const result = calcSizing({
      flowLpm: sizingForm.elements.sizingFlowLpm.value,
      candidateDiameters: sizingForm.elements.candidateDiameters.value,
      lengthM: sizingForm.elements.sizingLengthM.value,
      dynamicPressureMpa: sizingForm.elements.sizingDynamicPressureMpa.value,
      elevationM: sizingForm.elements.sizingElevationM.value,
      terminalRequiredHeadM: sizingForm.elements.sizingTerminalRequiredHeadM.value,
      meterLossM: sizingForm.elements.sizingMeterLossM.value,
      localLossM: sizingForm.elements.sizingLocalLossM.value,
      cValue: sizingForm.elements.sizingCValue.value,
    });
    renderSizingResult(result);
  } catch (error) {
    renderError(sizingResult, error.message);
  }
}

function wireCopyButtons() {
  document.querySelector('#copy-demand-to-hydraulics').addEventListener('click', () => {
    if (!(state.latestDemandLpm > 0)) {
      renderError(demandResult, '先に同時使用水量を計算してください。');
      return;
    }
    frictionForm.elements.flowLpm.value = round(state.latestDemandLpm, 3);
    sizingForm.elements.sizingFlowLpm.value = round(state.latestDemandLpm, 3);
    setHtml(
      demandResult,
      resultShell('流量を反映しました', '同時使用水量を 2. 摩擦損失 と 4. 口径概算 に流し込みました。', `<div class="badge-row">${statusBadge('反映済み', 'success')}</div>`),
    );
  });

  document.querySelector('#copy-friction-to-head').addEventListener('click', () => {
    if (!(state.latestFrictionLossM >= 0)) {
      renderError(frictionResult, '先に摩擦損失を計算してください。');
      return;
    }
    headForm.elements.frictionLossM.value = round(state.latestFrictionLossM, 4);
    setHtml(
      frictionResult,
      resultShell('損失水頭を反映しました', '摩擦損失を 3. 所要水頭・圧力判定 に流し込みました。', `<div class="badge-row">${statusBadge('反映済み', 'success')}</div>`),
    );
  });
}

function init() {
  updateModePanels();
  demandForm.elements.demandMode.addEventListener('change', updateModePanels);
  demandForm.addEventListener('submit', handleDemandSubmit);
  frictionForm.addEventListener('submit', handleFrictionSubmit);
  headForm.addEventListener('submit', handleHeadSubmit);
  sizingForm.addEventListener('submit', handleSizingSubmit);
  wireCopyButtons();
}

init();
