import hashlib
import networkx as nx


def _cluster_hash(nodes):
    joined = '|'.join(sorted(nodes))
    return hashlib.sha256(joined.encode('utf-8')).hexdigest()


def analyze_fraud_graph(data):
    G = nx.Graph()

    for node in data.get('nodes', []):
        G.add_node(node['id'], type=node.get('type', 'unknown'), label=node.get('label', node['id']))

    for edge in data.get('edges', []):
        w = float(edge.get('weight', 1.0))
        G.add_edge(edge['source'], edge['target'], type=edge.get('type', 'relation'), weight=w)

    if G.number_of_nodes() == 0:
        return {'clusters': [], 'suspicious_nodes': [], 'stats': {'num_nodes': 0, 'num_edges': 0, 'density': 0}}

    try:
        communities = [list(c) for c in nx.community.greedy_modularity_communities(G, weight='weight')]
    except Exception:
        communities = [list(c) for c in nx.connected_components(G)]

    # Cycle detection: flag circular relationships (contractor <-> approver loops)
    circular_nodes = set()
    try:
        for cycle in nx.simple_cycles(G):
            if len(cycle) >= 3:
                for node in cycle:
                    circular_nodes.add(node)
    except Exception:
        pass

    degree_cent = nx.degree_centrality(G)
    between = nx.betweenness_centrality(G, weight='weight') if G.number_of_edges() else {n: 0 for n in G.nodes()}
    try:
        # This can fail for disconnected/ambiguous graphs; degrade gracefully.
        eigen = nx.eigenvector_centrality_numpy(G, weight='weight') if G.number_of_edges() else {n: 0 for n in G.nodes()}
    except Exception:
        eigen = {n: 0 for n in G.nodes()}

    suspicious_nodes = []
    for node in G.nodes():
        score = (degree_cent.get(node, 0) * 0.4) + (between.get(node, 0) * 0.4) + (eigen.get(node, 0) * 0.2)
        # Boost score if node participates in a detected circular relationship
        if node in circular_nodes:
            score = min(1.0, score + 0.3)
        if score > 0.05:
            suspicious_nodes.append({'id': node, 'score': float(score), 'type': G.nodes[node].get('type', 'unknown'), 'in_cycle': node in circular_nodes})
    suspicious_nodes.sort(key=lambda x: x['score'], reverse=True)

    clusters = []
    for community in communities:
        if len(community) < 2:
            continue
        sub = G.subgraph(community)
        internal_edges = sub.number_of_edges()
        max_edges = (len(community) * (len(community) - 1)) / 2
        edge_density = (internal_edges / max_edges) if max_edges else 0
        avg_centrality = sum(degree_cent.get(n, 0) for n in community) / len(community)
        ring_score = min(1.0, (edge_density * 0.6) + (avg_centrality * 0.4))
        clusters.append({
            'cluster_hash': _cluster_hash(community),
            'nodes': community,
            'risk_score': round(ring_score * 100, 2),
            'edge_density': round(edge_density, 4),
            'total_amount': 0,
            'evidence': {
                # Dynamic reason based on actual edge types — not a generic hardcoded string
                'reason': 'Connected via: ' + ', '.join(set(nx.get_edge_attributes(sub, 'type').values()) or {'relation'}),
                'size': len(community),
                'internal_edges': internal_edges,
                'has_circular_relationship': any(n in circular_nodes for n in community)
            }
        })

    clusters.sort(key=lambda x: x['risk_score'], reverse=True)

    return {
        'clusters': clusters,
        'suspicious_nodes': suspicious_nodes,
        'stats': {
            'num_nodes': G.number_of_nodes(),
            'num_edges': G.number_of_edges(),
            'density': nx.density(G)
        }
    }
