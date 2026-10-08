/**
 * The process scene, described once.
 *
 * Seven stops along one scroll: the wide establishing shot, the five stations,
 * and the same wide shot again on the way out. Everything that has to agree on
 * where the camera is — the camera itself, the copy, the rail, the effects on
 * each platform — reads its numbers from here.
 *
 * World space: Y up, the line of stations running left to right along +X and
 * stepping back into the picture (−Z) as it goes, viewed from +Z.
 */

export const COLORS = {
  night: '#1c1644',
  ground: '#1d1748',
  rock: '#2a2155',
  platform: '#2f2560',
  clay: '#d9d5e4',
  lime: '#c6f23a',
  pink: '#ff3d5e',
  paper: '#f1ece1',
  ink: '#17122f',
}

/**
 * The five stations.
 *
 * The Blender export lays its platforms out along a line that faces nowhere in
 * particular, each one turned whichever way it was modelled. So each station is
 * lifted out and re-placed:
 *
 *   source    where its platform sits in the export (x, z);
 *   front     the bearing, in the export, that the station is meant to be
 *             seen from — degrees, 0 = +Z, 90 = +X. The whiteboard's face, the
 *             far side of the desk from the screens, and so on;
 *   position  where it goes in the scene;
 *   turn      how far it is then swung off square-on to the camera, so the
 *             wide shot sees each one three-quarter rather than flat.
 *
 * After that, every station has the same local frame — origin at the centre
 * of its platform, its front toward +Z — and its props and close-up shot are
 * written in that frame.
 *
 * `nodes` are the export's names for everything on the platform. AMPLIFY has
 * none: the export stops at four platforms, so that one is built in code.
 */
export const STATIONS = [
  {
    id: 'plan',
    number: '01',
    label: 'Plan',
    source: [0, 0],
    front: 17,
    position: [-6.0, 0, 4.6],
    turn: 20,
    nodes: [
      'Cube', 'Cube.001', 'Whiteboard', 'Cube.002', 'Chair_03',
      'Low poly lady.001', 'Low poly doctor lady', 'Lowpoly Male Sitting',
    ],
  },
  {
    id: 'create',
    number: '02',
    label: 'Create',
    source: [4.13, 3.86],
    front: -15,
    position: [-2.8, 0, 2.0],
    turn: 14,
    nodes: [
      'Cube.005', 'Cube.006', 'Low poly man walking', 'Low poly man dancing',
      'Large Light Bulb', 'Light Single bulb', 'Tripod',
    ],
  },
  {
    id: 'build',
    number: '03',
    label: 'Build',
    source: [1.79, 9.52],
    front: -90,
    position: [0.45, 0, -0.5],
    turn: 10,
    nodes: [
      'Cube.007', 'Cube.008', 'Lowpoly Male Standing', 'Lowpoly Male Standing.001',
      'Mcbook Laptop', 'Laptop 14 inches Aluminium',
    ],
  },
  {
    id: 'amplify',
    number: '04',
    label: 'Amplify',
    source: null,
    front: 0,
    position: [3.75, 0, -3.0],
    turn: 4,
    nodes: [],
  },
  {
    id: 'deliver',
    number: '05',
    label: 'Deliver',
    source: [3.08, 16.58],
    front: -124,
    position: [7.0, 0, -5.5],
    turn: -6,
    nodes: ['Cube.009', 'Low poly man wearing suit', 'Low poly man wearing suit.002', 'Low poly doctor woman'],
  },
]

/**
 * The close-up on a station, in its own frame: up and to the right of its
 * front, looking just left of centre so the platform sits right of the frame
 * and the copy has the left. `tweak` nudges one station's shot.
 */
function closeUp(station, tweak = {}) {
  const [x, , z] = station.position
  const turn = ((station.turn ?? 0) * Math.PI) / 180
  // Offsets are written square-on; the shot follows the station's swing.
  const rotate = ([dx, dy, dz]) => [
    x + dx * Math.cos(turn) + dz * Math.sin(turn),
    dy,
    z - dx * Math.sin(turn) + dz * Math.cos(turn),
  ]
  const eye = tweak.eye ?? [1.7, 2.5, 5.2]
  const look = tweak.look ?? [-0.95, 0.85, 0]
  return {
    station: STATIONS.indexOf(station),
    pos: rotate(eye),
    target: rotate(look),
    fov: tweak.fov ?? 30,
    // On a phone the card takes the bottom of the screen, so the platform is
    // centred and lifted into the top half instead of set off to the right.
    portrait: { pos: rotate([0.7, 3.3, 7.4]), target: rotate([0, 0.1, 0]), fov: 50 },
  }
}

/**
 * The wide shot on a phone: from behind PLAN, looking down the line, so the
 * stations climb up the screen into the distance rather than shrinking to fit
 * across it.
 */
const PORTRAIT_WIDE = { pos: [-15, 12, 16], target: [1.0, 3.4, -1.5], fov: 42 }

/**
 * Camera stops, in scroll order. `station` is the index into STATIONS the stop
 * looks at, or null for the wide shots.
 *
 * Tune with `?cam` on the URL: it swaps the rig for orbit controls and logs
 * each shot to the console in this shape.
 */
export const STOPS = [
  { id: 'overview', station: null, pos: [0.2, 9.4, 14.8], target: [-2.1, 1.1, -1.4], fov: 36, portrait: PORTRAIT_WIDE },
  { id: 'plan', ...closeUp(STATIONS[0]) },
  { id: 'create', ...closeUp(STATIONS[1]) },
  { id: 'build', ...closeUp(STATIONS[2]) },
  { id: 'amplify', ...closeUp(STATIONS[3], { eye: [1.7, 2.75, 5.6], look: [-0.95, 1.1, 0] }) },
  { id: 'deliver', ...closeUp(STATIONS[4]) },
  {
    id: 'outro',
    station: null,
    pos: [3.0, 11.4, 15.8],
    target: [-1.2, 0.6, -1.6],
    fov: 35,
    portrait: { ...PORTRAIT_WIDE, pos: [-16, 13.5, 17] },
  },
]

/** The copy that sits over each stop. Real DOM text, not geometry. */
export const COPY = [
  {
    kind: 'intro',
    kicker: 'Our process',
    lines: ['Big ideas.', 'Real output.'],
    body: 'Strategy, content, design, development and marketing, all working together to turn your vision into results.',
  },
  {
    kind: 'station',
    body: 'Every job starts at the whiteboard. Your brand, your audience and your goals, argued out into a brief that everything after it is measured against.',
  },
  {
    kind: 'station',
    body: 'Video, photography and design, shot and made in-house. Content with a reason to exist, cut for wherever your customers actually look.',
  },
  {
    kind: 'station',
    body: 'Websites and digital signage built to load fast, read clearly and convert. Modern brands for real people, and never off a template.',
  },
  {
    kind: 'station',
    body: 'Social media management and Google Ads that put the work in front of the right people, with the numbers to show it landed.',
  },
  {
    kind: 'station',
    body: 'Launch, report, refine. Fifteen years of Perth businesses that came to us for one job and stayed for the next.',
  },
  {
    kind: 'outro',
    note: ['Creative', 'Strategy', '+', 'Technology', '=', 'Real impact'],
    stamp: ['Perth', 'creative', 'agency'],
  },
]
