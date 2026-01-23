---
title: null
layout: single
permalink: /visualisation/
---

<link rel="stylesheet" href="{{ '/assets/webvowl/css/webvowl.css' | relative_url }}">

<main>
  <div id="graph" style="width: 100%; height: 800px;"></div>
</main>

<script src="{{ '/assets/webvowl/js/d3.min.js' | relative_url }}"></script>
<script src="{{ '/assets/webvowl/js/webvowl.js' | relative_url }}"></script>

<script>
window.onload = function() {
    var graph = new webvowl.Graph();
    graph.options().graphHeight = 800; // set your preferred height
    graph.options().graphWidth = window.innerWidth;

    d3.json("{{ '/assets/webvowl/data/ontology.json' | relative_url }}").then(function(json) {
        graph.graphData(json);
        graph.initialize(document.getElementById("graph"));
    }).catch(function(error) {
        console.error("Error loading ontology:", error);
    });
};
</script>

