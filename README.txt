LAST LANTERN - prototype (build 1)
==================================
A dark, Lemmings-style rescue game for mobile browsers and desktop.
The mine has fallen. Trapped miners walk on their own. They follow light,
and the darkness takes anyone left too long in shadow. Get the quota
of miners to the exit lift before time runs out.

Play: open index.html (GitHub Pages serves it from the repo root).
Everything is local, with no CDN. Three.js r170 is bundled in game.js,
and textures, models and fonts are inlined in assets.js.

CONTROLS (one bottom bar)
  Lantern (Foreman): tap the tunnel to walk the Foreman there; miners near
                     his lamp follow. Tap a Blocker to release him.
  Torch / Davy lamp: tap or drag into the tunnel to place one (limited count).
                     Torches are open flame and ignite firedamp; Davy lamps are safe.
  Digger:   tap a miner to dig straight down through rock or rubble (not granite).
  Blocker:  tap a miner to make him stand and turn the crowd.
  Shorer:   tap a miner; he props up the next weak roof before its cave-in timer.
  Flare:    tap a miner to throw a flare ahead (bright, short, ignites gas
            from a safe distance, banishes shadow creatures).
  Speed 1x/2x/3x, Menu (pause, retry, level select, graphics quality).
  Pan: drag empty space.  Zoom: pinch or mouse wheel.
  Keys: 1-7 select tools, Space = pause, Esc = menu, arrows = pan.
  URL options: ?level=N starts a level directly; ?q=low|med|high sets quality.

LEVELS
  1 The Lamp Room   - tutorial: lead with the lantern, place torches. Quota 7/10.
  2 Old Workings    - dig down past a pit, hold the line with blockers. Quota 8/12.
  3 Rotten Timbers  - timed cave-ins; shore the roof before it falls. Quota 9/14.
  4 Firedamp        - gas pockets ignite near open flame; blast the rubble wall or
                      go around with safe lamps. Quota 9/14.
  5 The Hollow      - shadow creatures move only in the dark; a cavern, a granite
                      shelf and a late cave-in. Quota 10/16.
  Stars: thresholds per level are in source/src/levels.js (e.g. L1: 7/9/10). Best stars are
  stored in localStorage.

SOURCE
  source/ holds the unbundled modules (sim, renderer, levels), the build scripts
  and the headless tests. Rebuild with source/build.sh (needs three, esbuild).
  tests/solve.mjs plays scripted solutions for all five levels in Node.
