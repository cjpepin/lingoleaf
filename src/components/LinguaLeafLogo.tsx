
import * as React from "react";

const LinguaLeafLogo = ({ size = 56 }: { size?: number }) => (
  <div className="flex items-center gap-2 select-none" style={{ fontFamily: "Georgia, serif" }}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      className="drop-shadow-lg"
      aria-hidden="true"
    >
      <ellipse cx="30" cy="32" rx="23" ry="18" fill="#4ADE80" />
      <path d="M30 10C24 27 44 35 30 56" stroke="#166534" strokeWidth="3" strokeLinecap="round" />
      <circle cx="31" cy="15" r="6" fill="#22C55E" stroke="#166534" strokeWidth="2" />
    </svg>
    <span
      className="text-3xl font-bold text-primary"
      style={{
        letterSpacing: "-1px",
        fontFamily: "Georgia, serif"
      }}
    >
      Lingua
      <span className="text-green-500 drop-shadow-sm">Leaf</span>
    </span>
  </div>
);

export default LinguaLeafLogo;
