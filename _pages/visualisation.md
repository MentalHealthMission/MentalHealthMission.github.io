---
title: null
layout: single
permalink: /visualisation/
---

<!-- Main Graph Container -->
<div id="graph" style="width:100%; height:800px; border:1px solid #e5e5e5;"></div>

<!-- WebVOWL CSS -->
<link rel="stylesheet" href="{{ '/assets/webvowl/css/webvowl.css' | relative_url }}">

<!-- D3.js -->
<script src="{{ '/assets/webvowl/js/d3.min.js' | relative_url }}"></script>

<!-- WebVOWL JS -->
<script src="{{ '/assets/webvowl/js/webvowl.js' | relative_url }}"></script>

<!-- Ontology JSON -->
<script>
  var ontologyFile = "{{ '/assets/data/ontology.json' | relative_url }}";
</script>

<script>
document.addEventListener("DOMContentLoaded", function () {
    // Initialize WebVOWL with your ontology JSON
    webvowl.app.initialize({
        canvasSelector: "#graph",
        jsonUrl: "{{ '/assets/data/ontology.json' | relative_url }}"
    });
});
</script>
