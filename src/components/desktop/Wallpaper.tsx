export default function Wallpaper({ night }: { night: boolean }) {
  return (
    <div className={`wallpaper ${night ? 'night' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sky" x2="0" y2="1">
            <stop stopColor="#3878ae" />
            <stop offset=".65" stopColor="#95c7d2" />
            <stop offset="1" stopColor="#e6e4b5" />
          </linearGradient>
          <linearGradient id="hillBack" x1="0" y1="0" x2=".7" y2="1">
            <stop stopColor="#96b965" />
            <stop offset="1" stopColor="#618743" />
          </linearGradient>
          <linearGradient id="hillFront" x1=".2" y1="0" x2=".7" y2="1">
            <stop stopColor="#a9b954" />
            <stop offset=".35" stopColor="#73983c" />
            <stop offset="1" stopColor="#294e33" />
          </linearGradient>
          <linearGradient id="shade" x2="1" y2=".4">
            <stop stopColor="#315f3d" stopOpacity=".05" />
            <stop offset="1" stopColor="#143d34" stopOpacity=".5" />
          </linearGradient>
          <filter id="cloud">
            <feGaussianBlur stdDeviation="13" />
          </filter>
          <filter id="grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency=".65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <path fill="url(#sky)" d="M0 0h1600v1000H0z" />
        <g fill="#fffdf0" filter="url(#cloud)" opacity=".6">
          <ellipse cx="240" cy="175" rx="210" ry="28" />
          <ellipse cx="320" cy="151" rx="110" ry="40" />
          <ellipse cx="1450" cy="255" rx="235" ry="27" />
          <ellipse cx="1500" cy="228" rx="95" ry="46" />
          <ellipse cx="810" cy="330" rx="175" ry="20" />
          <ellipse cx="750" cy="308" rx="85" ry="30" />
        </g>
        <path d="M0 660Q270 490 600 625T1200 590Q1420 480 1600 520V1000H0" fill="#789b71" />
        <path d="M0 645Q390 755 760 570Q1180 340 1600 600V1000H0" fill="url(#hillBack)" />
        <path d="M0 535Q265 475 635 690Q980 875 1600 675V1000H0" fill="url(#hillFront)" />
        <path d="M0 540Q310 500 630 694Q960 880 1600 680V1000H0" fill="url(#shade)" />
        <path d="M0 545Q265 493 624 692" stroke="#c0c772" strokeWidth="2" opacity=".45" />
        <path fill="#fff" opacity=".035" filter="url(#grain)" d="M0 0h1600v1000H0z" />
      </svg>
      <div className="wallpaper-grain" />
    </div>
  );
}
