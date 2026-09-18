import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textColor?: string;
  subtextColor?: string;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = true,
  textColor = 'text-[#483828]',
  subtextColor = 'text-[#87380F]',
  className = '',
}) => {
  const sizeMap = {
    sm: { px: 42, text: 'text-base', subtext: 'text-[9px]' },
    md: { px: 56, text: 'text-xl', subtext: 'text-[10px]' },
    lg: { px: 76, text: 'text-2xl', subtext: 'text-xs' },
    xl: { px: 110, text: 'text-3xl', subtext: 'text-sm' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-3.5 select-none ${className}`}>
      {/* SVG Emblem faithfully honoring the uploaded S V Home Products circular seal */}
      <svg
        width={currentSize.px}
        height={currentSize.px}
        viewBox="0 0 300 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 hover:scale-105 filter drop-shadow-sm"
        aria-label="S V Home Products Logo"
      >
        <defs>
          {/* Subtle warm paper parchment background gradient */}
          <radialGradient id="svParchment" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F9F4E8" />
            <stop offset="85%" stopColor="#EFE5D0" />
            <stop offset="100%" stopColor="#E2D4BA" />
          </radialGradient>

          {/* Gold metallic gradient for accents */}
          <linearGradient id="antiqueGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C9AD66" />
            <stop offset="50%" stopColor="#B69A55" />
            <stop offset="100%" stopColor="#8C7132" />
          </linearGradient>

          {/* Terracotta gradient for text and monogram */}
          <linearGradient id="terracottaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9C4315" />
            <stop offset="100%" stopColor="#782E09" />
          </linearGradient>

          {/* Path for text along curve: S V HOME PRODUCTS */}
          <path
            id="textArc"
            d="M 52,205 A 114,114 0 0,0 248,205"
            fill="none"
          />
        </defs>

        {/* Outer Warm Cream Base Disc */}
        <circle cx="150" cy="150" r="144" fill="url(#svParchment)" stroke="#D4C2A3" strokeWidth="2.5" />

        {/* Outer Terracotta Border Ring */}
        <circle cx="150" cy="150" r="138" stroke="#87380F" strokeWidth="3" fill="none" opacity="0.85" />

        {/* Inner Fine Antique Gold Ring with beaded ticks */}
        <circle cx="150" cy="150" r="131" stroke="url(#antiqueGold)" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
        <circle cx="150" cy="150" r="124" stroke="#87380F" strokeWidth="1" fill="none" opacity="0.6" />

        {/* Inner Central Framing Ring */}
        <circle cx="150" cy="150" r="88" stroke="url(#antiqueGold)" strokeWidth="2.5" fill="none" />
        <circle cx="150" cy="150" r="84" stroke="#87380F" strokeWidth="1" fill="none" opacity="0.5" />

        {/* TOP ILLUSTRATION: Traditional South Indian Clay Cooking Stove (Chulha / Hearth) & Wooden Drying Stand */}
        <g transform="translate(108, 22) scale(0.65)" id="traditional-hearth">
          {/* Mud Stove Body */}
          <path
            d="M24 45 L50 20 L94 20 L110 45 L94 72 L34 72 Z"
            fill="#B57648"
            stroke="#63391A"
            strokeWidth="2"
          />
          {/* Stove Cavity Opening */}
          <ellipse cx="64" cy="30" rx="20" ry="8" fill="#42220D" />
          {/* Burning Firewood Embers */}
          <path d="M46 54 L78 54 L62 44 Z" fill="#6E3B18" stroke="#42220D" strokeWidth="1.5" />
          <path d="M52 50 Q62 38 64 42 Q66 38 72 49 Q65 47 52 50 Z" fill="#E67E22" />
          <path d="M58 50 Q63 43 64 45 Q66 43 68 50 Z" fill="#F39C12" />

          {/* Wooden Drying Rack with Hanging Sevai / Shavige strands */}
          <g transform="translate(85, -2)">
            {/* Stand wood posts */}
            <line x1="16" y1="12" x2="16" y2="68" stroke="#63391A" strokeWidth="3" strokeLinecap="round" />
            <line x1="68" y1="12" x2="68" y2="68" stroke="#63391A" strokeWidth="3" strokeLinecap="round" />
            <line x1="12" y1="18" x2="72" y2="18" stroke="#874D23" strokeWidth="3.5" strokeLinecap="round" />
            {/* Feet */}
            <line x1="8" y1="68" x2="24" y2="68" stroke="#63391A" strokeWidth="2.5" />
            <line x1="60" y1="68" x2="76" y2="68" stroke="#63391A" strokeWidth="2.5" />
            {/* Hanging strands of homemade sevai */}
            {[22, 27, 32, 37, 42, 47, 52, 57, 62].map((x, idx) => (
              <line
                key={idx}
                x1={x}
                y1="19"
                x2={x}
                y2={48 + (idx % 3) * 5}
                stroke="#D6BD8A"
                strokeWidth="1.5"
                strokeDasharray="2 1"
              />
            ))}
          </g>
        </g>

        {/* LEFT SIDE: Hand-drawn botanical spices: Star Anise, Seeds, Peppercorns */}
        <g id="botanical-spices-left" transform="translate(18, 48) scale(0.68)">
          {/* Star Anise 1 */}
          <g transform="translate(42, 28) rotate(15) scale(0.9)">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
              <path
                key={i}
                d="M 0 0 C -4 -10, -5 -18, 0 -24 C 5 -18, 4 -10, 0 0"
                fill="#8C3B14"
                stroke="#4F1F08"
                strokeWidth="1"
                transform={`rotate(${angle})`}
              />
            ))}
            <circle cx="0" cy="0" r="4" fill="#58240A" />
          </g>

          {/* Star Anise 2 (lower) */}
          <g transform="translate(24, 76) rotate(-20) scale(0.75)">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
              <path
                key={i}
                d="M 0 0 C -4 -10, -5 -18, 0 -24 C 5 -18, 4 -10, 0 0"
                fill="#944318"
                stroke="#58240A"
                strokeWidth="1"
                transform={`rotate(${angle})`}
              />
            ))}
            <circle cx="0" cy="0" r="3.5" fill="#481B05" />
          </g>

          {/* Cumin / Coriander / Fennel Seeds */}
          <g transform="translate(18, 126)">
            {[
              { x: 10, y: 0, r: 25 },
              { x: 18, y: 12, r: 50 },
              { x: 6, y: 22, r: -15 },
              { x: 22, y: 28, r: 40 },
            ].map((seed, i) => (
              <ellipse
                key={i}
                cx={seed.x}
                cy={seed.y}
                rx="6"
                ry="2.5"
                fill="#9D7438"
                stroke="#5B401B"
                strokeWidth="0.8"
                transform={`rotate(${seed.r} ${seed.x} ${seed.y})`}
              />
            ))}
          </g>

          {/* Cluster of Black Peppercorns */}
          <g transform="translate(22, 175)">
            {[
              { cx: 6, cy: 6, r: 4.2 },
              { cx: 16, cy: 4, r: 4 },
              { cx: 10, cy: 15, r: 4.4 },
              { cx: 20, cy: 14, r: 3.8 },
              { cx: 5, cy: 24, r: 4 },
              { cx: 15, cy: 23, r: 4.2 },
            ].map((dot, i) => (
              <circle
                key={i}
                cx={dot.cx}
                cy={dot.cy}
                r={dot.r}
                fill="#2E241D"
                stroke="#1B140E"
                strokeWidth="0.8"
              />
            ))}
          </g>
        </g>

        {/* RIGHT SIDE: Hand-drawn fresh Curry Leaves sprig & Coriander Cilantro sprig */}
        <g id="botanical-leaves-right" transform="translate(210, 46) scale(0.68)">
          {/* Curry Leaf Sprig */}
          <path d="M 30 18 Q 38 60 48 105" stroke="#485B28" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          {[
            { x: 30, y: 20, r: -20, flip: false },
            { x: 34, y: 35, r: 35, flip: true },
            { x: 34, y: 48, r: -40, flip: false },
            { x: 40, y: 62, r: 42, flip: true },
            { x: 42, y: 78, r: -45, flip: false },
            { x: 46, y: 92, r: 40, flip: true },
          ].map((leaf, i) => (
            <path
              key={i}
              d="M 0 0 C 8 -5, 18 -4, 22 0 C 18 6, 8 6, 0 0"
              fill="#5A6D3A"
              stroke="#3B4A22"
              strokeWidth="1"
              transform={`translate(${leaf.x}, ${leaf.y}) rotate(${leaf.r})`}
            />
          ))}

          {/* Fresh Coriander (Cilantro) Sprig below */}
          <g transform="translate(30, 115)">
            <path d="M 12 10 Q 22 45 28 85" stroke="#5E7537" strokeWidth="2" fill="none" />
            {/* Fan-shaped lobed coriander leaves */}
            {[
              { x: 16, y: 20, s: 0.9, rot: -30 },
              { x: 26, y: 38, s: 1.1, rot: 25 },
              { x: 22, y: 58, s: 1.0, rot: -20 },
              { x: 30, y: 75, s: 0.85, rot: 30 },
            ].map((leaf, i) => (
              <g key={i} transform={`translate(${leaf.x}, ${leaf.y}) rotate(${leaf.rot}) scale(${leaf.s})`}>
                <path
                  d="M0 0 C 5 -8, 12 -9, 15 -3 C 18 -8, 24 -6, 22 0 C 26 4, 24 10, 18 10 C 14 11, 7 8, 0 0 Z"
                  fill="#748E44"
                  stroke="#475C24"
                  strokeWidth="0.9"
                />
              </g>
            ))}
          </g>
        </g>

        {/* BOTTOM: Laurel Leaves Wreath Branches framing bottom crest */}
        <g id="bottom-wreath" transform="translate(150, 246)">
          {/* Left Branch */}
          <path d="M 0 0 C -25 -2, -50 -12, -72 -28" stroke="#778750" strokeWidth="2" fill="none" />
          {[-15, -32, -48, -64].map((offset, i) => (
            <g key={i} transform={`translate(${offset}, ${i * -6.5}) rotate(${-15 - i * 8})`}>
              <ellipse cx="0" cy="0" rx="9" ry="4" fill="#74894E" stroke="#4C5E2D" strokeWidth="0.8" />
            </g>
          ))}
          {/* Right Branch */}
          <path d="M 0 0 C 25 -2, 50 -12, 72 -28" stroke="#778750" strokeWidth="2" fill="none" />
          {[15, 32, 48, 64].map((offset, i) => (
            <g key={i} transform={`translate(${offset}, ${i * -6.5}) rotate(${15 + i * 8})`}>
              <ellipse cx="0" cy="0" rx="9" ry="4" fill="#74894E" stroke="#4C5E2D" strokeWidth="0.8" />
            </g>
          ))}
          {/* Center Bow/Ribbon accent */}
          <circle cx="0" cy="0" r="3" fill="#B69A55" />
        </g>

        {/* CURVED BRAND TEXT: S V HOME PRODUCTS (Along Bottom Arc) */}
        <text
          fill="url(#terracottaGrad)"
          fontFamily="'Cormorant Garamond', 'Playfair Display', Georgia, serif"
          fontSize="21.5"
          fontWeight="700"
          letterSpacing="4.5px"
        >
          <textPath href="#textArc" startOffset="50%" textAnchor="middle">
            S V HOME PRODUCTS
          </textPath>
        </text>

        {/* CENTER MONOGRAM: Ornate Serif 'SV' */}
        <g transform="translate(150, 153)" id="monogram-sv">
          {/* Letter 'S' - Classic Serif with decorative teardrop terminal */}
          <text
            x="-56"
            y="26"
            fill="url(#terracottaGrad)"
            fontFamily="'Cormorant Garamond', 'Playfair Display', serif"
            fontSize="106"
            fontWeight="700"
            letterSpacing="-2px"
            filter="drop-shadow(1px 2px 1px rgba(72, 56, 40, 0.18))"
          >
            S
          </text>
          {/* Letter 'V' - Stately Roman serif */}
          <text
            x="-2"
            y="26"
            fill="url(#terracottaGrad)"
            fontFamily="'Cormorant Garamond', 'Playfair Display', serif"
            fontSize="106"
            fontWeight="700"
            filter="drop-shadow(1px 2px 1px rgba(72, 56, 40, 0.18))"
          >
            V
          </text>
        </g>
      </svg>

      {/* Accompanying Typographic Title */}
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-serif tracking-[0.14em] font-bold ${textColor} ${currentSize.text}`}
          >
            S V HOME PRODUCTS
          </span>
          <span
            className={`font-sans tracking-[0.22em] uppercase font-semibold text-[10px] mt-1 ${subtextColor}`}
          >
            Authentic South Indian Spices
          </span>
        </div>
      )}
    </div>
  );
};
