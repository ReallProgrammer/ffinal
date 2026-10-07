import { useId } from 'react';
import type { IconName } from '../types';
export default function Icon({
  name,
  size = 32,
  className = '',
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const blue = `url(#${id}b)`,
    cream = `url(#${id}c)`,
    gold = `url(#${id}g)`,
    green = `url(#${id}v)`;
  let art;
  switch (name) {
    case 'computer':
      art = (
        <>
          <path d="M8 4h33v28H8z" fill={cream} stroke="#455563" strokeWidth="1.5" />
          <path d="M11 7h27v20H11z" fill="#213c71" />
          <path d="M13 9h23v16H13z" fill={blue} />
          <path d="M13 23l8-9 7 5 8-7v13H13" fill="#81be5c" />
          <path d="M19 32h11v5H19zM5 37h38v7H5z" fill={cream} stroke="#526272" />
          <path d="M9 39h18m-18 2h18" stroke="#9ca9ad" />
          <path d="M35 40h4" stroke="#65a863" strokeWidth="2" />
          <path d="M37 28h2" stroke="#53ab49" />
        </>
      );
      break;
    case 'folder':
    case 'documents':
      art = (
        <>
          <path d="M4 11h17l4 5h18v25H4z" fill="#c48919" stroke="#98681c" />
          <path d="M6 12h14l4 5h17v21H6z" fill={gold} />
          {name === 'documents' && (
            <>
              <path d="M14 5h17l7 7v22H14z" fill="#fffdf2" stroke="#7c8e9b" />
              <path
                d="M31 5v7h7M19 16h14m-14 5h14m-14 5h10"
                fill="none"
                stroke="#8aabd3"
                strokeWidth="1.8"
              />
            </>
          )}
          <path d="M5 23h40l-5 19H3z" fill={gold} stroke="#b38226" />
          <path d="M7 25h34" stroke="#fff3b0" />
        </>
      );
      break;
    case 'globe':
      art = (
        <>
          <circle cx="25" cy="24" r="18" fill={blue} stroke="#256190" />
          <path d="M17 8l1 8-7 4 4 6 7 1 1 9 5 4 4-9-5-7 7-3 6-6-8-5z" fill="#74b883" />
          <ellipse
            cx="24"
            cy="24"
            rx="24"
            ry="8"
            fill="none"
            stroke="#eab544"
            strokeWidth="3.5"
            transform="rotate(-32 24 24)"
          />
          <path d="M12 12q8-8 17-5" fill="none" stroke="#d5f4ff" strokeWidth="2" />
          <path d="M40 11l3 9-9-1" fill="#f5cc56" />
        </>
      );
      break;
    case 'terminal':
      art = (
        <>
          <path d="M3 7h42v33H3z" fill="#dddccf" stroke="#344454" />
          <path d="M5 9h38v6H5z" fill={blue} />
          <path d="M5 16h38v21H5z" fill="#142127" />
          <path d="M10 21l5 4-5 4m9 1h8" fill="none" stroke="#f4f7ee" strokeWidth="2" />
          <path d="M36 11h4" stroke="#fff" />
        </>
      );
      break;
    case 'recycle':
      art = (
        <>
          <path
            d="M10 12l4 31h23l4-31"
            fill="#dcebe4"
            fillOpacity=".85"
            stroke="#607982"
            strokeWidth="1.5"
          />
          <ellipse cx="25" cy="12" rx="16" ry="6" fill="#e4eeee" stroke="#607982" />
          <ellipse cx="25" cy="12" rx="12" ry="3" fill="#728c8a" />
          <path d="M17 19l2 19m6-19v20m8-20l-2 19" stroke="#98b5ba" />
          <path
            d="M24 23l4 6h-7l3-6m-5 5l-3 6 6 1m9-6l3 6-7 1"
            fill="none"
            stroke="#2e9c62"
            strokeWidth="2.5"
          />
        </>
      );
      break;
    case 'notepad':
    case 'file':
      art = (
        <>
          <path d="M10 5h24l6 7v31H10z" fill="#f7fcf5" stroke="#67889b" strokeWidth="1.5" />
          <path d="M34 5v8h6" fill="#c3dbe6" stroke="#67889b" />
          <path
            d="M15 17h19m-19 5h19m-19 5h19m-19 5h14m-14 5h16"
            stroke="#9dbace"
            strokeWidth="1.3"
          />
          {name === 'notepad' && (
            <>
              <path d="M7 6h5v36H7z" fill="#3d80ad" />
              <path d="M6 11h8m-8 7h8m-8 7h8m-8 7h8m-8 7h8" stroke="#d0e9f6" strokeWidth="2" />
              <path d="M36 23l4 2-8 18-4 2v-5z" fill="#eac763" stroke="#9d793d" />
            </>
          )}
        </>
      );
      break;
    case 'calculator':
      art = (
        <>
          <rect x="9" y="3" width="31" height="42" rx="3" fill={cream} stroke="#476777" />
          <path d="M13 8h23v9H13z" fill="#aec1a3" stroke="#67806f" />
          <path d="M27 10h6v4h-6" fill="none" stroke="#405441" />
          <path
            d="M13 22h5v5h-5zm9 0h5v5h-5zm9 0h5v5h-5zM13 31h5v5h-5zm9 0h5v5h-5zm-9 8h14v3H13z"
            fill="#6485a8"
          />
          <path d="M31 31h5v11h-5z" fill="#bb674c" />
        </>
      );
      break;
    case 'settings':
      art = (
        <>
          <rect x="4" y="10" width="39" height="29" rx="2" fill={cream} stroke="#587283" />
          <path d="M7 13h33v6H7z" fill={blue} />
          <circle cx="28" cy="30" r="9" fill="#7596ad" stroke="#395c76" strokeWidth="3" />
          <circle cx="28" cy="30" r="3" fill="#d8e6e9" />
          <path
            d="M28 17v6m0 14v6M15 30h6m14 0h7M19 21l4 4m10 10l4 4m0-18l-4 4m-10 10l-4 4"
            stroke="#395c76"
            strokeWidth="4"
          />
          <path d="M10 24h6m-6 6h4" stroke="#43a85c" strokeWidth="3" />
        </>
      );
      break;
    case 'drive':
      art = (
        <>
          <path d="M8 13h31l6 21H3z" fill={cream} stroke="#596d7c" />
          <path d="M3 34h42v9H3z" fill="#c3c9c5" stroke="#596d7c" />
          <path d="M9 36h22v4H9z" fill="#717f86" />
          <path d="M36 38h5" stroke="#59b55f" strokeWidth="2" />
          <ellipse cx="24" cy="23" rx="10" ry="6" fill="#a5b4b7" />
          <circle cx="24" cy="23" r="2" fill="#5e7683" />
        </>
      );
      break;
    case 'user':
      art = (
        <>
          <rect x="5" y="5" width="38" height="38" rx="4" fill={blue} stroke="#376795" />
          <circle cx="24" cy="19" r="8" fill="#fff2c9" />
          <path d="M10 40c1-16 27-16 28 0" fill="#f4e4b7" />
          <path d="M10 8h27" stroke="#a6d9ff" />
        </>
      );
      break;
    case 'mail':
      art = (
        <>
          <path d="M4 12h40v29H4z" fill="#fff5cb" stroke="#8f855c" />
          <path
            d="M5 13l19 17 19-17M5 40l14-15m24 15L29 25"
            fill="none"
            stroke="#bbaa70"
            strokeWidth="1.5"
          />
          <path d="M28 6h16v12H28z" fill={blue} stroke="#fff" strokeWidth="2" />
        </>
      );
      break;
    case 'search':
      art = (
        <>
          <circle
            cx="21"
            cy="19"
            r="13"
            fill="#b9e7f1"
            fillOpacity=".8"
            stroke="#65879a"
            strokeWidth="4"
          />
          <path d="M31 30l12 13" stroke="#3c658b" strokeWidth="8" />
          <path d="M14 15q3-6 9-4" fill="none" stroke="#fff" strokeWidth="3" />
        </>
      );
      break;
    case 'game':
      art = (
        <>
          <path d="M11 14h26l7 22-5 5-12-9h-6L9 41l-5-5z" fill={cream} stroke="#587082" />
          <path d="M14 19v12m-6-6h12" stroke="#354958" strokeWidth="4" />
          <circle cx="33" cy="22" r="3" fill="#ce6b54" />
          <circle cx="37" cy="29" r="3" fill="#5796c9" />
        </>
      );
      break;
    case 'certificate':
      art = (
        <>
          <path d="M5 7h37v30H5z" fill="#fff5d5" stroke="#b89854" />
          <path d="M10 12h27v20H10z" fill="none" stroke="#d4be80" />
          <path d="M14 17h19m-19 5h15" stroke="#979579" />
          <path d="M27 29l-3 16 7-4 6 4-3-16" fill="#bd584a" />
          <circle cx="30" cy="29" r="7" fill={gold} stroke="#b6882e" />
        </>
      );
      break;
    case 'power':
      art = (
        <>
          <rect x="6" y="6" width="36" height="36" rx="5" fill="#d7754c" stroke="#ab402e" />
          <path d="M24 12v14m-7-10a12 12 0 1 0 14 0" fill="none" stroke="#fff1d5" strokeWidth="3" />
        </>
      );
      break;
    default:
      art = <circle cx="24" cy="24" r="18" fill={green} />;
  }
  return (
    <svg
      aria-hidden="true"
      className={`retro-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
    >
      <defs>
        <linearGradient id={`${id}b`} x2=".4" y2="1">
          <stop stopColor="#84caf2" />
          <stop offset="1" stopColor="#226cbb" />
        </linearGradient>
        <linearGradient id={`${id}c`} x2=".6" y2="1">
          <stop stopColor="#f6f5e5" />
          <stop offset="1" stopColor="#b5c0ba" />
        </linearGradient>
        <linearGradient id={`${id}g`} x2=".2" y2="1">
          <stop stopColor="#ffe89b" />
          <stop offset="1" stopColor="#e5b844" />
        </linearGradient>
        <linearGradient id={`${id}v`} x2=".4" y2="1">
          <stop stopColor="#b7d982" />
          <stop offset="1" stopColor="#568955" />
        </linearGradient>
      </defs>
      {art}
    </svg>
  );
}
