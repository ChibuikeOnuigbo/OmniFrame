# Templates

Templates are structured data, not screenshots. A template has duration, ratio, slots, tracks, animation/effect references, optional 3D scene, fonts, constraints and render settings.

Slots declare VIDEO, IMAGE, AUDIO, TEXT, COLOR, 3D_MODEL, TEXTURE, HDRI, FONT, MASK or LUT. Validation checks MIME/type, dimensions, duration, required slots, fonts, effects and 3D compatibility. A 3D model slot rejects a PNG unless `allowImagePlane` is explicitly declared.

Slot replacement preserves clip timing, transform relationships, typography hierarchy, effects and layout constraints. Fit modes include cover, contain, crop, subject-fit, focal-point and alignment modes.
