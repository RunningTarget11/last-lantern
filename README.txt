LAST LANTERN - prototype, build 4 (side-on Lemmings-style, classic controls)
=================================================================
Play: https://runningtarget11.github.io/last-lantern/   (?level=N opens level N)

A collapsed mine, shown side-on as a cutaway. Miners drop from a hatch and walk on
their own: they turn at walls, fall off ledges, and die if they fall too far.
Give them skills so enough of them reach the lift cage before time runs out.
Darkness is the twist: an unlit miner in a dark seam is taken by the shadows.

SKILLS (bottom panel, classic order, count shown above each icon)
  Walk      unlimited (as NeoLemmix's Walker) - sends any stopped or busy miner walking
            again: releases a Blocker, wakes a Builder who ran out of planks, stops a
            Basher/Miner/Digger mid-task; used on a walker it turns him round.
            Stopped miners (blockers, idle builders) glow with a brass ring and a chevron.
  Climber   permanent - scales vertical walls
  Floater   permanent - opens a canvas sack and drifts down safely
  Blaster   5-second fuse, blows a crater (not through steel)
  Blocker   arms out, turns others back (tap him again with Blocker to release, free)
  Builder   lays 12 timber planks as a rising stair (assign again to keep building)
  Basher    tunnels horizontally
  Miner     tunnels diagonally downward
  Digger    digs straight down
  Lamp      permanent - carries a lantern that lights the way for nearby miners
  Torch     plant a torch on the ground (tap the spot)
  Riveted steel plate cannot be dug, bashed, mined or blasted.

CONTROLS (modelled one-for-one on DOS/Amiga Lemmings 1991, plus NeoLemmix extras)
  Panel, left to right:
    Release rate -  (shows the level's MINIMUM rate; hold to repeat)      F1
    Release rate +  (shows the CURRENT rate; hold to repeat)              F2
    Skills: Walk, Climber, Floater, Blaster, Blocker, Builder, Basher,
            Miner, Digger, Lamp, Torch                    W, F3-F10, 1-8, 9, 0
    Pause                                                 F11 / Pause / P / Space / middle click
    Nuke (armageddon) - press twice within 2.5 s          F12 / Delete (twice)
    Fast-forward 3x                                       F
    Slow motion 1/4                                       S
    Back one frame (hold = rewind)                        B or ,   (Backspace = back 1 second)
    Forward one frame (hold = repeat)                     N or .
    Menu                                                  Esc
    Left-facing only (toggle)                             hold Left arrow
    Walkers only (toggle)                                 hold Ctrl, or right-click, or long-press
    Right-facing only (toggle)                            hold Right arrow
    Retry level (tap twice on the panel)                  R (instant)
    Minimap with the viewport rectangle - tap or drag to jump there
  Status line: miner under the cursor and how many are under it (e.g. "DIGGER 1"),
    OUT, IN %, NEED %, TIME m-ss, plus PAUSED / FAST / SLOW / selection-mode flags.
  Cursor: crosshair that becomes a box over a miner (desktop); on touch the target miner
    gets brass corner brackets. Selection priority: a miner who can take the selected skill
    always wins over one who can't; busy or skilled miners win near-ties (classic rule);
    the walkers-only and facing-only modifiers filter the pick, as in NeoLemmix.
  Other keys: Up/Down arrow = next/previous skill, Shift+F1 / "_" = minimum rate,
    Shift+F2 / "+" = rate 99, -/= = rate -1/+1, Shift+arrows pan, Z/X zoom, M sound.
  Mouse: left-click assign, right-click assign to a walker only (DOS priority inversion),
    middle-click pause, wheel zoom (Shift+wheel pans), drag to pan, edge-scroll at the
    screen edges.
  Touch: tap a skill, then a miner; long-press a miner = walkers only; drag to pan; pinch
    to zoom; tap/drag the minimap. Every panel button is at least 36 px. Portrait and
    landscape both work.
  Rewind is exact: every action is logged with its tick and the deterministic simulation
  is replayed, as in NeoLemmix.

LEVELS
  1 Into the Dark   - Digger only. Dig through the floor to reach the lower gallery.
  2 Sack and Rope   - Climber + Floater. Climb a rock rib, float down the far side.
  3 Mind the Gap    - Builder + Blocker. Bridge a void, hold the crowd back while you build.
  4 Hard Rock       - Basher + Miner (+Blocker). Bash pillars, mine down past steel.
  5 The Dark Seam   - Everything + Lamp/Torch. Light a shadowed seam, bash, bridge, dig to the lift.
  All five are solved by the scripted test (source/tests/solve.mjs): 20/20, 20/20, 25/25,
  30/30, 36/40. Doing nothing saves 0 on every level; L5 without torches saves 0.

TECH
  Deterministic simulation on a destructible per-pixel terrain mask (30 ticks/s).
  Canvas 2D renderer: painted terrain from CC0 photo textures drawn through the mask with
  depth shading and lit rims, parallax back wall, a multiply light buffer with real light
  radii, additive flames, particles. Miners are pre-rendered sprite sheets of rigged 3D
  characters (side view); props are Blender Cycles renders. No pixel art.
  Source: source/ (esbuild; build.sh, build-assets.mjs, bake/ for sprite baking,
  blender/render_sprites.py for prop renders).
