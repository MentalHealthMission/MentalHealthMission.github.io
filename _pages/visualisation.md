---
title: null
layout: single
permalink: /visualisation/
---

<!-- Core WebVOWL CSS -->
<link rel="stylesheet" href="{{ '/assets/webvowl/css/webvowl.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/assets/webvowl/css/webvowl.app.css' | relative_url }}">

<!-- Minimal styling -->
<style>
  body { margin: 0; background-color: #f5f5f5; font-family: sans-serif; }
  #graph { width: 100%; height: 95vh; }

  /* Hide all panels, menus, sidebars, drag/drop, etc. */
  #menuContainer,
  #dragDropContainer,
  aside,
  #leftSideBar,
  #additionalInformationContainer,
  #containerForLeftSideBar {
      display: none !important;
  }
</style>

<main>
  <div id="graph"></div>
</main>

<!-- JS -->
<script src="{{ '/assets/webvowl/js/d3.min.js' | relative_url }}"></script>
<script src="{{ '/assets/webvowl/js/webvowl.js' | relative_url }}"></script>
<script src="{{ '/assets/webvowl/js/webvowl.app.js' | relative_url }}"></script>

<script>
window.onload = function() {
    // Initialize the WebVOWL app
    var app = webvowl.app();

    // Render the graph in the #graph div
    app.initialize();

    // Load your ontology JSON automatically
    app.loadOntologyFromURL("{{ '/assets/webvowl/data/ontology.json' | relative_url }}");

    // Optional: make graph responsive on window resize
    window.addEventListener('resize', function() {
        app.update();
    });
};
</script>
