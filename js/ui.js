/**
 * ui.js — DOM interactions and rendering.
 * All business logic lives in logic.js. No analysis here.
 */

// ── Element refs ───────────────────────────────────────────────────────────────

const inp = {
  trials:          document.getElementById('trials'),
  conversionRate:  document.getElementById('conversionRate'),
  dealSize:        document.getElementById('dealSize'),
  activationRate:  document.getElementById('activationRate'),
  salesAssistedPct: document.getElementById('salesAssistedPct'),
};

const out = {
  emptyState:    document.getElementById('empty-state'),
  results:       document.getElementById('results'),

  // Funnel snapshot
  fTrials:       document.getElementById('f-trials'),
  fPaid:         document.getElementById('f-paid'),
  fMrr:          document.getElementById('f-mrr'),
  fConvBadge:    document.getElementById('f-conv-badge'),
  fConvBand:     document.getElementById('f-conv-band'),

  // Diagnosis
  diagBadge:     document.getElementById('diag-badge'),
  diagBody:      document.getElementById('diag-body'),
  confBadge:     document.getElementById('conf-badge'),
  confReason:    document.getElementById('conf-reason'),
  salesFlag:     document.getElementById('sales-flag'),
  salesFlagBody: document.getElementById('sales-flag-body'),

  // Recommendation
  recBody:       document.getElementById('rec-body'),

  // Actions
  actionList:    document.getElementById('action-list'),

  // Missed revenue
  r5Mrr:         document.getElementById('r5-mrr'),
  r5Cust:        document.getElementById('r5-cust'),
  r10Mrr:        document.getElementById('r10-mrr'),
  r10Cust:       document.getElementById('r10-cust'),

  // Copy
  btnCopy:       document.getElementById('btn-copy'),
  copyConfirm:   document.getElementById('copy-confirm'),
};

// ── Wiring ─────────────────────────────────────────────────────────────────────

Object.values(inp).forEach((el) => el.addEventListener('input', update));

out.btnCopy.addEventListener('click', async () => {
  const inputs = readInputs();
  if (!inputs) return;
  const metrics   = computeMetrics(inputs);
  const diagnosis = diagnose(inputs);
  const text      = buildSummary(inputs, metrics, diagnosis);
  try {
    await navigator.clipboard.writeText(text);
    out.copyConfirm.hidden = false;
    setTimeout(() => { out.copyConfirm.hidden = true; }, 2200);
  } catch {
    // Fallback for non-HTTPS contexts
    out.copyConfirm.textContent = 'Copy failed — try HTTPS';
    out.copyConfirm.hidden = false;
    setTimeout(() => { out.copyConfirm.hidden = true; }, 3000);
  }
});

// ── Core update ────────────────────────────────────────────────────────────────

function update() {
  const inputs = readInputs();
  if (!inputs) { showEmpty(); return; }

  const metrics   = computeMetrics(inputs);
  const diagnosis = diagnose(inputs);
  const missed    = computeMissedRevenue(inputs);

  renderSnapshot(inputs, metrics);
  renderDiagnosis(inputs, metrics, diagnosis);
  renderRecommendation(inputs, metrics, diagnosis);
  renderActions(inputs, metrics, diagnosis);
  renderMissedRevenue(missed);
  showResults();
}

// ── Read & validate inputs ─────────────────────────────────────────────────────

function readInputs() {
  const trials         = num(inp.trials.value);
  const conversionRate = num(inp.conversionRate.value);
  const dealSize       = num(inp.dealSize.value);

  if (trials === null || conversionRate === null || dealSize === null) return null;
  if (trials < 0 || conversionRate < 0 || conversionRate > 100 || dealSize < 0) return null;

  const activationRate   = num(inp.activationRate.value);
  const salesAssistedPct = num(inp.salesAssistedPct.value);

  return {
    trials,
    conversionRate,
    dealSize,
    activationRate:   activationRate   !== null && activationRate   >= 0 && activationRate   <= 100 ? activationRate   : null,
    salesAssistedPct: salesAssistedPct !== null && salesAssistedPct >= 0 && salesAssistedPct <= 100 ? salesAssistedPct : null,
  };
}

// ── Renderers ──────────────────────────────────────────────────────────────────

function renderSnapshot(inputs, { paidUsers, mrr, conversionBand }) {
  out.fTrials.textContent      = fmt.int(inputs.trials);
  out.fPaid.textContent        = fmt.int(paidUsers);
  out.fMrr.textContent         = fmt.usd(mrr);
  out.fConvBadge.textContent   = `${inputs.conversionRate}%`;
  out.fConvBadge.dataset.band  = conversionBand;
  out.fConvBand.textContent    = cap(conversionBand);
  out.fConvBand.dataset.band   = conversionBand;
}

function renderDiagnosis(inputs, metrics, { primary, hasSalesFlag, confidence }) {
  out.diagBadge.textContent   = primary.label;
  out.diagBadge.dataset.color = primary.color;
  out.diagBody.textContent    = primary.getText(inputs, metrics);

  if (confidence) {
    out.confBadge.textContent        = cap(confidence.level) + ' Confidence';
    out.confBadge.dataset.level      = confidence.level;
    out.confBadge.hidden             = false;
    out.confReason.textContent       = confidence.reason;
    out.confReason.hidden            = false;
  } else {
    out.confBadge.hidden  = true;
    out.confReason.hidden = true;
  }

  if (hasSalesFlag) {
    out.salesFlagBody.textContent = SALES_FLAG.getText(inputs.salesAssistedPct, inputs.dealSize);
    out.salesFlag.hidden = false;
  } else {
    out.salesFlag.hidden = true;
  }
}

function renderRecommendation(inputs, metrics, { primary }) {
  out.recBody.textContent = primary.getRecommendation(inputs, metrics);
}

function renderActions(inputs, metrics, { primary }) {
  out.actionList.innerHTML = '';
  primary.getActions(inputs, metrics).forEach((action, i) => {
    const li = document.createElement('li');
    li.className = 'action-item';
    li.innerHTML = `
      <div class="action-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="action-copy">
        <p class="action-title">${esc(action.title)}</p>
        <p class="action-body">${esc(action.body)}</p>
      </div>
    `;
    out.actionList.appendChild(li);
  });
}

function renderMissedRevenue({ plus5, plus10 }) {
  out.r5Mrr.textContent   = `+${fmt.usd(plus5.mrr)}/mo`;
  out.r5Cust.textContent  = `+${plus5.customers} customers/mo`;
  out.r10Mrr.textContent  = `+${fmt.usd(plus10.mrr)}/mo`;
  out.r10Cust.textContent = `+${plus10.customers} customers/mo`;
}

// ── Visibility ─────────────────────────────────────────────────────────────────

function showResults() {
  out.emptyState.hidden = true;
  out.results.hidden = false;
}

function showEmpty() {
  out.emptyState.hidden = false;
  out.results.hidden = true;
}

// ── Utility ────────────────────────────────────────────────────────────────────

const fmt = {
  int: (n) => Math.round(n).toLocaleString('en-US'),
  usd: (n) => '$' + Math.round(n).toLocaleString('en-US'),
};

function num(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
