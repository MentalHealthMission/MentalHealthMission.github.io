---
title: null
layout: single
permalink: /visualisation/
---

<div id="graph" style="width:100%; height:800px; border:1px solid #e5e5e5;"></div>

<!-- WebVOWL CSS -->
<link rel="stylesheet" href="{{ '/assets/webvowl/css/webvowl.css' | relative_url }}">

<!-- WebVOWL JS -->
<script src="{{ '/assets/webvowl/js/d3.min.js' | relative_url }}"></script>
<script src="{{ '/assets/webvowl/js/webvowl.js' | relative_url }}"></script>
<script src="{{ '/assets/webvowl/js/webvowl.app.js' | relative_url }}"></script>

<!-- Ontology file -->
<script>
    var ontologyFile = "{{ '/assets/webvowl/data/ontology.json' | relative_url }}";
</script>

<!-- Initialize -->
<script>
    document.addEventListener("DOMContentLoaded", function () {
        webvowl.app().initialize();
    });
</script>
