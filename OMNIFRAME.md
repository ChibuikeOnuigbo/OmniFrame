# Omniframe Edit

An Omniframe operation changes a visual relationship and propagates it through time. It stores source selection, range, selection/tracking method, transform, repair/composite method, confidence and correction masks as data.

For a move:

```text
tracked mask -> extract subject -> repair vacated plate -> transform subject -> composite
```

Repair methods are real: Telea fast marching/isophote continuation, diffusion, PatchMatch texture synthesis, temporal plate input and a documented fallback order. The operation is non-destructive and can be represented as one history transaction.

Supported operation data includes cut, move, duplicate, scale, rotate, skew/perspective data, fill, erase, recolour, blur, sharpen, pixelate, clone, inpaint and background replacement. Full-resolution export must resolve the same operation graph, not a screenshot of the preview.
