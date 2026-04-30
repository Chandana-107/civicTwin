import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  LineChart, Line, CartesianGrid, XAxis, YAxis, BarChart, Bar, Legend,
} from 'recharts';
import { TYPE_LABEL, TYPE_ICON } from './fraudConstants';

// Design-system palette (from index.css tokens)
const PALETTE = ['#1E3150', '#DC2626', '#D97706', '#5377A2', '#059669', '#7C3AED', '#0891B2', '#601A35', '#65A30D', '#C2410C', '#0369A1'];

const ChartCard = ({ title, children, note }) => (
  <div className='fraud-card'>
    <h3 className='fraud-card-title'>{title}</h3>
    {children}
    {note && <p className='fraud-chart-label'>{note}</p>}
  </div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border-color)',
      borderRadius: '0.75rem', padding: '0.625rem 0.875rem', fontSize: '0.8125rem',
      boxShadow: '0 4px 16px rgba(30,49,80,0.1)',
    }}>
      {label && <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: 'var(--primary-color)' }}>{label}</div>}
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color || 'var(--text-secondary)' }}>
          {p.name}: <b>{p.value}</b>
        </div>
      ))}
    </div>
  );
};

const axisStyle = { fontSize: 11, fill: '#5377A2' };

const FraudAnalyticsPage = () => {
  const { data, loading } = useOutletContext();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className='fraud-chart-grid-2'>
          {[0, 1].map(i => <div key={i} className='fraud-skeleton' style={{ height: 320, borderRadius: '1rem' }} />)}
        </div>
        <div className='fraud-chart-grid-2'>
          {[0, 1].map(i => <div key={i} className='fraud-skeleton' style={{ height: 280, borderRadius: '1rem' }} />)}
        </div>
      </div>
    );
  }

  if (!data.flags.length && !data.runs.length) {
    return (
      <div className='fraud-card'>
        <div className='fraud-empty'>
          <div className='fraud-empty-icon'>📊</div>
          <p className='fraud-empty-title'>No analytics data yet</p>
          <p className='fraud-empty-sub'>Run AI Detection to generate charts and trend data.</p>
        </div>
      </div>
    );
  }

  // 1. Detection type distribution
  const typeDistribution = useMemo(() => {
    const m = {};
    data.flags.forEach(f => { m[f.finding_type || 'unknown'] = (m[f.finding_type || 'unknown'] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({
      name: `${TYPE_ICON[name] || '🔍'} ${TYPE_LABEL[name] || name}`,
      rawName: name, value,
    }));
  }, [data.flags]);

  // 2. Severity distribution
  const severityDist = useMemo(() => [
    { name: 'Critical', value: data.flags.filter(f => f.severity === 'Critical').length, fill: '#7F1D1D' },
    { name: 'High',     value: data.flags.filter(f => f.severity === 'High').length,     fill: '#DC2626' },
    { name: 'Medium',   value: data.flags.filter(f => f.severity === 'Medium').length,   fill: '#D97706' },
    { name: 'Low',      value: data.flags.filter(f => f.severity === 'Low').length,       fill: '#2563EB' },
  ], [data.flags]);

  // 3. Risk score histogram
  const histogram = useMemo(() => [
    { name: '0–20',  count: data.flags.filter(f => Number(f.risk_score||0) <= 20).length },
    { name: '21–40', count: data.flags.filter(f => { const s = Number(f.risk_score||0); return s > 20 && s <= 40; }).length },
    { name: '41–60', count: data.flags.filter(f => { const s = Number(f.risk_score||0); return s > 40 && s <= 60; }).length },
    { name: '61–80', count: data.flags.filter(f => { const s = Number(f.risk_score||0); return s > 60 && s <= 80; }).length },
    { name: '81–100',count: data.flags.filter(f => Number(f.risk_score||0) > 80).length },
  ], [data.flags]);

  // 4. Data confidence donut
  const confidence = useMemo(() => {
    const m = { low: 0, medium: 0, high: 0 };
    data.flags.forEach(f => { const dc = f.evidence?.data_confidence; if (dc && m[dc] !== undefined) m[dc]++; });
    return [
      { name: 'Low',    value: m.low,    fill: '#DC2626' },
      { name: 'Medium', value: m.medium, fill: '#D97706' },
      { name: 'High',   value: m.high,   fill: '#059669' },
    ];
  }, [data.flags]);

  // 5. Contractor value share
  const contractorShare = useMemo(() =>
    data.flags
      .filter(f => f.finding_type === 'contractor_risk' && f.evidence?.value_share)
      .sort((a, b) => (b.evidence.value_share || 0) - (a.evidence.value_share || 0))
      .slice(0, 8)
      .map(f => ({
        name:       (f.evidence?.contractor || f.entity_id || '').slice(0, 20),
        valueShare: +((f.evidence.value_share || 0) * 100).toFixed(1),
        riskScore:  Math.round(Number(f.risk_score || 0)),
      })),
  [data.flags]);

  // 6. Entity type split
  const entitySplit = useMemo(() => {
    const m = {};
    data.flags.forEach(f => { m[f.entity_type || 'other'] = (m[f.entity_type || 'other'] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [data.flags]);

  // 7. Run trend
  const trend = useMemo(() =>
    data.runs.slice().reverse().map((r, i) => ({
      run:     `R${i + 1}`,
      flags:   Number(r.summary?.flags_detected  || 0),
      highRisk:Number(r.summary?.high_risk_cases || 0),
    })),
  [data.runs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Row 1: Type pie + Severity bar */}
      <div className='fraud-chart-grid-2'>
        <ChartCard title='🔍 Detection Type Distribution'>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie data={typeDistribution} dataKey='value' nameKey='name' outerRadius={90}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {typeDistribution.map((e, i) => <Cell key={e.rawName} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title='🌡️ Severity Distribution'>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={severityDist} barSize={40}>
                <CartesianGrid strokeDasharray='3 3' stroke='#E8E8E8' />
                <XAxis dataKey='name' tick={axisStyle} />
                <YAxis allowDecimals={false} tick={axisStyle} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey='value' radius={[6, 6, 0, 0]}>
                  {severityDist.map(e => <Cell key={e.name} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Row 2: Risk histogram + Data confidence */}
      <div className='fraud-chart-grid-2'>
        <ChartCard title='📊 Risk Score Distribution'>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={histogram} barSize={36}>
                <CartesianGrid strokeDasharray='3 3' stroke='#E8E8E8' />
                <XAxis dataKey='name' tick={axisStyle} />
                <YAxis allowDecimals={false} tick={axisStyle} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey='count' name='Findings' fill='#DC2626' radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title='🎯 Data Confidence' note='Low = <5 tenders · Medium = 5–19 · High = 20+'>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie data={confidence} dataKey='value' nameKey='name' outerRadius={80} innerRadius={45}
                  label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}>
                  {confidence.map(e => <Cell key={e.name} fill={e.fill} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Row 3: Contractor value share (only if data exists) */}
      {contractorShare.length > 0 && (
        <ChartCard title='🏗️ Contractor Value Share (Top Flagged)'>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={contractorShare} layout='vertical' barSize={14}>
                <CartesianGrid strokeDasharray='3 3' stroke='#E8E8E8' horizontal={false} />
                <XAxis type='number' unit='%' tick={axisStyle} />
                <YAxis type='category' dataKey='name' width={150} tick={axisStyle} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.8125rem', color: '#5377A2' }} />
                <Bar dataKey='valueShare' name='Value Share %' fill='#DC2626' radius={[0, 4, 4, 0]} />
                <Bar dataKey='riskScore'  name='Risk Score'    fill='#D97706' radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      {/* Row 4: Entity split + Trend */}
      <div className='fraud-chart-grid-3-1'>
        <ChartCard title='📉 Flags Trend by Detection Run'>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width='100%' height='100%'>
              {trend.length > 0 ? (
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray='3 3' stroke='#E8E8E8' />
                  <XAxis dataKey='run' tick={axisStyle} />
                  <YAxis tick={axisStyle} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '0.8125rem', color: '#5377A2' }} />
                  <Line type='monotone' dataKey='flags'    name='Total Flags' stroke='#1E3150' strokeWidth={2} dot={{ r: 3 }} />
                  <Line type='monotone' dataKey='highRisk' name='High Risk'   stroke='#DC2626' strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5377A2', fontSize: '0.875rem' }}>
                  No run history yet
                </div>
              )}
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title='🗂️ Entity Type Split'>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie data={entitySplit} dataKey='value' nameKey='name' outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {entitySplit.map((e, i) => <Cell key={e.name} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

    </div>
  );
};

export default FraudAnalyticsPage;
