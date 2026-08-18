/**
 * Authored icons, one consistent 2px stroke on a 48px grid.
 *
 * Every stroke is a <path> rather than a <rect>/<circle> so that pathLength="1"
 * is reliable everywhere: it normalises each stroke to a length of 1, which
 * lets the draw-on run off a plain 0-1 progress value with no measuring.
 *
 * data-delay staggers the strokes so the mark builds in the order someone would
 * actually draw it. data-pop marks the filled nodes, which scale in instead.
 */

/** Research: a brief under a magnifier. */
function ResearchIcon() {
  return (
    <svg className="beat__icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {/* the document */}
      <path
        data-draw
        data-delay="0"
        pathLength="1"
        d="M9.5 5H24.5A2.5 2.5 0 0 1 27 7.5V32.5A2.5 2.5 0 0 1 24.5 35H9.5A2.5 2.5 0 0 1 7 32.5V7.5A2.5 2.5 0 0 1 9.5 5Z"
      />
      {/* what is written on it */}
      <path data-draw data-delay="0.16" pathLength="1" d="M12 13H22" />
      <path data-draw data-delay="0.24" pathLength="1" d="M12 19H22" />
      <path data-draw data-delay="0.32" pathLength="1" d="M12 25H18" />
      {/* the lens */}
      <path data-draw data-delay="0.42" pathLength="1" d="M39 30A9 9 0 1 1 21 30A9 9 0 1 1 39 30Z" />
      <path data-draw data-delay="0.68" pathLength="1" d="M36.4 36.4L42 42" />
    </svg>
  )
}

/** Evidence: plotted results against an axis. */
function EvidenceIcon() {
  return (
    <svg className="beat__icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {/* the axis */}
      <path data-draw data-delay="0" pathLength="1" d="M9 8V38H41" />
      {/* the trend */}
      <path data-draw data-delay="0.18" pathLength="1" d="M14 31L22 24L30 28L38 14" />
      {/* the readings */}
      <circle data-pop data-delay="0.54" cx="22" cy="24" r="2.4" />
      <circle data-pop data-delay="0.64" cx="30" cy="28" r="2.4" />
      <circle data-pop data-delay="0.74" cx="38" cy="14" r="2.4" />
    </svg>
  )
}

const ICONS = {
  research: ResearchIcon,
  evidence: EvidenceIcon,
}

export function BeatIcon({ name }) {
  const Icon = ICONS[name]
  return Icon ? <Icon /> : null
}
