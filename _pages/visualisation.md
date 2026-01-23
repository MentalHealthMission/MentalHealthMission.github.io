---
title: null
layout: single
permalink: /visualisation/
---

<div id="graph" style="width:100%; height:800px; border:1px solid #e5e5e5;"></div>

<div id="network" style="width:100%; height:600px; border:1px solid #ccc;"></div>

<!-- Vis-Network library -->
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>

<script>
  fetch("{{ '/assets/webvowl/data/ontology.json' | relative_url }}")
    .then(response => response.json())
    .then(data => {
      const nodes = new vis.DataSet(data.nodes);
      const edges = new vis.DataSet(data.edges);

      const container = document.getElementById('network');
      const networkData = { nodes: nodes, edges: edges };

      const options = {
        layout: { improvedLayout: true },
        physics: { stabilization: false },
        edges: { arrows: "to" },
        nodes: { shape: "dot", size: 16 },
      };

      new vis.Network(container, networkData, options);
    })
    .catch(err => console.error("Error loading ontology JSON:", err));
</script>
