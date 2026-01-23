---
title: null
layout: single
permalink: /visualisation/
---

<!-- Include WebVOWL CSS -->
<link rel="stylesheet" href="{{ '/assets/webvowl/css/webvowl.css' | relative_url }}">

<!-- Optional: page styling -->
<style>
  #graph {
    width: 100%;
    height: 80vh; /* responsive height */
    border: 1px solid #ccc;
  }
  body {
    margin: 0;
    font-family: sans-serif;
    background-color: #f5f5f5;
  }
</style>

<main>
  <div id="graph"></div>
</main>

<!-- Include D3 and WebVOWL core -->
<script src="{{ '/assets/webvowl/js/d3.min.js' | relative_url }}"></script>
<script src="{{ '/assets/webvowl/js/webvowl.js' | relative_url }}"></script>

<script>
window.onload = function() {
    // Create a WebVOWL graph instance
    var graph = new webvowl.Graph();

    // Optional: configure graph dimensions
    graph.options().graphHeight = document.getElementById('graph').clientHeight;
    graph.options().graphWidth = document.getElementById('graph').clientWidth;

    // Load your ontology JSON
    d3.json("{{ '/assets/webvowl/data/ontology.json' | relative_url }}")
      .then(function(json) {
          graph.graphData(json); // load data
          graph.initialize(document.getElementById("graph")); // render graph
      })
      .catch(function(error) {
          console.error("Error loading ontology:", error);
      });
};
</script>
