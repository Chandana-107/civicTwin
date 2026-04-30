import React, { useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import D3Graph, {
  NODE_COLORS, CLUSTER_PALETTE, makeAlias,
  buildOverviewGraph, buildClusterGraph,
} from './components/NetworkGraph';

// ── Constants ─────────────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { type:'contractor',  label:'Contractor' },
  { type:'official',    label:'Official' },
  { type:'beneficiary', label:'Beneficiary' },
  { type:'bank',        label:'Bank' },
  { type:'phone',       label:'Phone' },
  { type:'address',     label:'Address' },
  { type:'tender',      label:'Tender' },
];

const EDGE_LEGEND = [
  { color:'#3B82F6', label:'Contract award' },
  { color:'#F59E0B', label:'Shared identifier' },
  { color:'#EF4444', label:'Disbursement' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const Dot = ({ color, size = 10 }) => (
  <span style={{ display:'inline-block', width:size, height:size, borderRadius:'50%', background:color, flexShrink:0 }} />
);

const RiskBadge = ({ score }) => {
  const [bg, fg] = score >= 80 ? ['#FEE2E2','#7F1D1D'] :
                   score >= 60 ? ['#FEE2E2','#DC2626'] :
                   score >= 35 ? ['#FEF3C7','#92400E'] :
                                 ['#DBEAFE','#1E40AF'];
  return (
    <span style={{ fontSize:'0.7rem', fontWeight:700, padding:'0.15rem 0.5rem', borderRadius:'999px', background:bg, color:fg, whiteSpace:'nowrap' }}>
      Risk {score}
    </span>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const FraudNetworkPage = () => {
  const { data, loading } = useOutletContext();

  const [focusedCluster, setFocusedCluster] = useState(null);
  const [selectedNode,   setSelectedNode]   = useState(null);
  const [expandedCi,     setExpandedCi]     = useState(null);
  const [minRisk,        setMinRisk]        = useState(0);
  const [visTypes,       setVisTypes]       = useState(
    () => new Set([...LEGEND_ITEMS.map(l => l.type), 'cluster'])
  );

  const toggleType = useCallback(type => {
    setVisTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }, []);

  const mode = focusedCluster !== null ? 'cluster' : 'overview';
  const focusedObj   = focusedCluster !== null ? data.clusters[focusedCluster] : null;
  const focusedColor = CLUSTER_PALETTE[(focusedCluster || 0) % CLUSTER_PALETTE.length];

  const rawGraph = useMemo(() => {
    if (focusedCluster !== null && data.clusters[focusedCluster])
      return buildClusterGraph(data.clusters[focusedCluster], focusedCluster, data.flags);
    return buildOverviewGraph(data.clusters, data.flags);
  }, [focusedCluster, data.clusters, data.flags]);

  const filteredGraph = useMemo(() => {
    const nodes = rawGraph.nodes.filter(n =>
      n.group === 'cluster' || (visTypes.has(n.group) && n.risk >= minRisk)
    );
    const ids = new Set(nodes.map(n => n.id));
    const links = rawGraph.links.filter(l => {
      const sid = typeof l.source === 'object' ? l.source.id : l.source;
      const tid = typeof l.target === 'object' ? l.target.id : l.target;
      return ids.has(sid) && ids.has(tid);
    });
    return { nodes, links };
  }, [rawGraph, visTypes, minRisk]);

  const connectedTo = useMemo(() => {
    if (!selectedNode) return [];
    return filteredGraph.links
      .filter(l => {
        const sid = typeof l.source === 'object' ? l.source.id : l.source;
        const tid = typeof l.target === 'object' ? l.target.id : l.target;
        return sid === selectedNode.id || tid === selectedNode.id;
      })
      .map(l => {
        const sid = typeof l.source === 'object' ? l.source.id : l.source;
        const tid = typeof l.target === 'object' ? l.target.id : l.target;
        const otherId = sid === selectedNode.id ? tid : sid;
        const other   = filteredGraph.nodes.find(n => n.id === otherId);
        return { alias: other?.alias || otherId.slice(0,14), group: other?.group || 'entity', type: l.type };
      });
  }, [selectedNode, filteredGraph]);

  if (loading) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
        <div className='fraud-skeleton' style={{ height:56, borderRadius:'0.75rem' }} />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:'1rem' }}>
          <div className='fraud-skeleton' style={{ height:640, borderRadius:'1rem' }} />
          <div className='fraud-skeleton' style={{ height:640, borderRadius:'1rem' }} />
        </div>
      </div>
    );
  }

  const isEmpty = data.flags.length === 0 && data.clusters.length === 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div style={{
        background:'var(--card-bg)', border:'1px solid var(--border-color)',
        borderRadius:'0.875rem', padding:'0.75rem 1.25rem',
        boxShadow:'0 2px 12px rgba(30,49,80,0.07)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexWrap:'wrap', gap:'0.75rem',
      }}>
        {/* Breadcrumb + counts */}
        <div style={{ display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
          {mode === 'overview' ? (
            <div>
              <span style={{ fontFamily:"'Playfair Display',serif", fontSize:'1rem', fontWeight:700, color:'var(--primary-color)' }}>
                Collusion Network
              </span>
              <span style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginLeft:'0.625rem' }}>
                Overview mode — each node = one cluster
              </span>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <button
                onClick={() => { setFocusedCluster(null); setSelectedNode(null); }}
                style={{
                  background:'none', border:'1px solid var(--border-color)',
                  borderRadius:'0.5rem', cursor:'pointer', padding:'0.25rem 0.625rem',
                  fontSize:'0.8rem', color:'var(--text-secondary)', fontWeight:600,
                  display:'flex', alignItems:'center', gap:'0.25rem',
                }}
              >
                ← Overview
              </button>
              <Dot color={focusedColor} size={9} />
              <span style={{ fontFamily:"'Playfair Display',serif", fontSize:'1rem', fontWeight:700, color:'var(--primary-color)' }}>
                Cluster {focusedCluster + 1}
              </span>
              {focusedObj && <RiskBadge score={Math.min(100, Math.round(Number(focusedObj.suspiciousness_score||0)))} />}
            </div>
          )}

          {focusedCluster !== null && (
            <span style={{
              fontSize:'0.75rem', padding:'0.2rem 0.75rem', borderRadius:'999px',
              background:'var(--light-bg)', color:'var(--text-secondary)', fontWeight:600,
            }}>
              {filteredGraph.nodes.length} nodes · {filteredGraph.links.length} edges
            </span>
          )}
        </div>

        {/* Edge legend */}
        <div style={{ display:'flex', gap:'1.25rem', flexWrap:'wrap', alignItems:'center' }}>
          {EDGE_LEGEND.map(e => (
            <div key={e.label} style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.75rem', color:'var(--text-secondary)' }}>
              <span style={{ display:'inline-block', width:20, height:2.5, background:e.color, borderRadius:2 }} />
              {e.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Body: Graph | Right panel ─────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 296px', gap:'1rem', alignItems:'start' }}>

        {/* Canvas */}
        <div style={{
          background:'#111827', borderRadius:'1rem', overflow:'hidden',
          height:640, border:'1px solid rgba(255,255,255,0.06)',
          boxShadow:'0 4px 24px rgba(0,0,0,0.18)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          {isEmpty ? (
            /* No data at all */
            <div className='fraud-empty' style={{ height:640 }}>
              <div className='fraud-empty-icon'>🕸️</div>
              <p className='fraud-empty-title' style={{ color:'#94a3b8' }}>No network data</p>
              <p className='fraud-empty-sub' style={{ color:'#64748b' }}>Run AI Detection to build the collusion graph.</p>
            </div>
          ) : focusedCluster === null ? (
            /* Waiting for cluster selection */
            <div style={{ textAlign:'center', padding:'2rem', maxWidth:340 }}>
              <div style={{ fontSize:'3rem', marginBottom:'1rem', opacity:0.5 }}>🎯</div>
              <p style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.1rem', fontWeight:700, color:'#94a3b8', margin:'0 0 0.5rem' }}>
                Select a cluster to visualise
              </p>
              <p style={{ fontSize:'0.875rem', color:'#64748b', margin:0, lineHeight:1.65 }}>
                Click the <b style={{ color:'#f1f5f9' }}>🎯</b> button next to any cluster in the list
                to render its network graph here.
              </p>
              {data.clusters.length > 0 && (
                <p style={{ fontSize:'0.78rem', color:'#475569', marginTop:'1rem' }}>
                  {data.clusters.length} clusters available
                </p>
              )}
            </div>
          ) : (
            /* Focused cluster graph */
            <D3Graph
              key={`cluster-${focusedCluster}`}
              graphData={filteredGraph}
              mode='cluster'
              onNodeClick={n => setSelectedNode(prev => prev?.id === n.id ? null : n)}
            />
          )}
        </div>

        {/* ── Right panel ────────────────────────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem', maxHeight:640, overflowY:'auto' }}>

          {/* Entity type filters */}
          <div className='fraud-card' style={{ padding:'1rem 1.125rem' }}>
            <div style={{ fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', color:'var(--text-secondary)', marginBottom:'0.625rem' }}>
              Filter by type
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.25rem 0.75rem' }}>
              {LEGEND_ITEMS.map(({ type, label }) => (
                <label key={type} style={{ display:'flex', alignItems:'center', gap:'0.4rem', cursor:'pointer', userSelect:'none', padding:'0.2rem 0' }}>
                  <input type='checkbox' checked={visTypes.has(type)} onChange={() => toggleType(type)}
                    style={{ accentColor: NODE_COLORS[type], width:12, height:12, flexShrink:0 }} />
                  <Dot color={NODE_COLORS[type]} size={8} />
                  <span style={{ fontSize:'0.78rem', color:'var(--primary-color)', opacity: visTypes.has(type) ? 1 : 0.38 }}>{label}</span>
                </label>
              ))}
            </div>
            {/* Risk slider */}
            <div style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px solid var(--border-color)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.3rem' }}>
                <span style={{ fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', color:'var(--text-secondary)' }}>Min risk</span>
                <span style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--danger-color)' }}>{minRisk}</span>
              </div>
              <input type='range' min={0} max={100} step={5} value={minRisk}
                onChange={e => setMinRisk(Number(e.target.value))}
                style={{ width:'100%', accentColor:'var(--danger-color)' }} />
            </div>
          </div>

          {/* Selected node detail */}
          {selectedNode && selectedNode.group !== 'cluster' && (
            <div className='fraud-card' style={{ padding:'1rem 1.125rem', position:'relative' }}>
              <button onClick={() => setSelectedNode(null)}
                style={{ position:'absolute', top:'0.625rem', right:'0.625rem', background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', fontSize:'0.875rem', lineHeight:1 }}>✕</button>
              <div style={{ fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', color:'var(--text-secondary)', marginBottom:'0.5rem' }}>Selected Node</div>
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.625rem' }}>
                <Dot color={NODE_COLORS[selectedNode.group] || '#64748B'} size={10} />
                <span style={{ fontWeight:700, fontSize:'0.9375rem', color:'var(--primary-color)' }}>{selectedNode.alias}</span>
                <RiskBadge score={selectedNode.risk} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.4rem', marginBottom:'0.625rem' }}>
                {[
                  { l:'Type',    v: selectedNode.group },
                  { l:'Cluster', v: selectedNode.clusterIdx >= 0 ? `#${selectedNode.clusterIdx + 1}` : 'None' },
                  { l:'Risk',    v: selectedNode.risk },
                ].map(({l,v}) => (
                  <div key={l} style={{ background:'var(--light-bg)', borderRadius:'0.5rem', padding:'0.35rem 0.5rem' }}>
                    <div style={{ fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-secondary)' }}>{l}</div>
                    <div style={{ fontSize:'0.8125rem', fontWeight:600, color:'var(--primary-color)' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:'0.65rem', color:'var(--text-secondary)', marginBottom:'0.2rem' }}>Full ID</div>
              <code style={{ fontSize:'0.67rem', wordBreak:'break-all', color:'var(--text-secondary)', lineHeight:1.4 }}>
                {selectedNode.id.split(':').pop()}
              </code>
              {connectedTo.length > 0 && (
                <div style={{ marginTop:'0.625rem', paddingTop:'0.625rem', borderTop:'1px solid var(--border-color)' }}>
                  <div style={{ fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-secondary)', marginBottom:'0.375rem' }}>
                    Connected ({connectedTo.length})
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'0.25rem' }}>
                    {connectedTo.slice(0,10).map((c,i) => (
                      <span key={i} style={{ fontSize:'0.68rem', padding:'0.1rem 0.4rem', borderRadius:'999px', border:`1px solid ${NODE_COLORS[c.group]||'#64748B'}`, color: NODE_COLORS[c.group]||'#64748B', background:'var(--light-bg)', fontWeight:600 }}>
                        {c.alias}
                      </span>
                    ))}
                    {connectedTo.length > 10 && <span style={{ fontSize:'0.68rem', color:'var(--text-secondary)', alignSelf:'center' }}>+{connectedTo.length - 10}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cluster drilldown */}
          <div className='fraud-card' style={{ padding:'1rem 1.125rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
              <span style={{ fontFamily:"'Playfair Display',serif", fontSize:'1rem', fontWeight:700, color:'var(--primary-color)' }}>
                Clusters
              </span>
              <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>
                {data.clusters.length} detected
              </span>
            </div>

            {data.clusters.length === 0 ? (
              <div style={{ textAlign:'center', padding:'1.5rem', color:'var(--text-secondary)', fontSize:'0.8125rem' }}>
                <div style={{ fontSize:'1.5rem', marginBottom:'0.5rem', opacity:0.5 }}>🔍</div>
                ML graph service required
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                {data.clusters.map((c, ci) => {
                  const score  = Math.min(100, Math.round(Number(c.suspiciousness_score||0)));
                  const cNodes = Array.isArray(c.cluster_nodes) ? c.cluster_nodes : [];
                  const cyclic = c.evidence?.has_circular_relationship;
                  const isExp  = expandedCi === ci;
                  const isFocus= focusedCluster === ci;
                  const color  = CLUSTER_PALETTE[ci % CLUSTER_PALETTE.length];

                  return (
                    <div key={c.id || ci}>
                      <div style={{ display:'flex', gap:'0.3rem', alignItems:'stretch' }}>
                        <button
                          onClick={() => setExpandedCi(isExp ? null : ci)}
                          style={{
                            flex:1, display:'flex', alignItems:'center', justifyContent:'space-between',
                            padding:'0.5rem 0.75rem', border:`1px solid ${isFocus ? color : 'var(--border-color)'}`,
                            borderLeft:`3px solid ${color}`, borderRadius:'0.5rem',
                            background: isFocus ? `${color}18` : 'var(--card-bg)',
                            cursor:'pointer', transition:'all 0.18s', gap:'0.5rem',
                          }}
                        >
                          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', minWidth:0 }}>
                            <Dot color={color} size={7} />
                            <span style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--primary-color)' }}>
                              {cyclic && '🔄 '}Cluster {ci + 1}
                            </span>
                            <span style={{ fontSize:'0.72rem', color:'var(--text-secondary)', fontWeight:400 }}>
                              · {cNodes.length} nodes
                            </span>
                          </div>
                          <RiskBadge score={score} />
                        </button>
                        {/* Drill-in button */}
                        <button
                          title={isFocus ? 'Back to overview' : 'Drill into cluster'}
                          onClick={() => { setFocusedCluster(isFocus ? null : ci); setSelectedNode(null); }}
                          style={{
                            padding:'0 0.5rem', border:`1px solid ${isFocus ? color : 'var(--border-color)'}`,
                            borderRadius:'0.5rem', background: isFocus ? color : 'var(--card-bg)',
                            color: isFocus ? '#fff' : 'var(--text-secondary)',
                            cursor:'pointer', fontSize:'0.75rem', fontWeight:700, flexShrink:0, transition:'all 0.18s',
                          }}
                        >
                          🎯
                        </button>
                      </div>

                      {/* Expanded: node alias pills */}
                      {isExp && (
                        <div style={{ margin:'0.3rem 0 0.1rem', padding:'0.625rem 0.75rem', background:'var(--light-bg)', borderRadius:'0.5rem', border:'1px solid var(--border-color)' }}>
                          {c.evidence?.reason && (
                            <p style={{ fontSize:'0.75rem', color:'var(--text-secondary)', margin:'0 0 0.375rem', lineHeight:1.5 }}>
                              {c.evidence.reason}
                            </p>
                          )}
                          <div style={{ display:'flex', flexWrap:'wrap', gap:'0.25rem', marginBottom:'0.375rem' }}>
                            {cNodes.slice(0, 16).map(nid => {
                              const group = String(nid).split(':')[0] || 'entity';
                              const trail = nid.replace(/[^0-9]/g,'').slice(-3) || '???';
                              const pfx   = { contractor:'CONTR',official:'OFF',beneficiary:'BEN',bank:'BANK',phone:'PHN',address:'ADDR',tender:'TDR',entity:'ENT' }[group] || 'ENT';
                              const alias = `${pfx}-${trail}`;
                              return (
                                <span key={nid} style={{ fontSize:'0.67rem', padding:'0.1rem 0.4rem', borderRadius:'999px', background: NODE_COLORS[group]||'#64748B', color:'#f1f5f9', fontWeight:600 }}>
                                  {alias}
                                </span>
                              );
                            })}
                            {cNodes.length > 16 && (
                              <span style={{ fontSize:'0.68rem', color:'var(--text-secondary)', alignSelf:'center' }}>+{cNodes.length-16}</span>
                            )}
                          </div>
                          {(c.total_amount || c.edge_density || cyclic) && (
                            <div style={{ display:'flex', gap:'0.375rem', flexWrap:'wrap', marginTop:'0.25rem' }}>
                              {cyclic    && <span className='fraud-evidence-pill'>🔄 Circular</span>}
                              {c.total_amount  && <span className='fraud-evidence-pill'>₹{Number(c.total_amount).toLocaleString()}</span>}
                              {c.edge_density  && <span className='fraud-evidence-pill'>Density {Number(c.edge_density).toFixed(2)}</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>{/* end right panel */}
      </div>
    </div>
  );
};

export default FraudNetworkPage;
