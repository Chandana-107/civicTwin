const axios = require('axios');
const { FraudReport } = require('./fraudReport');

// ── Configurable thresholds — override via environment variables ──────────────
const THRESHOLDS = {
  REPEAT_WINNER_COUNT:    Number(process.env.REPEAT_WINNER_THRESHOLD      || 5),
  VALUE_SHARE:            Number(process.env.VALUE_SHARE_THRESHOLD         || 0.30), // 30% of total contract value
  COUNT_SHARE:            Number(process.env.COUNT_SHARE_THRESHOLD         || 0.30), // 30% of total count
  TENDER_SPLIT_VALUE:     Number(process.env.TENDER_SPLIT_THRESHOLD        || 1000000),
  TENDER_SPLIT_WINDOW:    Number(process.env.TENDER_SPLIT_WINDOW_DAYS      || 30),   // rolling-day window
  NEAR_THRESHOLD_PCT:     Number(process.env.NEAR_THRESHOLD_PCT            || 0.85), // flag award >= 85% of limit
  OVERRUN_MULTIPLIER:     Number(process.env.OVERRUN_THRESHOLD_MULTIPLIER  || 1.25), // unified 1.25× overrun
  LOOKBACK_DAYS:          Number(process.env.FRAUD_LOOKBACK_DAYS           || 365),
  NAME_SIM_THRESHOLD:     Number(process.env.NAME_SIM_THRESHOLD            || 0.92),
  ADDRESS_CLUSTER_MIN:    Number(process.env.ADDRESS_CLUSTER_MIN           || 3),    // 3+ IDs same address
  REGION_SPIKE_FACTOR:    Number(process.env.REGION_SPIKE_FACTOR           || 2.5),  // 2.5× rolling avg
  REGION_BASELINE_MONTHS: Number(process.env.REGION_BASELINE_MONTHS        || 6),
};

const RISK_WEIGHTS = {
  repeatWinner: 25,
  bidCollusion: 20,
  costAnomaly: 20,
  tenderSplitting: 15,
  network: 20
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function riskLevel(score) {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

function normalizeText(v) {
  return String(v || '').trim().toLowerCase();
}

// Normalize phone to bare 10-digit Indian format before dedup comparisons
function normalizePhone(p) {
  const digits = String(p || '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
}

// Validate a tender row has minimum required fields before analysis
function isValidTender(t) {
  return t.contractor && number(t.amount) > 0 && !isNaN(new Date(t.date).getTime());
}

function levenshtein(a, b) {
  const s = normalizeText(a);
  const t = normalizeText(b);
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const dp = Array.from({ length: s.length + 1 }, () => Array(t.length + 1).fill(0));
  for (let i = 0; i <= s.length; i++) dp[i][0] = i;
  for (let j = 0; j <= t.length; j++) dp[0][j] = j;
  for (let i = 1; i <= s.length; i++) {
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[s.length][t.length];
}

function similarity(a, b) {
  const maxLen = Math.max(String(a || '').length, String(b || '').length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function buildFindingKey(type, entityType, entityId) {
  return `${type}:${entityType}:${entityId}`;
}

function resolveFraudServiceBaseUrl() {
  return process.env.FRAUD_SERVICE_URL || process.env.SIMULATION_SERVICE_URL || process.env.ML_SERVICE_URL || null;
}

async function callMlService(path, payload) {
  const baseUrl = resolveFraudServiceBaseUrl();
  if (!baseUrl) return null;
  try {
    const res = await axios.post(`${baseUrl}${path}`, payload, { timeout: 20000 });
    return res.data;
  } catch (err) {
    console.error(`[FraudPipeline] external service ${path} failed at ${baseUrl}:`, err.message);
    return null;
  }
}

function parseMeta(meta) {
  if (!meta) return {};
  if (typeof meta === 'object') return meta;
  try { return JSON.parse(meta); } catch { return {}; }
}

function number(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function dedupeNodes(nodes) {
  const map = new Map();
  for (const n of nodes) {
    if (!map.has(n.id)) map.set(n.id, n);
  }
  return Array.from(map.values());
}

function dedupeEdges(edges) {
  const map = new Map();
  for (const e of edges) {
    const k = `${e.source}|${e.target}|${e.type}`;
    if (!map.has(k)) map.set(k, e);
  }
  return Array.from(map.values());
}

// Regional disbursement spike: flag departments where one month exceeds REGION_SPIKE_FACTOR x rolling avg
function detectRegionalSpikes(tenders, findings) {
  const byDeptMonth = new Map();
  for (const t of tenders) {
    const dept = normalizeText(t.department || 'unknown');
    const d = new Date(t.date);
    const key = `${dept}|${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byDeptMonth.has(key)) byDeptMonth.set(key, 0);
    byDeptMonth.set(key, byDeptMonth.get(key) + number(t.amount));
  }
  const deptMonthMap = new Map();
  for (const [key, total] of byDeptMonth.entries()) {
    const [dept, month] = key.split('|');
    if (!deptMonthMap.has(dept)) deptMonthMap.set(dept, []);
    deptMonthMap.get(dept).push({ month, total });
  }
  for (const [dept, months] of deptMonthMap.entries()) {
    months.sort((a, b) => a.month.localeCompare(b.month));
    for (let i = THRESHOLDS.REGION_BASELINE_MONTHS; i < months.length; i++) {
      const baseline = months.slice(i - THRESHOLDS.REGION_BASELINE_MONTHS, i);
      const avg = baseline.reduce((s, m) => s + m.total, 0) / baseline.length;
      const current = months[i];
      if (avg > 0 && current.total > avg * THRESHOLDS.REGION_SPIKE_FACTOR) {
        findings.push({
          finding_key: buildFindingKey('regional_spike', 'department', `${dept}|${current.month}`),
          entity_type: 'department',
          entity_id: dept,
          finding_type: 'regional_spike',
          severity: 'High',
          risk_score: 70,
          anomaly_score: null,
          graph_score: null,
          title: `Disbursement spike: ${dept} — ${current.month}`,
          explanation: `Disbursement ₹${Math.round(current.total).toLocaleString()} is ${(current.total / avg).toFixed(1)}× the ${THRESHOLDS.REGION_BASELINE_MONTHS}-month average (₹${Math.round(avg).toLocaleString()})`,
          evidence: { department: dept, month: current.month, amount: current.total, baseline_avg: Math.round(avg), spike_factor: +(current.total / avg).toFixed(2) },
          related_tender_ids: [],
          related_cluster_ids: [],
        });
      }
    }
  }
}

async function runFraudPipeline(pool) {
  const runId = (await pool.query("INSERT INTO fraud_audit_runs (status, started_at) VALUES ('running', now()) RETURNING id")).rows[0].id;
  const findings = [];
  const welfareFindings = [];
  const contractorRisk = new Map();

  try {
    // Fetch only within lookback window to avoid stale data inflating scores
    const tendersRes = await pool.query(
      `SELECT * FROM tenders WHERE date >= NOW() - INTERVAL '${THRESHOLDS.LOOKBACK_DAYS} days'`
    );
    const rawTenders = tendersRes.rows.map((t) => ({ ...t, meta: parseMeta(t.meta) }));

    // Validate: drop rows missing contractor, positive amount, or valid date
    const tenders = rawTenders.filter(isValidTender);
    const droppedCount = rawTenders.length - tenders.length;
    if (droppedCount > 0) console.warn(`[FraudPipeline] run=${runId} dropped ${droppedCount} invalid tender rows`);

    const totalTenders = tenders.length;
    const totalContractValue = tenders.reduce((s, t) => s + number(t.amount), 0);

    if (!totalTenders) {
      // Build an empty report so unified_report is always present in summary
      const emptyReport = new FraudReport([], { run_id: runId, tenders_analysed: 0, dropped_count: droppedCount, ml_graph_used: false, ml_anomaly_used: false });
      const emptySummary = { flags_detected: 0, high_risk_cases: 0, suspicious_contractors: [], ghost_beneficiaries: [], collusion_clusters: [], evidence: [], evidence_truncated: false, external_services: { graph_invoked: false, anomaly_invoked: false }, unified_report: emptyReport.toJSON() };
      await pool.query("UPDATE fraud_audit_runs SET status='completed', completed_at=now(), summary=$2 WHERE id=$1", [runId, JSON.stringify(emptySummary)]);
      return { run_id: runId, ...emptySummary };
    }

    const byContractor = new Map();
    for (const t of tenders) {
      // Use contractor_id if present; fall back to normalised name to prevent case/whitespace duplicates
      const key = t.contractor_id || normalizeText(t.contractor);
      if (!key) continue;
      if (!byContractor.has(key)) byContractor.set(key, []);
      byContractor.get(key).push(t);
    }

    for (const [contractorId, rows] of byContractor.entries()) {
      const wins = rows.length;
      const winRate = wins / totalTenders;
      // Value-based share: fraction of total procurement value won by this contractor
      const contractorValue = rows.reduce((s, r) => s + number(r.amount), 0);
      const valueShare = totalContractValue > 0 ? contractorValue / totalContractValue : 0;
      const scoreParts = { repeatWinner: 0, bidCollusion: 0, costAnomaly: 0, tenderSplitting: 0, network: 0 };
      const evidence = [];

      // Repeat-winner: flag on count share OR value share (whichever is higher)
      if (wins >= THRESHOLDS.REPEAT_WINNER_COUNT || winRate >= THRESHOLDS.COUNT_SHARE || valueShare >= THRESHOLDS.VALUE_SHARE) {
        scoreParts.repeatWinner = clamp(Math.max(winRate, valueShare) * RISK_WEIGHTS.repeatWinner, 0, RISK_WEIGHTS.repeatWinner);
        evidence.push(`${rows[0].contractor} won ${(winRate * 100).toFixed(1)}% of contracts (${wins}/${totalTenders}), ${(valueShare * 100).toFixed(1)}% of total value`);
      }

      // Single-bidder detection; also flag unknown bidder_count as possible sole-source
      const singleBidCount = rows.filter((r) => number(r.meta.bidder_count, -1) === 1).length;
      const unknownBidCount = rows.filter((r) => r.meta.bidder_count == null).length;
      if (singleBidCount > 0) {
        scoreParts.bidCollusion += clamp((singleBidCount / wins) * RISK_WEIGHTS.bidCollusion, 0, RISK_WEIGHTS.bidCollusion);
        evidence.push(`${singleBidCount} single-bidder tenders linked to contractor`);
      }
      if (unknownBidCount > 0) {
        // Penalise unknown bid counts as possible unreported sole-source
        scoreParts.bidCollusion += clamp((unknownBidCount / wins) * 5, 0, 10);
        evidence.push(`${unknownBidCount} tenders with unknown bidder count (possible sole-source)`);
      }

      // Cost overrun using unified OVERRUN_MULTIPLIER (was hardcoded 1.25 vs 1.2 inconsistency)
      const overruns = rows.filter((r) => number(r.meta.execution_cost) > number(r.amount) * THRESHOLDS.OVERRUN_MULTIPLIER);
      if (overruns.length) {
        scoreParts.costAnomaly += clamp((overruns.length / wins) * RISK_WEIGHTS.costAnomaly, 0, RISK_WEIGHTS.costAnomaly);
        evidence.push(`${overruns.length} tenders exceeded ${Math.round((THRESHOLDS.OVERRUN_MULTIPLIER - 1) * 100)}% cost overrun`);
      }

      // Tender splitting: 30-day rolling window (was calendar-month — too coarse for intra-week splits)
      const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));
      let splitDetected = false;
      for (let i = 0; i < sorted.length && !splitDetected; i++) {
        const anchor = new Date(sorted[i].date);
        const windowEnd = new Date(anchor.getTime() + THRESHOLDS.TENDER_SPLIT_WINDOW * 86400000);
        const dept = normalizeText(sorted[i].department);
        const windowRows = sorted.filter((r) => {
          const d = new Date(r.date);
          return d >= anchor && d <= windowEnd && normalizeText(r.department) === dept;
        });
        const below = windowRows.filter((r) => number(r.amount) < THRESHOLDS.TENDER_SPLIT_VALUE);
        const sum = below.reduce((s, r) => s + number(r.amount), 0);
        if (below.length >= 2 && sum > THRESHOLDS.TENDER_SPLIT_VALUE) {
          scoreParts.tenderSplitting = RISK_WEIGHTS.tenderSplitting;
          evidence.push(`Bid splitting: ${below.length} contracts in ${THRESHOLDS.TENDER_SPLIT_WINDOW}-day window totalling ₹${Math.round(sum).toLocaleString()} (threshold ₹${THRESHOLDS.TENDER_SPLIT_VALUE.toLocaleString()})`);
          splitDetected = true;
        }
        // Near-threshold single award: individual contract at 85-99% of approval limit
        for (const r of windowRows) {
          const pct = number(r.amount) / THRESHOLDS.TENDER_SPLIT_VALUE;
          if (pct >= THRESHOLDS.NEAR_THRESHOLD_PCT && pct < 1.0) {
            scoreParts.tenderSplitting = Math.max(scoreParts.tenderSplitting, Math.round(RISK_WEIGHTS.tenderSplitting * 0.7));
            evidence.push(`Near-threshold award: ₹${Math.round(number(r.amount)).toLocaleString()} (${(pct * 100).toFixed(1)}% of approval limit)`);
          }
        }
      }

      const riskScore = Math.round(Object.values(scoreParts).reduce((a, b) => a + b, 0));
      // Data confidence indicator: low for small samples — scores less reliable
      const dataConfidence = wins < 5 ? 'low' : wins < 20 ? 'medium' : 'high';
      const row0 = rows[0];
      contractorRisk.set(contractorId, { contractor_id: contractorId, contractor: row0.contractor, risk_score: riskScore, risk_level: riskLevel(riskScore), evidence, score_parts: scoreParts, value_share: valueShare, data_confidence: dataConfidence });
      // Only create a finding when there is an actual risk signal to avoid audit log noise
      if (riskScore > 0 || evidence.length > 0) {
        findings.push({
          finding_key: buildFindingKey('contractor_risk', 'contractor', contractorId),
          entity_type: 'contractor',
          entity_id: contractorId,
          finding_type: 'contractor_risk',
          severity: riskLevel(riskScore),
          risk_score: riskScore,
          anomaly_score: null,
          graph_score: null,
          title: `Contractor risk profile: ${row0.contractor}`,
          explanation: evidence.join('; '),
          evidence: { contractor: row0.contractor, score_parts: scoreParts, tender_count: wins, win_rate: winRate, value_share: valueShare, data_confidence: dataConfidence },
          related_tender_ids: rows.map((r) => r.id),
          related_cluster_ids: []
        });
      }
    }

    const beneficiaries = tenders.filter((t) => t.beneficiary_id);
    const byBeneficiary = new Map();
    for (const t of beneficiaries) {
      const key = t.beneficiary_id;
      if (!byBeneficiary.has(key)) byBeneficiary.set(key, []);
      byBeneficiary.get(key).push(t);
    }

    for (const [beneficiaryId, rows] of byBeneficiary.entries()) {
      if (rows.length > 1) {
        welfareFindings.push({ beneficiaryId, type: 'duplicate_beneficiary', score: clamp(rows.length * 10, 0, 100), explanation: `Beneficiary appears ${rows.length} times` });
      }
      // Normalise phones before uniqueness check to catch +91/91 prefix variants
      const phones = new Set(rows.map((r) => normalizePhone(r.phone)).filter(Boolean));
      // Normalise bank account strings before uniqueness check
      const accounts = new Set(rows.map((r) => normalizeText(r.meta.bank_account)).filter(Boolean));
      // Check deceased/inactive across ALL rows, not just first row (status string fallback)
      const isDeceased = rows.some((r) => ['deceased', 'inactive', 'expired'].includes(normalizeText(r.meta.beneficiary_status)));
      if (isDeceased) {
        welfareFindings.push({ beneficiaryId, type: 'inactive_claims', score: 95, explanation: `Beneficiary marked deceased/inactive with active claims` });
      }
      // death_date column check: flag any tender dated AFTER the beneficiary's recorded death date
      // Requires: ALTER TABLE tenders ADD COLUMN death_date date; (see infra/migrations/add_death_date.sql)
      const deathDateRow = rows.find((r) => r.death_date);
      if (deathDateRow) {
        const deathDate = new Date(deathDateRow.death_date);
        const postDeathRows = rows.filter((r) => new Date(r.date) > deathDate);
        if (postDeathRows.length > 0) {
          const lastDisbursement = postDeathRows.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date;
          welfareFindings.push({
            beneficiaryId,
            type: 'deceased_active',
            score: 98,
            explanation: `Beneficiary died on ${deathDateRow.death_date} but received ${postDeathRows.length} disbursement(s) after death (last: ${lastDisbursement})`,
            evidence: { death_date: deathDateRow.death_date, post_death_count: postDeathRows.length, last_disbursement: lastDisbursement }
          });
        }
      }
      if (phones.size === 1 && rows.length >= 3) {
        welfareFindings.push({ beneficiaryId, type: 'phone_reuse', score: 70, explanation: 'Same phone reused for repeated claims' });
      }
      if (accounts.size === 1 && rows.length >= 3) {
        welfareFindings.push({ beneficiaryId, type: 'bank_reuse', score: 75, explanation: 'Same bank account reused across records' });
      }
    }

    // Aadhaar duplicate detection: same Aadhaar under different beneficiary IDs
    const aadhaarGroups = new Map();
    for (const t of beneficiaries) {
      const aadhaar = normalizeText(t.meta?.aadhaar_number);
      if (!aadhaar || !/^\d{12}$/.test(aadhaar)) continue;
      if (!aadhaarGroups.has(aadhaar)) aadhaarGroups.set(aadhaar, new Set());
      aadhaarGroups.get(aadhaar).add(t.beneficiary_id);
    }
    for (const [aadhaar, ids] of aadhaarGroups.entries()) {
      if (ids.size > 1) {
        // Mask Aadhaar in explanation — never log raw Aadhaar numbers
        const masked = `${aadhaar.slice(0, 4)}XXXX${aadhaar.slice(-2)}`;
        welfareFindings.push({ beneficiaryId: [...ids][0], type: 'duplicate_aadhaar', score: clamp(ids.size * 20, 0, 100), explanation: `Aadhaar ${masked} linked to ${ids.size} different beneficiary IDs`, linked: [...ids] });
      }
    }

    // Same-address cluster: flag 3+ different beneficiary IDs at exactly the same address
    const byAddress = new Map();
    for (const t of beneficiaries) {
      if (!t.address) continue;
      const addr = normalizeText(t.address);
      if (!byAddress.has(addr)) byAddress.set(addr, new Set());
      byAddress.get(addr).add(t.beneficiary_id);
    }
    for (const [addr, ids] of byAddress.entries()) {
      if (ids.size >= THRESHOLDS.ADDRESS_CLUSTER_MIN) {
        welfareFindings.push({ beneficiaryId: [...ids][0], type: 'shared_address', score: clamp(ids.size * 15, 0, 100), explanation: `${ids.size} different beneficiary IDs share address: "${addr}"`, linked: [...ids] });
      }
    }

    const beneRows = Array.from(byBeneficiary.keys()).map((id) => ({ id, name: byBeneficiary.get(id)[0].meta.beneficiary_name || id }));
    for (let i = 0; i < beneRows.length; i++) {
      for (let j = i + 1; j < beneRows.length; j++) {
        // Pre-filter by length before expensive Levenshtein to avoid O(n²) timeout on large sets
        if (Math.abs(beneRows[i].name.length - beneRows[j].name.length) > 5) continue;
        const sim = similarity(beneRows[i].name, beneRows[j].name);
        if (sim >= THRESHOLDS.NAME_SIM_THRESHOLD && beneRows[i].name !== beneRows[j].name) {
          welfareFindings.push({ beneficiaryId: beneRows[i].id, type: 'identity_similarity', score: 68, explanation: `Name very similar to beneficiary ${beneRows[j].id}`, linked: beneRows[j].id });
        }
      }
    }

    // Regional disbursement spike detection (inline rule-based, no ML service needed)
    detectRegionalSpikes(tenders, findings);

    for (const w of welfareFindings) {
      findings.push({
        finding_key: buildFindingKey(w.type, 'beneficiary', w.beneficiaryId),
        entity_type: 'beneficiary',
        entity_id: w.beneficiaryId,
        finding_type: w.type,
        severity: riskLevel(w.score),
        risk_score: Math.round(w.score),
        anomaly_score: null,
        graph_score: null,
        title: `Welfare fraud signal: ${w.type}`,
        explanation: w.explanation,
        evidence: w,
        related_tender_ids: byBeneficiary.get(w.beneficiaryId)?.map((r) => r.id) || [],
        related_cluster_ids: []
      });
    }

    const contractorAmountMap = new Map();
    for (const [cid, rows] of byContractor.entries()) {
      contractorAmountMap.set(cid, rows.reduce((s, r) => s + number(r.amount), 0));
    }

    const nodes = [];
    const edges = [];
    const addNode = (id, type, label) => { if (!id) return; nodes.push({ id: `${type}:${id}`, raw_id: id, type, label: label || id }); };
    const addEdge = (source, target, type, weight = 1) => { if (source && target && source !== target) edges.push({ source, target, type, weight }); };

    for (const t of tenders) {
      addNode(t.contractor_id || t.contractor, 'contractor', t.contractor);
      const contractorNode = `contractor:${t.contractor_id || t.contractor}`;
      if (t.meta.official_id) {
        addNode(t.meta.official_id, 'official', t.meta.official_name || t.meta.official_id);
        addEdge(contractorNode, `official:${t.meta.official_id}`, 'awarded_by');
      }
      if (t.beneficiary_id) {
        addNode(t.beneficiary_id, 'beneficiary', t.meta.beneficiary_name || t.beneficiary_id);
        addEdge(contractorNode, `beneficiary:${t.beneficiary_id}`, 'serves_beneficiary');
      }
      if (t.phone) {
        addNode(t.phone, 'phone', t.phone);
        addEdge(contractorNode, `phone:${t.phone}`, 'shared_phone');
      }
      if (t.address) {
        addNode(t.address, 'address', t.address);
        addEdge(contractorNode, `address:${t.address}`, 'shared_address');
      }
      if (t.meta.bank_account) {
        addNode(t.meta.bank_account, 'bank', t.meta.bank_account);
        if (t.beneficiary_id) addEdge(`beneficiary:${t.beneficiary_id}`, `bank:${t.meta.bank_account}`, 'uses_bank');
      }
    }

    // ── CIRCULAR IDENTITY CHECK (rule-based, works without ML service) ─────────
    // Flag tenders where the approving official shares name, address, or phone
    // with the winning contractor — a direct conflict-of-interest signal.
    for (const t of tenders) {
      const officialName    = normalizeText(t.meta?.official_name);
      const officialAddress = normalizeText(t.meta?.official_address);
      const officialPhone   = normalizePhone(t.meta?.official_phone);
      const contractorName  = normalizeText(t.contractor);
      const contractorAddr  = normalizeText(t.address);
      const contractorPhone = normalizePhone(t.phone);

      const matches = [];

      // Name match: similarity above threshold (e.g. official "Rajesh Kumar" ≈ contractor "Rajesh Kumar Infra")
      if (officialName && contractorName && similarity(officialName, contractorName) >= THRESHOLDS.NAME_SIM_THRESHOLD) {
        matches.push(`name match (official: "${officialName}" ~ contractor: "${contractorName}")`);
      }
      // Exact address match
      if (officialAddress && contractorAddr && officialAddress === contractorAddr) {
        matches.push(`shared address: "${officialAddress}"`);
      }
      // Exact phone match after normalisation
      if (officialPhone && contractorPhone && officialPhone === contractorPhone && officialPhone.length >= 10) {
        matches.push(`shared phone: ${officialPhone.slice(0, 4)}XXXXXX`);
      }

      if (matches.length > 0) {
        findings.push({
          finding_key: buildFindingKey('circular_identity', 'tender', t.id),
          entity_type: 'tender',
          entity_id: String(t.id),
          finding_type: 'circular_identity',
          severity: 'Critical',
          risk_score: 90,
          anomaly_score: null,
          graph_score: null,
          title: `Conflict of interest: approver linked to contractor on tender ${t.tender_number}`,
          explanation: `Official who approved tender shares identity with contractor. Matched on: ${matches.join('; ')}`,
          evidence: {
            tender_number: t.tender_number,
            contractor: t.contractor,
            contractor_id: t.contractor_id,
            official_id: t.meta?.official_id,
            official_name: t.meta?.official_name,
            matched_fields: matches,
            amount: number(t.amount),
          },
          related_tender_ids: [t.id],
          related_cluster_ids: [],
        });
      }
    }

    const graphRes = await callMlService('/fraud/graph', { nodes: dedupeNodes(nodes), edges: dedupeEdges(edges) });
    const anomalyPayload = {
      contractor_features: Array.from(byContractor.entries()).map(([cid, rows]) => ({
        entity_id: cid,
        entity_type: 'contractor',
        wins: rows.length,
        avg_amount: rows.reduce((s, r) => s + number(r.amount), 0) / rows.length,
        max_amount: Math.max(...rows.map((r) => number(r.amount))),
        single_bid_rate: rows.filter((r) => number(r.meta.bidder_count) === 1).length / rows.length,
        overrun_rate: rows.filter((r) => number(r.meta.execution_cost) > number(r.amount) * 1.2).length / rows.length
      })),
      beneficiary_features: Array.from(byBeneficiary.entries()).map(([bid, rows]) => ({
        entity_id: bid,
        entity_type: 'beneficiary',
        claim_count: rows.length,
        unique_phones: new Set(rows.map((r) => r.phone).filter(Boolean)).size,
        unique_addresses: new Set(rows.map((r) => r.address).filter(Boolean)).size,
        unique_banks: new Set(rows.map((r) => normalizeText(r.meta.bank_account)).filter(Boolean)).size
      }))
    };
    const anomalyRes = await callMlService('/fraud/anomaly', anomalyPayload);

    console.log(`[FraudPipeline] run=${runId} tenders=${totalTenders} findings_pre_merge=${findings.length} graph_clusters=${graphRes?.clusters?.length || 0} anomalies=${anomalyRes?.anomalies?.length || 0}`);

    const clusters = (graphRes?.clusters || []).map((c) => {
      const totalAmount = (c.nodes || []).reduce((sum, nodeId) => {
        if (String(nodeId).startsWith('contractor:')) {
          const cid = String(nodeId).split('contractor:')[1];
          return sum + number(contractorAmountMap.get(cid), 0);
        }
        return sum;
      }, 0);
      return {
        cluster_hash: c.cluster_hash,
        cluster_nodes: c.nodes,
        suspiciousness_score: number(c.risk_score, 0),
        total_amount: number(c.total_amount, totalAmount),
        edge_density: number(c.edge_density, 0),
        evidence: c.evidence || {},
        run_id: runId
      };
    });

    for (const c of clusters) {
      await pool.query(`INSERT INTO fraud_clusters (run_id, cluster_hash, cluster_nodes, suspiciousness_score, total_amount, edge_density, evidence, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())
        ON CONFLICT (cluster_hash) DO UPDATE SET
        run_id=EXCLUDED.run_id,
        cluster_nodes=EXCLUDED.cluster_nodes,
        suspiciousness_score=EXCLUDED.suspiciousness_score,
        total_amount=EXCLUDED.total_amount,
        edge_density=EXCLUDED.edge_density,
        evidence=EXCLUDED.evidence,
        updated_at=now()`,
      [c.run_id, c.cluster_hash, JSON.stringify(c.cluster_nodes), c.suspiciousness_score, c.total_amount, c.edge_density, JSON.stringify(c.evidence)]);
    }

    for (const f of findings) {
      const anomalyHit = anomalyRes?.anomalies?.find((a) => a.entity_id === f.entity_id && a.entity_type === f.entity_type);
      const graphNode = graphRes?.suspicious_nodes?.find((s) => s.id.endsWith(`:${f.entity_id}`));
      const graphScore = graphNode ? Math.round(number(graphNode.score) * 100) : null;
      const anomalyScore = anomalyHit ? Math.round(number(anomalyHit.score) * 100) : null;
      // When ML service unavailable keep rule-based score intact (avoid silent 30% reduction)
      const mlAvailable = anomalyScore !== null || graphScore !== null;
      const finalScore = mlAvailable
        ? clamp(Math.round((number(f.risk_score) * 0.7) + (number(anomalyScore) * 0.2) + (number(graphScore) * 0.1)), 0, 100)
        : clamp(Math.round(number(f.risk_score)), 0, 100);

      await pool.query(`INSERT INTO fraud_findings
        (run_id, finding_key, entity_type, entity_id, finding_type, severity, risk_score, anomaly_score, graph_score, title, explanation, evidence, related_tender_ids, related_cluster_ids, status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'open',now(),now())
        ON CONFLICT (finding_key) DO UPDATE SET
        run_id=EXCLUDED.run_id,
        severity=EXCLUDED.severity,
        risk_score=EXCLUDED.risk_score,
        anomaly_score=EXCLUDED.anomaly_score,
        graph_score=EXCLUDED.graph_score,
        title=EXCLUDED.title,
        explanation=EXCLUDED.explanation,
        evidence=EXCLUDED.evidence,
        related_tender_ids=EXCLUDED.related_tender_ids,
        related_cluster_ids=EXCLUDED.related_cluster_ids,
        status='open',
        updated_at=now()`,
      [runId, f.finding_key, f.entity_type, f.entity_id, f.finding_type, riskLevel(finalScore), finalScore, anomalyScore, graphScore, f.title, f.explanation, JSON.stringify(f.evidence), JSON.stringify(f.related_tender_ids), JSON.stringify(f.related_cluster_ids)]);
    }

    // Build unified FraudReport wrapping all findings in the canonical schema
    const report = new FraudReport(findings, {
      run_id:           runId,
      tenders_analysed: totalTenders,
      dropped_count:    droppedCount,
      ml_graph_used:    Boolean(graphRes),
      ml_anomaly_used:  Boolean(anomalyRes),
    });

    const summary = {
      flags_detected:       findings.length,
      high_risk_cases:      findings.filter((f) => (f.risk_score || 0) >= 60).length,
      suspicious_contractors: Array.from(contractorRisk.values()).filter((c) => c.risk_score >= 35).sort((a, b) => b.risk_score - a.risk_score).slice(0, 10),
      ghost_beneficiaries:  welfareFindings.filter((w) => w.score >= 60).slice(0, 25),
      collusion_clusters:   clusters.slice(0, 20),
      // Indicate truncation so auditors know the list is not exhaustive
      evidence:             findings.slice(0, 100).map((f) => ({ type: f.finding_type, entity: f.entity_id, explanation: f.explanation })),
      evidence_truncated:   findings.length > 100,
      external_services: {
        // Do not expose internal ML URL in API responses
        graph_invoked:   Boolean(graphRes),
        anomaly_invoked: Boolean(anomalyRes)
      },
      // Unified report in canonical schema — suitable for direct API consumption
      unified_report: report.toJSON(),
    };

    await pool.query("UPDATE fraud_audit_runs SET status='completed', completed_at=now(), summary=$2 WHERE id=$1", [runId, JSON.stringify(summary)]);
    return { run_id: runId, ...summary, report };
  } catch (err) {
    await pool.query("UPDATE fraud_audit_runs SET status='failed', completed_at=now(), error_message=$2 WHERE id=$1", [runId, err.message]);
    throw err;
  }
}

module.exports = { runFraudPipeline, riskLevel, similarity, resolveFraudServiceBaseUrl, FraudReport };
