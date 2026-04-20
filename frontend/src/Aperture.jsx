// Fintrest — Aperture Mark (React component)
// Geometry is locked in fintrest-aperture-spec.md §1.
// Do not edit path `d`, rotation angles, or viewBox without updating the spec.
//
// Usage:
//   <Aperture />                            → V1 solid, 40px
//   <Aperture variant="outline" size={28}/> → V2 outlined
//   <Aperture variant="glyph" size={48}/>   → V3 single blade
//   <Aperture color="#FAFAF7" background="#0F0F10" withIconBg />
//
// All variants render inside a 1024×1024 viewBox so strokes scale predictably.

import React from "react";

const BLADE_PATH =
  "M 650.56 432 L 844.55 320 A 384 384 0 0 0 512 128 C 540 220, 580 280, 512 352 Z";

const ROTATIONS = [0, 60, 120, 180, 240, 300];

function Aperture({
  variant = "solid",       // "solid" | "outline" | "glyph"
  size = 40,
  color = "#FAFAF7",
  background = "transparent",
  withIconBg = false,       // wraps the mark in the 229-radius squircle at 1024 scale
  strokeWidth = 12,         // only used by "outline" — calibrated for the 1024 viewBox
  title = "Fintrest",
  ...rest
}) {
  const bg = withIconBg ? (
    <rect width="1024" height="1024" rx="229" ry="229" fill={background} />
  ) : background !== "transparent" ? (
    <rect width="1024" height="1024" fill={background} />
  ) : null;

  let marks = null;
  if (variant === "glyph") {
    // Single blade rotated to the 150° position (per spec V3)
    marks = (
      <path d={BLADE_PATH} fill={color} transform="rotate(120 512 512)" />
    );
  } else if (variant === "outline") {
    marks = (
      <g
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="miter"
        strokeMiterlimit="4"
      >
        {ROTATIONS.map((angle) => (
          <path
            key={angle}
            d={BLADE_PATH}
            transform={angle === 0 ? undefined : `rotate(${angle} 512 512)`}
          />
        ))}
      </g>
    );
  } else {
    // solid
    marks = (
      <g fill={color}>
        {ROTATIONS.map((angle) => (
          <path
            key={angle}
            d={BLADE_PATH}
            transform={angle === 0 ? undefined : `rotate(${angle} 512 512)`}
          />
        ))}
      </g>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      {...rest}
    >
      <title>{title}</title>
      {bg}
      {marks}
    </svg>
  );
}

export default Aperture;
