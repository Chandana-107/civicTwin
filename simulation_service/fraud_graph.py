import networkx as nx
import json

def analyze_fraud_graph(data):
    """
    Analyzes a graph of contractors/tenders to find communities and central nodes.
    Input:
      data: {
        "nodes": [{"id": "C1", "type": "contractor"}, ...],
        "edges": [{"source": "C1", "target": "C2", "type": "shared_address"}, ...]
      }
    Output:
      {
        "communities": [[node_id, ...], ...],
        "centrality": {node_id: score, ...},
        "graph_stats": { ... }
      }
    """
    G = nx.Graph()
    
    # Add nodes
    for node in data.get("nodes", []):
        G.add_node(node["id"], type=node.get("type", "unknown"))
        
    # Add edges
    for edge in data.get("edges", []):
        G.add_edge(edge["source"], edge["target"], type=edge.get("type", "relation"))
        
    if G.number_of_nodes() == 0:
        return {"communities": [], "centrality": {}, "suspicious_nodes": []}

    # 1. Community Detection (Greedy Modularity)
    try:
        communities = list(nx.community.greedy_modularity_communities(G))
        # Convert frozensets to lists
        communities_list = [list(c) for c in communities]
    except:
        # Fallback for small/disconnected graphs
        communities_list = [list(c) for c in nx.connected_components(G)]

    # 2. Centrality Measures (Degree & Betweenness)
    degree_cent = nx.degree_centrality(G)
    try:
        betweenness_cent = nx.betweenness_centrality(G)
    except:
        betweenness_cent = {n: 0 for n in G.nodes()}

    # 3. Identify Suspicious Nodes (High Centrality in sparse graph)
    suspicious_nodes = []
    for node in G.nodes():
        score = (degree_cent.get(node, 0) + betweenness_cent.get(node, 0)) / 2
        if score > 0.1: # Threshold
            suspicious_nodes.append({"id": node, "score": score})

    suspicious_nodes.sort(key=lambda x: x["score"], reverse=True)

    return {
        "communities": communities_list,
        "centrality": degree_cent,
        "suspicious_nodes": suspicious_nodes,
        "stats": {
            "num_nodes": G.number_of_nodes(),
            "num_edges": G.number_of_edges(),
            "density": nx.density(G)
        }
    }
