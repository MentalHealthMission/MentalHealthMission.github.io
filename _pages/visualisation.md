---
title: null
layout: single
permalink: /visualisation/
---

<!-- Container for the graph -->
<div id="cy" style="width:100%; height:800px; border:1px solid #e5e5e5;"></div>

<!-- Cytoscape CSS/JS -->
<script src="https://unpkg.com/cytoscape@3.25.0/dist/cytoscape.min.js"></script>

<!-- Load Ontology JSON -->
<script>
document.addEventListener("DOMContentLoaded", async () => {
    const response = await fetch("{{ '/assets/webvowl/data/conv_ontology.json' | relative_url }}");
    const data = await response.json();

    // Convert to Cytoscape elements
    const elements = [];

    // Nodes
    data.nodes.forEach(n => {
        elements.push({
            data: { id: n.id, label: n.label },
            classes: "node"
        });
    });

    // Edges
    data.edges.forEach(e => {
        elements.push({
            data: {
                id: e.from + "_" + e.to + "_" + (e.label || "edge"),
                source: e.from,
                target: e.to,
                label: e.label
            },
            classes: "edge"
        });
    });

    // Initialize Cytoscape
    const cy = cytoscape({
        container: document.getElementById('cy'),
        elements: elements,
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': '#1f77b4',
                    'label': 'data(label)',
                    'text-valign': 'center',
                    'color': '#fff',
                    'text-outline-width': 1,
                    'text-outline-color': '#1f77b4'
                }
            },
            {
                selector: 'edge',
                style: {
                    'curve-style': 'bezier',
                    'target-arrow-shape': 'triangle',
                    'width': 2,
                    'line-color': '#888',
                    'target-arrow-color': '#888',
                    'label': 'data(label)',
                    'font-size': 10,
                    'text-rotation': 'autorotate',
                    'text-margin-y': -5
                }
            }
        ],
        layout: {
            name: 'cose',  // force-directed layout
            padding: 30
        }
    });

    // Optional: enable zooming/panning
    cy.userZoomingEnabled(true);
    cy.userPanningEnabled(true);
});
</script>
