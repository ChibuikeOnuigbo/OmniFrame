/**
 * Built-in SHAKE PACK — the "important repeated stuff" from the TYMM corpus,
 * shipped INSIDE the app (user mandate): the 7 named shakes + Warp from
 * Shakes.xml (Alight Motion, 2560x1440 @30, ~0.693 s each) converted to real
 * engine data: FxInstance stacks on AM_FX_CATALOG ids with per-parameter
 * keyframes (the ORIGINAL keyframe values/timings, normalised t → seconds,
 * AM magnitudes scaled into engine ranges: shake2.mag×0.06→autoShake px,
 * oscillate.mag×0.18→oscillate px, exposure→brightness 1+v×0.4,
 * squeeze.strength×−0.35→pinchBulge, zoomblur3.strength×3→zoomBlur …).
 * CU9ID also carries the transform2 rig as CE transform keys (scale/rotation).
 * The AM PROJECT files themselves are NOT bundled — users import/export XML.
 * Extraction source: data_motiondesijg/alight/Shakes.json (raw AM data).
 */
import type { FxKey } from '../types'

export interface ShakePresetInstance {
  catalogId: string           // effectCatalog entry (am-* from the AM study)
  amId: string                // original Alight effect short id
  params: Record<string, number | string>
  keys?: Record<string, FxKey[]>
}
export interface ShakePreset {
  id: string
  name: string
  duration: number            // seconds (original AM layer span)
  source: string
  instances: ShakePresetInstance[]
  transformKeys?: Partial<Record<'scale' | 'rotation', FxKey[]>>
}

export const SHAKE_PRESETS: ShakePreset[] = [
  {
    "id": "shake-molob",
    "name": "MOLOB",
    "duration": 0.693,
    "instances": [
      {
        "catalogId": "am-shake2",
        "amId": "shake2",
        "params": {
          "autoShakeFreq": 10.0,
          "oscillateAngle": 90.0
        },
        "keys": {
          "autoShake": [
            {
              "t": 0.016,
              "v": 60
            },
            {
              "t": 0.238,
              "v": 0.0
            }
          ]
        }
      }
    ],
    "transformKeys": {},
    "source": "Shakes.xml (TYMM Drive corpus) \u2014 AM layer MOLOB, keyframe values verbatim-scaled"
  },
  {
    "id": "shake-warp",
    "name": "WARP",
    "duration": 0.306,
    "instances": [
      {
        "catalogId": "am-turbulentdisplace3",
        "amId": "turbulentdisplace3",
        "params": {},
        "keys": {
          "turbulent": [
            {
              "t": 0.0,
              "v": 0.46
            },
            {
              "t": 0.306,
              "v": 0.0
            }
          ]
        }
      }
    ],
    "transformKeys": {},
    "source": "Shakes.xml (TYMM Drive corpus) \u2014 AM layer WARP, keyframe values verbatim-scaled"
  },
  {
    "id": "shake-zneptune",
    "name": "ZNEPTUNE",
    "duration": 0.693,
    "instances": [
      {
        "catalogId": "am-shake",
        "amId": "shake",
        "params": {},
        "keys": {
          "autoShake": [
            {
              "t": 0.0,
              "v": 3.0
            },
            {
              "t": 0.526,
              "v": 0.0
            }
          ]
        }
      },
      {
        "catalogId": "am-swing2",
        "amId": "swing2",
        "params": {},
        "keys": {
          "oscillateFreq": [
            {
              "t": 0.0,
              "v": 1.2
            },
            {
              "t": 0.526,
              "v": 0.1
            }
          ],
          "oscillateAngle": [
            {
              "t": 0.0,
              "v": -7.0
            },
            {
              "t": 0.526,
              "v": 0.0
            }
          ]
        }
      },
      {
        "catalogId": "am-oscillate2",
        "amId": "oscillate2",
        "params": {
          "oscillateFreq": 7.9
        },
        "keys": {
          "oscillate": [
            {
              "t": 0.0,
              "v": 43.02
            },
            {
              "t": 0.168,
              "v": 0.18
            }
          ]
        }
      }
    ],
    "transformKeys": {},
    "source": "Shakes.xml (TYMM Drive corpus) \u2014 AM layer ZNEPTUNE, keyframe values verbatim-scaled"
  },
  {
    "id": "shake-flow",
    "name": "FLOW",
    "duration": 0.693,
    "instances": [
      {
        "catalogId": "am-shake2",
        "amId": "shake2",
        "params": {
          "autoShakeFreq": 16.0,
          "oscillateAngle": 45.0
        },
        "keys": {
          "autoShake": [
            {
              "t": 0.016,
              "v": 33.0
            },
            {
              "t": 0.683,
              "v": 0.0
            }
          ]
        }
      }
    ],
    "transformKeys": {},
    "source": "Shakes.xml (TYMM Drive corpus) \u2014 AM layer FLOW, keyframe values verbatim-scaled"
  },
  {
    "id": "shake-nanimalo",
    "name": "NANIMALO",
    "duration": 0.693,
    "instances": [
      {
        "catalogId": "am-shake2",
        "amId": "shake2",
        "params": {
          "oscillateAngle": 0.0
        },
        "keys": {
          "autoShake": [
            {
              "t": 0.02,
              "v": 18.0
            },
            {
              "t": 0.693,
              "v": 0.0
            }
          ],
          "autoShakeFreq": [
            {
              "t": 0.0,
              "v": 16.0
            },
            {
              "t": 0.693,
              "v": 0.0
            }
          ]
        }
      },
      {
        "catalogId": "am-turbulentdisplace3",
        "amId": "turbulentdisplace3",
        "params": {},
        "keys": {
          "turbulent": [
            {
              "t": 0.016,
              "v": 1
            },
            {
              "t": 0.693,
              "v": 0.0
            }
          ]
        }
      },
      {
        "catalogId": "am-oscillate3",
        "amId": "oscillate3",
        "params": {
          "oscillateAngle": 0.0,
          "oscillateFreq": 4.0
        },
        "keys": {
          "oscillate": [
            {
              "t": 0.0,
              "v": 27.0
            },
            {
              "t": 0.693,
              "v": 0.0
            }
          ]
        }
      },
      {
        "catalogId": "am-randomdisplace",
        "amId": "randomdisplace",
        "params": {
          "glitchStyle": "block"
        },
        "keys": {
          "glitch": [
            {
              "t": 0.02,
              "v": 0.5
            },
            {
              "t": 0.347,
              "v": 0.0
            }
          ]
        }
      },
      {
        "catalogId": "am-fractalwarp4",
        "amId": "fractalwarp4",
        "params": {},
        "keys": {
          "waveWarp": [
            {
              "t": 0.0,
              "v": 11.5
            },
            {
              "t": 0.693,
              "v": 0.0
            }
          ]
        }
      },
      {
        "catalogId": "am-oscillate3",
        "amId": "oscillate3",
        "params": {
          "oscillateFreq": 1.83
        },
        "keys": {
          "oscillateAngle": [
            {
              "t": 0.0,
              "v": -43.8
            },
            {
              "t": 0.693,
              "v": 41.9
            }
          ],
          "oscillate": [
            {
              "t": 0.0,
              "v": 9.0
            },
            {
              "t": 0.693,
              "v": 0.9
            }
          ]
        }
      },
      {
        "catalogId": "am-exposure",
        "amId": "exposure",
        "params": {},
        "keys": {
          "brightness": [
            {
              "t": 0.0,
              "v": 1.4
            },
            {
              "t": 0.388,
              "v": 1.0
            },
            {
              "t": 0.693,
              "v": 1.4
            }
          ]
        }
      }
    ],
    "transformKeys": {},
    "source": "Shakes.xml (TYMM Drive corpus) \u2014 AM layer NANIMALO, keyframe values verbatim-scaled"
  },
  {
    "id": "shake-random",
    "name": "RANDOM",
    "duration": 0.693,
    "instances": [
      {
        "catalogId": "am-shake2",
        "amId": "shake2",
        "params": {},
        "keys": {
          "autoShake": [
            {
              "t": 0.0,
              "v": 57.78
            },
            {
              "t": 0.078,
              "v": 0.0
            }
          ],
          "autoShakeFreq": [
            {
              "t": 0.0,
              "v": 11.49
            },
            {
              "t": 0.078,
              "v": 2.0
            }
          ],
          "oscillateAngle": [
            {
              "t": 0.0,
              "v": 0.0
            },
            {
              "t": 0.28,
              "v": 45.0
            }
          ]
        }
      },
      {
        "catalogId": "am-shake2",
        "amId": "shake2",
        "params": {
          "oscillateAngle": 0.0
        },
        "keys": {
          "autoShake": [
            {
              "t": 0.0,
              "v": 57.78
            },
            {
              "t": 0.078,
              "v": 0.0
            }
          ],
          "autoShakeFreq": [
            {
              "t": 0.0,
              "v": 11.49
            },
            {
              "t": 0.078,
              "v": 2.0
            }
          ]
        }
      },
      {
        "catalogId": "am-exposure",
        "amId": "exposure",
        "params": {},
        "keys": {
          "brightness": [
            {
              "t": 0.0,
              "v": 1.24
            },
            {
              "t": 0.413,
              "v": 1.0
            }
          ]
        }
      },
      {
        "catalogId": "am-lensd",
        "amId": "lensd",
        "params": {},
        "keys": {
          "chromatic": [
            {
              "t": 0.0,
              "v": 12.32
            },
            {
              "t": 0.693,
              "v": 0.0
            }
          ]
        }
      }
    ],
    "transformKeys": {},
    "source": "Shakes.xml (TYMM Drive corpus) \u2014 AM layer RANDOM, keyframe values verbatim-scaled"
  },
  {
    "id": "shake-jelly",
    "name": "JELLY",
    "duration": 0.693,
    "instances": [
      {
        "catalogId": "am-stretch2",
        "amId": "stretch2",
        "params": {},
        "keys": {
          "pixelStretch": [
            {
              "t": 0.0,
              "v": 0.35
            },
            {
              "t": 0.693,
              "v": 0.0
            }
          ]
        }
      },
      {
        "catalogId": "am-oscillate3",
        "amId": "oscillate3",
        "params": {
          "oscillateAngle": 90.0,
          "oscillateFreq": 2.0
        },
        "keys": {
          "oscillate": [
            {
              "t": 0.0,
              "v": 119.88
            },
            {
              "t": 0.142,
              "v": 0.0
            }
          ]
        }
      }
    ],
    "transformKeys": {},
    "source": "Shakes.xml (TYMM Drive corpus) \u2014 AM layer JELLY, keyframe values verbatim-scaled"
  },
  {
    "id": "shake-cu9id",
    "name": "CU9ID",
    "duration": 0.693,
    "instances": [
      {
        "catalogId": "am-squeeze",
        "amId": "squeeze",
        "params": {},
        "keys": {
          "pinchBulge": [
            {
              "t": -0.024,
              "v": -0.7
            },
            {
              "t": 0.578,
              "v": -0.0
            },
            {
              "t": 0.693,
              "v": 0.175
            }
          ]
        }
      },
      {
        "catalogId": "am-shake2",
        "amId": "shake2",
        "params": {
          "autoShakeFreq": 2.0,
          "oscillateAngle": 90.0
        },
        "keys": {
          "autoShake": [
            {
              "t": 0.0,
              "v": 60
            },
            {
              "t": 0.3,
              "v": 0.0
            }
          ]
        }
      },
      {
        "catalogId": "am-zoomblur3",
        "amId": "zoomblur3",
        "params": {},
        "keys": {
          "zoomBlur": [
            {
              "t": 0.0,
              "v": 0.9
            },
            {
              "t": 0.115,
              "v": 0.0
            },
            {
              "t": 0.578,
              "v": 0.0
            },
            {
              "t": 0.693,
              "v": 0.9
            }
          ]
        }
      }
    ],
    "transformKeys": {
      "scale": [
        {
          "t": 0.0,
          "v": 1.3
        },
        {
          "t": 0.347,
          "v": 1.0
        },
        {
          "t": 0.693,
          "v": 1.0
        },
        {
          "t": 0.693,
          "v": 1.3
        }
      ],
      "rotation": [
        {
          "t": 0.0,
          "v": 30.0
        },
        {
          "t": 0.693,
          "v": 0.0
        }
      ]
    },
    "source": "Shakes.xml (TYMM Drive corpus) \u2014 AM layer CU9ID, keyframe values verbatim-scaled"
  }
]

export const shakePresetById = (id: string): ShakePreset | undefined =>
  SHAKE_PRESETS.find((p) => p.id === id || p.name.toLowerCase() === id.toLowerCase())
