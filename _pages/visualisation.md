---
title: null
layout: single
permalink: /visualisation/
---

<link rel="stylesheet" href="{{ '/assets/webvowl/css/webvowl.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/assets/webvowl/css/webvowl.app.css' | relative_url }}">

<main>
  <section id="canvasArea">
    <div id="graph"></div>
  </section>

  <aside id="detailsArea" style="background-color: #18202A;">
  </aside>
</main>

<script src="{{ '/assets/webvowl/js/d3.min.js' | relative_url }}"></script>
<script src="{{ '/assets/webvowl/js/webvowl.js' | relative_url }}"></script>
<script src="{{ '/assets/webvowl/js/webvowl.app.js' | relative_url }}"></script>

<script>
window.onload = function() {
    webvowl.app()
        .loadOntology("{{ '/assets/webvowl/data/ontology.json' | relative_url }}")
        .initialize();
};
</script>
