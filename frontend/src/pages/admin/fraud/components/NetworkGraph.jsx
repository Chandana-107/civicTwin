import React, {
  useEffect, useRef, useState, useMemo,
} from 'react';
import * as d3 from 'd3';

// ── Design constants ──────────────────────────────────────────────────────────

const BG         = '#111827';
const GRID_COLOR = 'rgba(255,255,255,0.03)';

export const NODE_COLORS = {
  contractor:  '#3B6FBF',
  official:    '#D97706',
  beneficiary: '#059669',
  bank:        '#0D9488',
  phone:       '#7C3AED',
  address:     '#DC4E4E',
  tender:      '#E05252',
  entity:      '#64748B',
  cluster:     '#1E3150',
};

const EDGE_COLORS = {
  contract:    '#3B82F6',
  shared:      '#F59E0B',
  disbursement:'#EF4444',
  cluster:     'rgba(148,163,184,0.2)',
  default:     'rgba(148,163,184,0.18)',
};

export const CLUSTER_PALETTE = [
  '#E05252','#0D9488','#7C3AED','#D97706','#3B82F6',
  '#059669','#F472B6','#8B5CF6','#14B8A6','#F59E0B',
];

// ── Alias helpers ─────────────────────────────────────────────────────────────

const safeArray = v => Array.isArray(v) ? v : [];
const ALIAS_CACHE = new Map();
const COUNTERS = {};
const PREFIX = {
  contractor:'CONTR', official:'OFF', beneficiary:'BEN',
  bank:'BANK', phone:'PHN', address:'ADDR', tender:'TDR', entity:'ENT',
};

export function makeAlias(rawId, group) {
  if (ALIAS_CACHE.has(rawId)) return ALIAS_CACHE.get(rawId);
  const pfx = PREFIX[group] || 'NODE';
  COUNTERS[pfx] = (COUNTERS[pfx] || 0) + 1;
  const trail = rawId.replace(/[^0-9]/g,'').slice(-3) || String(COUNTERS[pfx]).padStart(3,'0');
  const alias = `${pfx}-${trail}`;
  ALIAS_CACHE.set(rawId, alias);
  return alias;
}

// ── Graph data builders ───────────────────────────────────────────────────────

export function buildOverviewGraph(clusters, flags) {
  ALIAS_CACHE.clear();
  Object.keys(COUNTERS).forEach(k => delete COUNTERS[k]);

  const nodeMap  = new Map();
  const linkList = [];

  clusters.forEach((c, ci) => {
    const cNodes = safeArray(c.cluster_nodes);
    const score  = Math.min(100, Math.round(Number(c.suspiciousness_score || 0)));
    const cid    = `cluster:${ci}`;
    nodeMap.set(cid, {
      id: cid, group: 'cluster', alias: `Cluster ${ci + 1}`,
      risk: score, nodeCount: cNodes.length, clusterIdx: ci,
      color: CLUSTER_PALETTE[ci % CLUSTER_PALETTE.length],
      cyclic: Boolean(c.evidence?.has_circular_relationship),
    });
  });

  // Inter-cluster edges (shared nodes)
  const clusterSets = clusters.map(c => new Set(safeArray(c.cluster_nodes)));
  const seen = new Set();
  clusters.forEach((_, ci) => clusters.forEach((_, cj) => {
    if (cj <= ci) return;
    const key = `${ci}-${cj}`;
    if (seen.has(key)) return;
    let overlap = 0;
    clusterSets[ci].forEach(id => { if (clusterSets[cj].has(id)) overlap++; });
    if (overlap > 0) {
      seen.add(key);
      linkList.push({ source:`cluster:${ci}`, target:`cluster:${cj}`, type:'cluster', weight: overlap });
    }
  }));

  // Standalone high-risk nodes
  const clusteredIds = new Set(clusters.flatMap(c => safeArray(c.cluster_nodes)));
  flags
    .filter(f => !clusteredIds.has(`${f.entity_type || 'entity'}:${f.entity_id}`))
    .sort((a,b) => (Number(b.risk_score)||0) - (Number(a.risk_score)||0))
    .slice(0, 10)
    .forEach(f => {
      const id = `${f.entity_type || 'entity'}:${f.entity_id}`;
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id, group: f.entity_type || 'entity',
          alias: makeAlias(id, f.entity_type || 'entity'),
          risk: Math.round(Number(f.risk_score || 0)), clusterIdx: -1,
        });
      }
    });

  return { nodes: Array.from(nodeMap.values()), links: linkList };
}

export function buildClusterGraph(cluster, ci, allFlags) {
  const cNodes = safeArray(cluster.cluster_nodes);
  const score  = Math.min(100, Math.round(Number(cluster.suspiciousness_score || 0)));
  const nodeMap = new Map();
  const linkList = [];

  cNodes.forEach(rawId => {
    const group = String(rawId).split(':')[0] || 'entity';
    const flag  = allFlags.find(f => `${f.entity_type||'entity'}:${f.entity_id}` === rawId);
    nodeMap.set(rawId, {
      id: rawId, group, alias: makeAlias(rawId, group),
      risk: flag ? Math.round(Number(flag.risk_score||0)) : score,
      clusterIdx: ci,
    });
  });

  for (let i = 0; i < cNodes.length; i++) {
    for (let j = i + 1; j < cNodes.length; j++) {
      const ga = String(cNodes[i]).split(':')[0];
      const gb = String(cNodes[j]).split(':')[0];
      const type = ga === 'contractor' || gb === 'contractor' ? 'contract' :
                   ga === 'bank'       || gb === 'bank'       ? 'disbursement' : 'shared';
      linkList.push({ source: cNodes[i], target: cNodes[j], type, weight: 1 });
    }
  }

  return { nodes: Array.from(nodeMap.values()), links: linkList };
}

// ── D3 renderer ───────────────────────────────────────────────────────────────

const D3Graph = ({ graphData, onNodeClick, mode }) => {
  const wrapRef    = useRef(null);
  const svgRef     = useRef(null);
  const tooltipRef = useRef(null);
  const simRef     = useRef(null);
  const [dims, setDims] = useState({ w: 600, h: 560 });

  // Measure real container size
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 50 && height > 50) setDims({ w: width, h: height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !graphData.nodes.length) return;
    const { w, h } = dims;
    const isOverview = mode === 'overview';

    const nodeR = n => {
      if (n.group === 'cluster') return Math.max(24, Math.min(52, 18 + (n.risk||0) / 35));
      return Math.max(10, Math.min(24, 9 + (n.risk||0) / 9));
    };

    if (simRef.current) simRef.current.stop();

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', w).attr('height', h);

    // Background
    svg.append('rect').attr('width', w).attr('height', h).attr('fill', BG);
    const gridG = svg.append('g');
    for (let x = 0; x < w; x += 48)
      gridG.append('line').attr('x1',x).attr('x2',x).attr('y1',0).attr('y2',h).attr('stroke', GRID_COLOR);
    for (let y = 0; y < h; y += 48)
      gridG.append('line').attr('x1',0).attr('x2',w).attr('y1',y).attr('y2',y).attr('stroke', GRID_COLOR);

    const g = svg.append('g');

    // Copy nodes for simulation
    const simNodes = graphData.nodes.map(n => ({
      ...n,
      x: w / 2 + (Math.random() - 0.5) * w * 0.5,
      y: h / 2 + (Math.random() - 0.5) * h * 0.5,
    }));
    const idMap = new Map(simNodes.map(n => [n.id, n]));
    const simLinks = graphData.links
      .map(l => ({
        ...l,
        source: idMap.get(typeof l.source === 'object' ? l.source.id : l.source),
        target: idMap.get(typeof l.target === 'object' ? l.target.id : l.target),
      }))
      .filter(l => l.source && l.target);

    const tooltip = d3.select(tooltipRef.current);

    // Simulation
    const sim = d3.forceSimulation(simNodes)
      .force('link',    d3.forceLink(simLinks).id(n => n.id).distance(isOverview ? 190 : 140).strength(0.45))
      .force('charge',  d3.forceManyBody().strength(isOverview ? -700 : -450))
      .force('center',  d3.forceCenter(w / 2, h / 2).strength(0.05))
      .force('collide', d3.forceCollide(n => nodeR(n) + 32).strength(0.92))
      .force('bounds', () => {
        const pad = 72;
        simNodes.forEach(n => {
          n.x = Math.max(pad, Math.min(w - pad, n.x));
          n.y = Math.max(pad, Math.min(h - pad, n.y));
        });
      })
      .alphaDecay(0.016);

    simRef.current = sim;

    // Edges
    const link = g.append('g').selectAll('line').data(simLinks).join('line')
      .attr('stroke', l => EDGE_COLORS[l.type] || EDGE_COLORS.default)
      .attr('stroke-width', l => Math.max(1.5, Math.min(4, 1.5 + (l.weight||0)*0.6)))
      .attr('stroke-opacity', 0.5)
      .on('mouseenter', (ev, l) => {
        const sa = l.source?.alias || '?', ta = l.target?.alias || '?';
        tooltip.style('display','block')
          .html(`<b>${sa} → ${ta}</b><br/><span style="opacity:0.7">${l.type||'link'}</span>`);
      })
      .on('mousemove', ev => {
        const rect = wrapRef.current?.getBoundingClientRect() || { left:0, top:0 };
        tooltip.style('left', (ev.clientX - rect.left + 14)+'px').style('top', (ev.clientY - rect.top - 10)+'px');
      })
      .on('mouseleave', () => tooltip.style('display','none'));

    // Nodes
    const nodeGrp = g.append('g').selectAll('g').data(simNodes).join('g')
      .style('cursor','pointer')
      .call(d3.drag()
        .on('start', (ev,d) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
        .on('drag',  (ev,d) => { d.fx=ev.x; d.fy=ev.y; })
        .on('end',   (ev,d) => { if (!ev.active) sim.alphaTarget(0); d.fx=null; d.fy=null; })
      )
      .on('click', (ev,d) => { ev.stopPropagation(); onNodeClick?.(d); })
      .on('mouseenter', (ev,d) => {
        const lines = d.group === 'cluster'
          ? [`<b>${d.alias}</b>`, `${d.nodeCount} nodes · Risk ${d.risk}`, d.cyclic ? '🔄 Circular relationship' : '']
          : [`<b>${d.alias}</b>`, `Type: ${d.group}`, `Risk: ${d.risk}`, `<span style="opacity:0.6;font-size:11px">${d.id.split(':').pop().slice(0,28)}</span>`];
        tooltip.style('display','block').html(lines.filter(Boolean).join('<br/>'));
      })
      .on('mousemove', ev => {
        const rect = wrapRef.current?.getBoundingClientRect() || { left:0, top:0 };
        tooltip.style('left', (ev.clientX - rect.left + 14)+'px').style('top', (ev.clientY - rect.top - 10)+'px');
      })
      .on('mouseleave', () => tooltip.style('display','none'));

    // Glow filter
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id','glow').attr('x','-50%').attr('y','-50%').attr('width','200%').attr('height','200%');
    filter.append('feGaussianBlur').attr('stdDeviation','3').attr('result','blur');
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in','blur');
    merge.append('feMergeNode').attr('in','SourceGraphic');

    // Outer ring for cyclic clusters
    nodeGrp.filter(n => n.cyclic)
      .append('circle')
      .attr('r', n => nodeR(n) + 6)
      .attr('fill','none')
      .attr('stroke','#EF4444')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray','5,3')
      .attr('opacity', 0.6);

    // Main circle
    nodeGrp.append('circle')
      .attr('r', nodeR)
      .attr('fill', n => n.color || NODE_COLORS[n.group] || NODE_COLORS.entity)
      .attr('stroke', 'rgba(255,255,255,0.22)')
      .attr('stroke-width', 1.5)
      .attr('filter', n => n.group === 'cluster' ? 'url(#glow)' : null);

    // Risk score text inside cluster super-node
    nodeGrp.filter(n => n.group === 'cluster')
      .append('text')
      .text(n => n.risk)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('fill','rgba(255,255,255,0.95)')
      .attr('font-size', 11).attr('font-weight', 800)
      .attr('font-family',"'Segoe UI',system-ui,sans-serif")
      .attr('pointer-events','none');

    // Label group (below node)
    const labelG = nodeGrp.append('g').attr('class','lbl');
    labelG.append('rect')
      .attr('rx',5).attr('ry',5).attr('height',15)
      .attr('fill', n => n.group === 'cluster'
        ? (n.color || NODE_COLORS.cluster)
        : 'rgba(10,15,30,0.88)'
      )
      .attr('stroke', n => n.color || NODE_COLORS[n.group] || NODE_COLORS.entity)
      .attr('stroke-width', 0.75);
    labelG.append('text')
      .text(n => n.alias)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('fill','#f1f5f9')
      .attr('font-size', n => n.group === 'cluster' ? 10 : 9)
      .attr('font-weight', 700)
      .attr('font-family',"'Segoe UI',system-ui,sans-serif")
      .attr('pointer-events','none');

    // Mini-map (bottom-right corner of SVG)
    const MM_W = 108, MM_H = 64, MM_PAD = 10;
    const mmG = svg.append('g').attr('transform', `translate(${w - MM_W - MM_PAD},${h - MM_H - MM_PAD})`);
    mmG.append('rect').attr('width',MM_W).attr('height',MM_H).attr('rx',6)
      .attr('fill','rgba(10,15,30,0.88)').attr('stroke','rgba(255,255,255,0.1)').attr('stroke-width',1);
    const mmDots = mmG.append('g');

    // Tick
    sim.on('tick', () => {
      link.attr('x1',l=>l.source.x).attr('y1',l=>l.source.y)
          .attr('x2',l=>l.target.x).attr('y2',l=>l.target.y);

      nodeGrp.attr('transform', n => `translate(${n.x},${n.y})`);

      // Fit label pill to text width
      nodeGrp.each(function(n) {
        const texts = d3.select(this).selectAll('text').nodes();
        const labelTxt = n.group === 'cluster' ? texts[1] : texts[0];
        if (!labelTxt) return;
        try {
          const tw = labelTxt.getBBox().width;
          const r  = nodeR(n);
          d3.select(this).select('g.lbl')
            .attr('transform', `translate(0,${r + 3})`);
          d3.select(this).select('g.lbl rect')
            .attr('width', tw + 10).attr('x', -(tw+10)/2).attr('y', 0);
          d3.select(this).select('g.lbl text')
            .attr('x', 0).attr('y', 7.5);
        } catch(e) {}
      });

      // Mini-map
      const allX = simNodes.map(n=>n.x), allY = simNodes.map(n=>n.y);
      const xRange = [d3.min(allX)||0, d3.max(allX)||w];
      const yRange = [d3.min(allY)||0, d3.max(allY)||h];
      const xs = d3.scaleLinear().domain(xRange).range([4, MM_W-4]);
      const ys = d3.scaleLinear().domain(yRange).range([4, MM_H-4]);
      mmDots.selectAll('circle').data(simNodes).join('circle')
        .attr('cx', n=>xs(n.x)).attr('cy', n=>ys(n.y)).attr('r', 2.2)
        .attr('fill', n => n.color || NODE_COLORS[n.group] || NODE_COLORS.entity)
        .attr('opacity', 0.85);
    });

    // Zoom — hide labels below k=0.6
    const zoom = d3.zoom().scaleExtent([0.15, 6])
      .on('zoom', ev => {
        g.attr('transform', ev.transform);
        nodeGrp.selectAll('g.lbl').attr('opacity', ev.transform.k >= 0.55 ? 1 : 0);
      });
    svg.call(zoom).on('dblclick.zoom', null);

    // Fit after settle
    sim.on('end', () => {
      const allX = simNodes.map(n=>n.x), allY = simNodes.map(n=>n.y);
      const xmin = d3.min(allX), xmax = d3.max(allX);
      const ymin = d3.min(allY), ymax = d3.max(allY);
      const pad = 80;
      const k = Math.min((w-pad*2)/(xmax-xmin||1), (h-pad*2)/(ymax-ymin||1), 1.6);
      const tx = w/2 - k*(xmin+xmax)/2;
      const ty = h/2 - k*(ymin+ymax)/2;
      svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(tx,ty).scale(k));
    });

    return () => sim.stop();
  }, [graphData, dims, mode]);

  return (
    <div ref={wrapRef} style={{ position:'relative', width:'100%', height:'100%' }}>
      <svg ref={svgRef} style={{ display:'block', width:'100%', height:'100%' }} />
      <div ref={tooltipRef} style={{
        display:'none', position:'absolute', pointerEvents:'none',
        background:'rgba(8,12,26,0.97)', border:'1px solid rgba(255,255,255,0.12)',
        borderRadius:8, padding:'7px 11px', fontSize:12, color:'#f1f5f9',
        lineHeight:1.7, maxWidth:220, boxShadow:'0 6px 24px rgba(0,0,0,0.55)',
        zIndex:20,
      }} />
    </div>
  );
};

export default D3Graph;
