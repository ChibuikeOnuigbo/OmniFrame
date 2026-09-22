# Context-menu dead-control report

Focused scope: commands rendered by the centralized context-menu registry.

- Commands rendered: 9 command IDs across implemented target states.
- Commands with implementations: 9.
- Placeholder/TODO/console-only commands: 0.
- Irrelevant unavailable commands are hidden, including Paste before clipboard content.
- Destructive Delete is visually separated with red treatment and uses undo-aware `removeClip`.
- Unsupported requested targets and operations are not rendered.

This is not a claim that every control in the entire application has been exhaustively audited; it records the completed context-menu command scope.
