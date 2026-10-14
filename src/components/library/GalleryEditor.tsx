import type { LibraryBook, LibraryRepository } from '../../lib/library/types';
import UploadField from './UploadField';
import CollectionThumbnail from './CollectionThumbnail';
export default function GalleryEditor({
  item,
  repository,
  onChange,
  onBusy,
  busy,
}: {
  item: LibraryBook;
  repository: LibraryRepository;
  onChange: (item: LibraryBook) => void;
  onBusy: (busy: boolean) => void;
  busy: boolean;
}) {
  const pictures = item.gallery || [];
  const move = (index: number, offset: number) => {
    const next = [...pictures];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange({ ...item, gallery: next });
  };
  return (
    <fieldset disabled={busy} className="collection-photo-editor">
      <legend>Photo gallery</legend>
      <p>
        Add gameplay, illustrations or collection photos. These pictures are separate from the case
        artwork. Up to 20 images.
      </p>
      <UploadField
        item={item}
        repository={repository}
        kind="gallery"
        label="gallery photo"
        disabled={busy || pictures.length >= 20}
        onBusy={onBusy}
        onCrop={() => {}}
        onChange={(asset) => {
          if (asset) onChange({ ...item, gallery: [...pictures, asset] });
        }}
      />
      <ol className="collection-photo-list">
        {pictures.map((asset, index) => (
          <li key={asset.id}>
            <CollectionThumbnail id={asset.id} repository={repository} color={item.color} />
            <span>{asset.filename}</span>
            <div>
              <button
                type="button"
                aria-label={`Move photo ${index + 1} earlier`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ←
              </button>
              <button
                type="button"
                aria-label={`Move photo ${index + 1} later`}
                disabled={index === pictures.length - 1}
                onClick={() => move(index, 1)}
              >
                →
              </button>
              <button
                type="button"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() =>
                  onChange({ ...item, gallery: pictures.filter((a) => a.id !== asset.id) })
                }
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
    </fieldset>
  );
}
