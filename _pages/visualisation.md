---
title: null
layout: single
permalink: /visualisation/
---

<div id="ontology-graph"
     style="width:100%; height:800px; border:1px solid #e5e5e5;">
</div>

<!-- WebVOWL CSS -->
<link rel="stylesheet"
      href="{{ '/assets/webvowl/css/vowl.css' | relative_url }}">

<!-- Local D3 (v5) -->
<script src="{{ '/assets/webvowl/js/d3.v5.min.js' | relative_url }}"></script>

<!-- WebVOWL core -->
<script src="{{ '/assets/webvowl/js/parser.js' | relative_url }}"></script>
<script src="{{ '/assets/webvowl/js/options.js' | relative_url }}"></script>
<script src="{{ '/assets/webvowl/js/graph.js' | relative_url }}"></script>
<script src="{{ '/assets/webvowl/js/entry.js' | relative_url }}"></script>

<script>
document.addEventListener("DOMContentLoaded", function () {
    webvowl.app().initialize({
        canvasSelector: "#ontology-graph",
        jsonUrl: "{{ '/assets/webvowl/data/ontology.json' | relative_url }}"
    });
});
</script>
