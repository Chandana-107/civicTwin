/**
 * fraudReport.js
 * Unified output schema and FraudReport builder for all fraud detection modules.
 *
 * Every detection in fraudPipeline.js produces a raw finding object.
 * This module normalises those into a single canonical flag schema and
 * generates both a structured JSON report and a plain-English text summary
 * that a non-technical auditor can read and act on.
 */

const { v4: uuidv4 } = require('uuid');

// ─── Detection type registry ──────────────────────────────────────────────────
// Maps internal finding_type strings to human-readable labels and default severity.
const DETECTION_TYPES = {
  contractor_risk:    { label: 'Contractor Risk Profile',              defaultSeverity: 'MEDIUM' },
  duplicate_aadhaar:  { label: 'Duplicate Aadhaar / Beneficiary ID',  defaultSeverity: 'HIGH'   },
  duplicate_beneficiary: { label: 'Duplicate Beneficiary Entry',      defaultSeverity: 'MEDIUM' },
  inactive_claims:    { label: 'Deceased / Inactive Beneficiary',     defaultSeverity: 'HIGH'   },
  deceased_active:    { label: 'Post-Death Disbursement',             defaultSeverity: 'HIGH'   },
  phone_reuse:        { label: 'Shared Phone Across Claims',          defaultSeverity: 'MEDIUM' },
  bank_reuse:         { label: 'Shared Bank Account Across Claims',   defaultSeverity: 'MEDIUM' },
  shared_address:     { label: 'Multiple Beneficiaries — Same Address', defaultSeverity: 'MEDIUM' },
  identity_similarity:{ label: 'Similar Name — Possible Ghost Record', defaultSeverity: 'MEDIUM' },
  regional_spike:     { label: 'Regional Disbursement Spike',         defaultSeverity: 'HIGH'   },
  circular_identity:  { label: 'Approver–Contractor Conflict of Interest', defaultSeverity: 'HIGH' },
};

// ─── Severity mapping ─────────────────────────────────────────────────────────
// Normalises pipeline severity strings to the canonical uppercase set.
function normaliseSeverity(raw) {
  const s = String(raw || '').toLowerCase();
  if (s === 'critical') return 'HIGH';   // treat Critical as HIGH for the unified schema
  if (s === 'high')     return 'HIGH';
  if (s === 'medium')   return 'MEDIUM';
  return 'LOW';
}

// ─── Flag builder ─────────────────────────────────────────────────────────────
/**
 * Converts one raw pipeline finding into the canonical flag schema:
 * {
 *   flag_id, detection_type, severity, entity_ids,
 *   description, evidence, detected_at
 * }
 */
function buildFlag(finding, runId) {
  const typeInfo = DETECTION_TYPES[finding.finding_type] || {
    label: finding.finding_type,
    defaultSeverity: 'MEDIUM',
  };

  const entityIds = [];
  if (finding.entity_id) entityIds.push(String(finding.entity_id));
  // Include linked IDs from welfare findings (shared address, Aadhaar duplicates, etc.)
  if (finding.evidence?.linked) {
    const linked = Array.isArray(finding.evidence.linked)
      ? finding.evidence.linked
      : [finding.evidence.linked];
    linked.forEach((id) => { if (id && !entityIds.includes(String(id))) entityIds.push(String(id)); });
  }
  if (Array.isArray(finding.related_tender_ids)) {
    finding.related_tender_ids.forEach((id) => {
      if (id && !entityIds.includes(String(id))) entityIds.push(String(id));
    });
  }

  // Build a clean evidence object — strip internal bookkeeping fields
  const { beneficiaryId, type, score, linked, ...cleanEvidence } = finding.evidence || {};

  return {
    flag_id:        `${runId || 'local'}-${uuidv4()}`,
    detection_type: finding.finding_type,
    detection_label: typeInfo.label,
    severity:       normaliseSeverity(finding.severity),
    risk_score:     finding.risk_score ?? null,
    entity_type:    finding.entity_type,
    entity_ids:     entityIds,
    description:    finding.explanation || finding.title || 'No description available.',
    evidence:       cleanEvidence,
    detected_at:    new Date().toISOString(),
  };
}

// ─── FraudReport class ────────────────────────────────────────────────────────
class FraudReport {
  /**
   * @param {object[]} findings  - Raw findings array from runFraudPipeline()
   * @param {object}   meta      - { run_id, tenders_analysed, dropped_count }
   */
  constructor(findings = [], meta = {}) {
    this.meta     = meta;
    this.flags    = findings.map((f) => buildFlag(f, meta.run_id));
    this.generated_at = new Date().toISOString();
  }

  // ── Filtered views ──────────────────────────────────────────────────────────
  get highFlags()   { return this.flags.filter((f) => f.severity === 'HIGH');   }
  get mediumFlags() { return this.flags.filter((f) => f.severity === 'MEDIUM'); }
  get lowFlags()    { return this.flags.filter((f) => f.severity === 'LOW');    }

  byType(detectionType) {
    return this.flags.filter((f) => f.detection_type === detectionType);
  }

  // ── JSON export ─────────────────────────────────────────────────────────────
  toJSON() {
    return {
      report_meta: {
        run_id:             this.meta.run_id || null,
        generated_at:       this.generated_at,
        tenders_analysed:   this.meta.tenders_analysed || 0,
        dropped_invalid:    this.meta.dropped_count || 0,
        total_flags:        this.flags.length,
        high_flags:         this.highFlags.length,
        medium_flags:       this.mediumFlags.length,
        low_flags:          this.lowFlags.length,
        ml_graph_used:      this.meta.ml_graph_used || false,
        ml_anomaly_used:    this.meta.ml_anomaly_used || false,
      },
      flags: this.flags,
    };
  }

  // ── Plain-English text summary (auditor-readable) ──────────────────────────
  toText() {
    const lines = [];
    const bar   = '═'.repeat(70);
    const dash  = '─'.repeat(70);

    lines.push(bar);
    lines.push('  CIVIC TWIN — FRAUD DETECTION REPORT');
    lines.push(`  Generated : ${this.generated_at}`);
    lines.push(`  Run ID    : ${this.meta.run_id || 'N/A'}`);
    lines.push(bar);
    lines.push('');
    lines.push('EXECUTIVE SUMMARY');
    lines.push(dash);
    lines.push(`  Tenders analysed : ${this.meta.tenders_analysed || 0}`);
    lines.push(`  Total flags      : ${this.flags.length}`);
    lines.push(`  ⚠  HIGH          : ${this.highFlags.length}`);
    lines.push(`  ⚡ MEDIUM        : ${this.mediumFlags.length}`);
    lines.push(`  ℹ  LOW           : ${this.lowFlags.length}`);
    lines.push('');

    // Group by detection type for readability
    const grouped = {};
    for (const f of this.flags) {
      if (!grouped[f.detection_type]) grouped[f.detection_type] = [];
      grouped[f.detection_type].push(f);
    }

    for (const [dtype, flags] of Object.entries(grouped)) {
      const typeInfo = DETECTION_TYPES[dtype] || { label: dtype };
      lines.push('');
      lines.push(`【 ${typeInfo.label.toUpperCase()} 】  (${flags.length} flag${flags.length > 1 ? 's' : ''})`);
      lines.push(dash);

      for (const f of flags) {
        lines.push(`  [${f.severity}]  ${f.description}`);
        lines.push(`          Entity IDs : ${f.entity_ids.slice(0, 3).join(', ')}${f.entity_ids.length > 3 ? ` +${f.entity_ids.length - 3} more` : ''}`);
        if (f.risk_score != null) {
          lines.push(`          Risk Score : ${f.risk_score}/100`);
        }
        // Print key evidence fields in plain English
        const ev = f.evidence || {};
        if (ev.value_share != null) lines.push(`          Value share: ${(ev.value_share * 100).toFixed(1)}% of total procurement`);
        if (ev.spike_factor)        lines.push(`          Spike factor: ${ev.spike_factor}× rolling average`);
        if (ev.death_date)          lines.push(`          Death date: ${ev.death_date} | Last disbursement: ${ev.last_disbursement}`);
        if (ev.matched_fields)      lines.push(`          Matched on: ${ev.matched_fields.join(' | ')}`);
        if (ev.data_confidence)     lines.push(`          Data confidence: ${ev.data_confidence}`);
        lines.push('');
      }
    }

    lines.push(bar);
    lines.push('  END OF REPORT');
    lines.push(bar);

    return lines.join('\n');
  }
}

// ─── Standalone text generator ────────────────────────────────────────────────
// Generates the auditor text report directly from the stored report JSON.
// Use this in routes instead of reconstructing a FraudReport instance.
function generateTextReport(reportJson) {
  const meta  = reportJson.report_meta || {};
  const flags = reportJson.flags       || [];

  const bar  = '═'.repeat(70);
  const dash = '─'.repeat(70);
  const lines = [];

  lines.push(bar);
  lines.push('  CIVIC TWIN — FRAUD DETECTION REPORT');
  lines.push(`  Generated : ${meta.generated_at || new Date().toISOString()}`);
  lines.push(`  Run ID    : ${meta.run_id || 'N/A'}`);
  lines.push(bar);
  lines.push('');
  lines.push('EXECUTIVE SUMMARY');
  lines.push(dash);
  lines.push(`  Tenders analysed : ${meta.tenders_analysed || 0}`);
  lines.push(`  Total flags      : ${meta.total_flags     || flags.length}`);
  lines.push(`  ⚠  HIGH          : ${meta.high_flags     || flags.filter(f => f.severity === 'HIGH').length}`);
  lines.push(`  ⚡ MEDIUM        : ${meta.medium_flags   || flags.filter(f => f.severity === 'MEDIUM').length}`);
  lines.push(`  ℹ  LOW           : ${meta.low_flags      || flags.filter(f => f.severity === 'LOW').length}`);
  lines.push(`  ML Graph used    : ${meta.ml_graph_used   ? 'Yes' : 'No'}`);
  lines.push(`  ML Anomaly used  : ${meta.ml_anomaly_used ? 'Yes' : 'No'}`);
  lines.push('');

  if (flags.length === 0) {
    lines.push('  No fraud flags detected in this run.');
  } else {
    // Group by detection type
    const grouped = {};
    for (const f of flags) {
      if (!grouped[f.detection_type]) grouped[f.detection_type] = [];
      grouped[f.detection_type].push(f);
    }

    for (const [dtype, dflags] of Object.entries(grouped)) {
      const typeInfo = DETECTION_TYPES[dtype] || { label: dtype };
      lines.push('');
      lines.push(`【 ${typeInfo.label.toUpperCase()} 】  (${dflags.length} flag${dflags.length > 1 ? 's' : ''})`);
      lines.push(dash);

      for (const f of dflags) {
        lines.push(`  [${f.severity}]  ${f.description}`);
        lines.push(`          Entity IDs : ${(f.entity_ids || []).slice(0, 3).join(', ')}${(f.entity_ids || []).length > 3 ? ` +${f.entity_ids.length - 3} more` : ''}`);
        if (f.risk_score != null) lines.push(`          Risk Score : ${f.risk_score}/100`);
        const ev = f.evidence || {};
        if (ev.value_share  != null) lines.push(`          Value share: ${(ev.value_share * 100).toFixed(1)}% of total procurement`);
        if (ev.spike_factor)         lines.push(`          Spike factor: ${ev.spike_factor}× rolling average`);
        if (ev.death_date)           lines.push(`          Death date: ${ev.death_date} | Last disbursement: ${ev.last_disbursement}`);
        if (ev.matched_fields)       lines.push(`          Matched on: ${ev.matched_fields.join(' | ')}`);
        if (ev.data_confidence)      lines.push(`          Data confidence: ${ev.data_confidence}`);
        lines.push('');
      }
    }
  }

  lines.push(bar);
  lines.push('  END OF REPORT');
  lines.push(bar);

  return lines.join('\n');
}

module.exports = { FraudReport, buildFlag, normaliseSeverity, DETECTION_TYPES, generateTextReport };
