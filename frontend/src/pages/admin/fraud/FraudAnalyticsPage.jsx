import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  LineChart, Line, CartesianGrid, XAxis, YAxis, BarChart, Bar, Legend,
} from 'recharts';
import { TYPE_LABEL, TYPE_ICON } from './components/RiskCards';

const PALETTE = ['#1e3a5f', '#dc2626', '#d97706', '#2563eb', '#059669', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#c2410c', '#0369a1'];

const Card = ({ title, children, style }) => (
  <div style={{
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
    padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', ...style,
  }}>
    <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#1e293b', fontWeight: 700 }}>{title}</h3>
    {children}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      {label && <div style={{ fontWeight: 700, marginBottom: 4, color: '#1e293b' }}>{label}</div>}
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color || '#64748b' }}>{p.name}: <b>{p.value}</b></div>
      ))}
    </div>
  );
};

const FraudAnalyticsPage = () => {
  const { data } = useOutletContext();

  // 1. Detection type distribution
  const typeDistribution = useMemo(() => {
    const m = new Map();
    data.flags.forEach((f) => {
      const key = f.finding_type || 'unknown';
      m.set(key, (m.get(key) || 0) + 1);
    });
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name: `${TYPE_ICON[name] || '🔍'} ${TYPE_LABEL[name] || name}`, rawName: name, value }));
  }, [data.flags]);

  // 2. Severity distribution
  const severityDistribution = useMemo(() => {
    const levels = ['Critical', 'High', 'Medium', 'Low'];
    const colors = { Critical: '#7f1d1d', High: '#dc2626', Medium: '#d97706', Low: '#2563eb' };
    return levels.map((name) => ({
      name,
      value: data.flags.filter((f) => f.severity === name).length,
      fill: colors[name],
    }));
  }, [data.flags]);

  // 3. Run-over-run trend
  const trend = useMemo(() =>
    data.runs.slice().reverse().map((r, i) => ({
      run:     `R${i + 1}`,
      flags:    Number(r.summary?.flags_detected  || 0),
      highRisk: Number(r.summary?.high_risk_cases || 0),
    })),
  [data.runs]);

  // 4. Data-confidence distribution for contractor findings
  const confidence = useMemo(() => {
    const m = { low: 0, medium: 0, high: 0 };
    data.flags.forEach((f) => {
      const dc = f.evidence?.data_confidence;
      if (dc && m[dc] !== undefined) m[dc]++;
    });
    return [
      { name: 'Low',    value: m.low,    fill: '#dc2626' },
      { name: 'Medium', value: m.medium, fill: '#d97706' },
      { name: 'High',   value: m.high,   fill: '#16a34a' },
    ];
  }, [data.flags]);

  // 5. Risk score histogram (buckets 0-20, 20-40, …)
  const histogram = useMemo(() => {
    const buckets = [
      { name: '0–20', min: 0,  max: 20  },
      { name: '21–40',min: 21, max: 40  },
      { name: '41–60',min: 41, max: 60  },
      { name: '61–80',min: 61, max: 80  },
      { name: '81–100',min:81, max: 100 },
    ];
    return buckets.map(({ name, min, max }) => ({
      name,
      count: data.flags.filter((f) => { const s = Number(f.risk_score || 0); return s >= min && s <= max; }).length,
    }));
  }, [data.flags]);

  // 6. Welfare vs contract fraud split
  const entitySplit = useMemo(() => {
    const byType = {};
    data.flags.forEach((f) => {
      const t = f.entity_type || 'other';
      byType[t] = (byType[t] || 0) + 1;
    });
    return Object.entries(byType).map(([name, value]) => ({ name, value }));
  }, [data.flags]);

  // 7. Value share for top contractors
  const contractorValueShare = useMemo(() =>
    (data.flags)
      .filter((f) => f.finding_type === 'contractor_risk' && f.evidence?.value_share)
      .sort((a, b) => (b.evidence.value_share || 0) - (a.evidence.value_share || 0))
      .slice(0, 8)
      .map((f) => ({
        name: (f.evidence?.contractor || f.entity_id || '').slice(0, 20),
        valueShare: +((f.evidence.value_share || 0) * 100).toFixed(1),
        riskScore:  Math.round(Number(f.risk_score || 0)),
      })),
  [data.flags]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Row 1: Type pie + Severity bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title='🔍 Detection Type Distribution'>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie data={typeDistribution} dataKey='value' nameKey='name' outerRadius={90} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {typeDistribution.map((entry, i) => <Cell key={entry.rawName} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title='🌡️ Severity Distribution'>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={severityDistribution} barSize={40}>
                <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                <XAxis dataKey='name' tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey='value' radius={[6, 6, 0, 0]}>
                  {severityDistribution.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 2: Risk score histogram + Data confidence */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title='📊 Risk Score Histogram'>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={histogram} barSize={36}>
                <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                <XAxis dataKey='name' tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey='count' name='Findings' fill='#dc2626' radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title='🎯 Data Confidence (Contractor Findings)'>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie data={confidence} dataKey='value' nameKey='name' outerRadius={80} innerRadius={40}
                  label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}>
                  {confidence.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 4 }}>
            Low = &lt;5 tenders | Medium = 5–19 | High = 20+
          </div>
        </Card>
      </div>

      {/* Row 3: Contractor value share */}
      {contractorValueShare.length > 0 && (
        <Card title='🏗️ Contractor Value Share (Top Flagged)'>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={contractorValueShare} layout='vertical' barSize={16}>
                <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' horizontal={false} />
                <XAxis type='number' unit='%' tick={{ fontSize: 11 }} />
                <YAxis type='category' dataKey='name' width={140} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey='valueShare' name='Value Share %' fill='#dc2626' radius={[0, 4, 4, 0]} />
                <Bar dataKey='riskScore'  name='Risk Score'    fill='#d97706' radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Row 4: Entity type split + run trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <Card title='🗂️ Entity Type Split'>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie data={entitySplit} dataKey='value' nameKey='name' outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {entitySplit.map((entry, i) => <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title='📉 Flags Trend by Detection Run'>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                <XAxis dataKey='run' tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type='monotone' dataKey='flags'    name='Total Flags' stroke='#1e3a5f' strokeWidth={2} dot={{ r: 3 }} />
                <Line type='monotone' dataKey='highRisk' name='High Risk'   stroke='#dc2626' strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FraudAnalyticsPage;
