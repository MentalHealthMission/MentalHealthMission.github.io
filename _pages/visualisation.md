---
title: null
layout: single
permalink: /visualisation/
---

<div id="graph" style="width:100%; height:800px; border:1px solid #e5e5e5;"></div>

<!-- WebVOWL CSS -->
<link rel="stylesheet" href="{{ '/assets/webvowl/css/webvowl.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/assets/webvowl/css/webvowl.app.css' | relative_url }}">

<!-- WebVOWL JS -->
<script src="{{ '/assets/webvowl/js/d3.min.js' | relative_url }}"></script>
<script src="{{ '/assets/webvowl/js/webvowl.js' | relative_url }}"></script>
<script src="{{ '/assets/webvowl/js/webvowl.app.js' | relative_url }}"></script>

<script>
document.addEventListener("DOMContentLoaded", function () {
    // Initialize the app
    var app = webvowl.app();

    // Make sure the graph div exists
    app.initialize();

    // Load your ontology JSON
    app.loadOntologyFromURL("{{ '/assets/webvowl/data/ontology.json' | relative_url }}");
});
</script>

<!-- Minimal UI: hide everything except the graph -->
<style>
  /* Hide all menus, sidebars, debug panels */
  #menuContainer,
  aside,
  #leftSideBar,
  #scrollRightButton,
  #scrollLeftButton,
  #zoomSlider,
  #blockGraphInteractions,
  #DirectInputContent,
  #WarningErrorMessagesContainer {
    display: none !important;
  }

  /* Graph container styling */
  #graph {
    width: 100%;
    height: 800px;
  }
</style>
