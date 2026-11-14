LAST LANTERN - prototype, build 3 (side-on Lemmings-style rework)
=================================================================
Play: https://runningtarget11.github.io/last-lantern/   (?level=N opens level N)

A collapsed mine, shown side-on as a cutaway. Miners drop from a hatch and walk on
their own: they turn at walls, fall off ledges, and die if they fall too far.
Give them skills so enough of them reach the lift cage before time runs out.
Darkness is the twist: an unlit miner in a dark seam is taken by the shadows.

SKILLS (bottom bar, limited counts per level)
  1 Climber   permanent - scales vertical walls
  2 Floater   permanent - opens a canvas sack and drifts down safely
  3 Blaster   5-second fuse, blows a crater (not through steel)
  4 Blocker   stands with arms out and turns others back (tap him again with
              Blocker selected to release him, free)
  5 Builder   lays 12 timber planks as a rising stair
  6 Basher    tunnels horizontally
  7 Miner     tunnels diagonally downward
  8 Digger    digs straight down
  9 Lamp      permanent - carries a lantern that lights the way for nearby miners
  0 Torch     plant a torch on the ground (tap the spot)
  Riveted steel plate cannot be dug, bashed, mined or blasted.

CONTROLS
  Touch: tap a skill, then tap a miner (generous hit area; the targeted miner gets
         brass corner brackets). Drag to pan, pinch to zoom, tap the minimap to jump.
  Desktop: click skill / miner, keys 1-0 pick skills, wheel zooms, drag or arrows pan,
         P/Space pause, F fast-forward, N nuke (press twice), -/+ release rate, Esc menu.
  Bar: release rate -/+, pause, fast-forward (3x), nuke, menu. HUD: out, saved/quota, timer.
  Works in portrait and landscape.

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
