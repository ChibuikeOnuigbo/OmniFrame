# Drive pack — Krita WINDOW/INTERFACE screenshots catalog (identified by Drive OCR, 2026-10-26)
User clarification: the Krita shots are NOT named 'krita' — they are window/interface screenshots.
Identification method: Drive fullText OCR for Krita UI strings ('krita', 'Brush Presets', 'Tool Options').
| file | id | bytes | modified | OCR evidence |
|---|---|---|---|---|
| Screenshot (107).png | 1asCtL2P3Upru5mIaXc6M8Sb5J_WswZnz | 553,583 | 2026-10-15 | 'krita' + 'Brush Presets' + 'Tool Options' — full window w/ brush-preset docker |
| Screenshot (108).png | 1QiryYt7FjCer5fV8xZ1xwe4hlepMoc26 | 249,966 | 2026-10-16 | same session as 107 (no OCR hit — likely cropped canvas) |
| Screenshot (41).png | 10oM2Z57KN-S7uszxhfQDQj-qymOHgRSk | 319,666 | 2026-05-01 | 'Tool Options' docker |
| Screenshot (40).png | 1ZF2jz6M-Un-C_rm0tGX_F7qf3_PgvZnr | 494,392 | 2026-05-01 | 'Tool Options' docker |
| Screenshot (39).png | 1KLWSl5Ev71SF7G1gprGUKU5ttJ5D-sVm | 487,574 | 2026-05-01 | 'Tool Options' docker |
| Screenshot (34).png | 1vBHhTDFws-rUKMQa3JUnu_qUCLjTTqh4 | 355,348 | 2026-03-07 | 'Tool Options' docker |
| Screenshot (29).png | 1kuFshTkXnNra7LUsLUO_yD-YDol9vIF- | 806,383 | 2026-01-25 | 'Tool Options' docker |
| Screenshot (16).png | 1jHQkQhXkt2TW30MC4Y8Up5vJ34l9oWY9 | 383,370 | 2025-12-22 | 'Tool Options' docker |
| Screenshot (14).png | 1j_snXYmqDIBFIkL_hvJ52ueeNh95cUHJ | 427,647 | 2025-10-09 | 'Tool Options' docker |
All 1920x1280 desktop captures (imageMediaMetadata). Folder: pack_data (1EJchvF8g7_aiBgDO5Z0SBpnm0adSGPwQ).

## Hard sandbox limit (stated honestly, not worked around)
The Drive connector returns binary ONLY as inline base64 in the tool result: (107) = ~738k chars
(~185k tokens), (41) = ~426k chars (~110k tokens) — pulling any one full-res file would exhaust the
session context, and persisting it would cost the same again in output tokens. Thumbnail endpoints
return HTTP 500 to the page fetcher; bash outbound is allowlist-restricted (no google hosts).
Therefore: catalogued with ids + OCR evidence here; vision references used instead are
web-harvested Krita window imagery: images/boardN-krita-window-dockers.png (krita-artists.org window
with dockers), images/boardN-krita-tool-options-docker.png (Tool Options docker), plus
images/boardM-krita-*.png and the official docs scan (krita-tools.html).
Options recorded for the user: (a) dedicate one turn to a single full-res pull of a chosen number,
(b) re-export a compressed (<100 KB) copy into Drive and it can be pulled cheaply, (c) proceed on
catalog + docs imagery (current path).
