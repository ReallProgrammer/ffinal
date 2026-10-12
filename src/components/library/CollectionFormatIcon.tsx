import { Award, BookOpen, Boxes, CassetteTape, Disc3, Film, Gamepad2, Package } from 'lucide-react';
import { objectTypes } from '../../lib/library/registry';

export default function CollectionFormatIcon({
  typeId,
  compact = false,
}: {
  typeId?: string;
  compact?: boolean;
}) {
  const type =
    objectTypes.find((type) => type.id === typeId) ||
    objectTypes.find((type) => type.id === 'book')!;
  const Icon =
    type.geometry === 'book'
      ? BookOpen
      : type.geometry === 'certificate'
        ? Award
        : type.geometry === 'model'
          ? Boxes
          : ['cassette', 'tape'].includes(type.geometry)
            ? CassetteTape
            : ['minidisc', 'vinyl'].includes(type.geometry)
              ? Disc3
              : type.category === 'games'
                ? Gamepad2
                : ['vhs'].includes(type.geometry)
                  ? Film
                  : type.geometry === 'case'
                    ? Disc3
                    : Package;
  return (
    <span className={`collection-format-icon ${compact ? 'compact' : ''}`} aria-hidden="true">
      <Icon size={compact ? 25 : 44} strokeWidth={1.5} />
      {!compact && <span>{type.id === 'model' ? '3D MODEL' : type.id.toUpperCase()}</span>}
    </span>
  );
}
