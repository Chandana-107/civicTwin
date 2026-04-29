import React, { useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const safeArray = (v) => (Array.isArray(v) ? v : []);

const ClusterGraph = ({ clusters, flags }) => {
  const graphData = useMemo(() => {
    if (clusters.length) {
      const nodes = new Map();
      const links = [];
      for (const c of clusters) {
        const cn = safeArray(c.cluster_nodes);
        cn.forEach((id) => nodes.set(id, { id, group: String(id).split(':')[0] || 'entity', name: id }));
        for (let i = 0; i < cn.length; i++) for (let j = i + 1; j < cn.length; j++) links.push({ source: cn[i], target: cn[j] });
      }
      return { nodes: Array.from(nodes.values()), links };
    }

    const nodes = new Map();
    const links = [];
    for (const f of flags) {
      const id = `${f.entity_type}:${f.entity_id}`;
      nodes.set(id, { id, group: f.entity_type || 'entity', name: id });
      safeArray(f.related_tender_ids).slice(0, 2).forEach((tid) => {
        const t = `tender:${tid}`;
        nodes.set(t, { id: t, group: 'tender', name: t });
        links.push({ source: id, target: t });
      });
    }

    return { nodes: Array.from(nodes.values()), links };
  }, [clusters, flags]);

  if (!graphData.nodes.length) return <p style={{ color: '#5377A2' }}>No graph data available.</p>;

  return (
    <div style={{ height: 540 }}>
      <ForceGraph2D graphData={graphData} nodeLabel={(n) => n.name} nodeAutoColorBy='group' linkWidth={1.8} />
    </div>
  );
};

export default ClusterGraph;
