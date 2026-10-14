import { objectType } from '../../lib/library/registry';
import type { LibraryBook } from '../../lib/library/types';
import CollectionFormatIcon from './CollectionFormatIcon';

/** Category illustrations deliberately never use the owner's uploaded artwork. */
export default function CollectionIllustration({ item }: { item: LibraryBook }) {
  const type = objectType(item);
  const common = { viewBox: '0 0 64 72', 'aria-hidden': true as const };
  if (type.geometry === 'book')
    return (
      <svg {...common} fill="none" stroke="#344e48" strokeWidth="2.5" strokeLinejoin="round">
        <path fill="#e8e0c8" d="M12 13 46 7 54 12 54 61 20 67 12 61Z" />
        <path fill="#718a7b" d="M12 13 46 7 46 56 12 62Z" />
        <path d="M20 12v48M12 49l8-1M12 25l8-1M46 56l8 5M20 63l30-5" />
        <path fill="#faf6e6" d="m12 62 34-6 8 5-34 6Z" />
      </svg>
    );
  if (type.geometry === 'certificate')
    return (
      <svg {...common}>
        <path fill="#0002" d="M7 17h53v44H7z" />
        <path fill="#b49a56" d="M4 13h54v44H4z" />
        <path fill="#e3cf91" d="M7 16h48v38H7z" />
        <path fill="#bda364" d="M10 19h42v32H10z" />
        <path fill="none" stroke="#ad9048" d="M12 21h38v28H12z" />
      </svg>
    );
  if (type.geometry === 'model')
    return (
      <svg {...common} stroke="#fff8" strokeLinejoin="round">
        <path fill="#356b9c" d="m32 6 26 15-26 15L6 21Z" />
        <path fill="#62a5e2" d="m6 21 26 15v31L6 52Z" />
        <path fill="#91c5f5" d="m32 36 26-15v31L32 67Z" />
      </svg>
    );
  if (type.geometry === 'case')
    return (
      <svg {...common} stroke="#435a53" fill="none" strokeWidth="2" strokeLinejoin="round">
        <path fill="#d5dbcf" d="M8 10 50 6 57 12v51l-42 4-7-6Z" />
        <path fill="#f6f3e6" d="M15 15 57 12v51l-42 4Z" />
        <path d="m8 10 7 5v52M20 20l32-3M20 59l32-3" />
        <ellipse cx="36" cy="38" rx="16" ry="18" fill="#dfe5de" />
        <ellipse cx="36" cy="38" rx="5" ry="6" fill="#f6f3e6" />
        <path d="m42 24 6 4M23 47l6 5" stroke="#fff" strokeWidth="3" />
      </svg>
    );
  return <CollectionFormatIcon typeId={item.objectType} />;
}
