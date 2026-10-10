import { lazy, Suspense, useState } from 'react';
import type {
  AssetKind,
  LibraryBook,
  LibraryData,
  LibraryRepository,
  Presentation,
} from '../../lib/library/types';
import { objectType } from '../../lib/library/registry';
import CropEditor from './CropEditor';
import { withArtwork } from '../../lib/library/types';
import UploadField from './UploadField';
import SurfaceStudio from './SurfaceStudio';
import WrapEditor from './WrapEditor';
import GenreEditor from './GenreEditor';
import AppearanceControls from './AppearanceControls';
import PlacementEditor from './PlacementEditor';
const BookPreview = lazy(() => import('./LibraryScene').then((m) => ({ default: m.BookPreview })));
export const defaultPresentation: Presentation = {
  frame: true,
  roughness: 0.65,
  textOverlay: false,
  scale: 1,
  rotation: [0, 0, 0],
};
export default function CollectionEditor({
  initial,
  data,
  repository,
  reduced,
  onSaved,
  onCancel,
}: {
  initial: LibraryBook;
  data: LibraryData;
  repository: LibraryRepository;
  reduced: boolean;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [uploading, setUploading] = useState(false),
    [crop, setCrop] = useState<AssetKind | null>(null),
    [background, setBackground] = useState('#e2dfd4'),
    [light, setLight] = useState(3),
    [tagsText, setTagsText] = useState((initial.tags || []).join(', '));
  const type = objectType(draft);
  const presentation = { ...defaultPresentation, ...draft.presentation };
  const appearance = (value: Partial<Presentation>) =>
    setDraft((d) => ({ ...d, presentation: { ...presentation, ...value } }));
  const surfaces = [
    ...type.surfaces,
    ...type.contents,
    ...(type.document ? ['digital'] : []),
    ...(type.id === 'model' ? ['model'] : []),
  ] as AssetKind[];
  return (
    <div className="collection-editor">
      <header>
        <div>
          <small>{type.label.toUpperCase()} / PRIVATE EDITOR</small>
          <h2>{draft.id ? 'Refine your collection.' : 'A new addition.'}</h2>
        </div>
        <button onClick={onCancel} disabled={busy || uploading}>
          Cancel
        </button>
      </header>
      {error && (
        <p role="alert" className="library-error">
          {error}
        </p>
      )}
      <div className="library-editor">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await repository.save({
                ...draft,
                presentation,
                placement: draft.placement || {
                  beforeId: draft.id
                    ? data.books
                        .filter((b) => b.shelfId === draft.shelfId && b.position > draft.position)
                        .sort((a, b) => a.position - b.position)[0]?.id || null
                    : null,
                  expectedIds: data.books
                    .filter((b) => b.shelfId === draft.shelfId && b.id !== draft.id)
                    .map((b) => b.id),
                },
              });
              await onSaved();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy || uploading}>
            <legend>Details · separate from artwork</legend>
            <label>
              Title
              <input
                aria-label="Title"
                required
                maxLength={180}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            {type.id === 'book' && (
              <label>
                Author
                <input
                  value={draft.author}
                  onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                />
              </label>
            )}
            {type.fields.map((field) => (
              <label key={field.key}>
                {field.label}
                <input
                  type={field.input}
                  maxLength={field.key === 'notes' ? 3000 : 500}
                  value={draft.details?.[field.key] || ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      details: { ...draft.details, [field.key]: e.target.value },
                    })
                  }
                />
              </label>
            ))}
            <label>
              Description
              <textarea
                maxLength={6000}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <GenreEditor
              item={draft}
              initialGenres={data.genres || []}
              repository={repository}
              onChange={setDraft}
            />
            <label>
              Tags (comma separated)
              <input
                value={tagsText}
                onChange={(e) => {
                  setTagsText(e.target.value);
                  setDraft({
                    ...draft,
                    tags: e.target.value
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean)
                      .slice(0, 20),
                  });
                }}
              />
            </label>
            {type.id === 'book' && (
              <>
                <label>
                  Book number (optional)
                  <input
                    maxLength={40}
                    value={draft.bookNumber || ''}
                    onChange={(e) => setDraft({ ...draft, bookNumber: e.target.value })}
                  />
                </label>
                <label>
                  Book order (optional)
                  <input
                    type="number"
                    min={0}
                    value={draft.bookOrder ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        bookOrder: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </label>
              </>
            )}
            {type.category !== 'certificates' && (
              <label>
                Release / publication year
                <input
                  type="number"
                  min={1}
                  max={2200}
                  value={draft.year || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, year: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </label>
            )}
            {type.id === 'book' && (
              <label>
                ISBN
                <input
                  value={draft.isbn}
                  onChange={(e) => setDraft({ ...draft, isbn: e.target.value })}
                />
              </label>
            )}
          </fieldset>
          <fieldset disabled={busy}>
            <legend>Artwork & files</legend>
            <p>
              Drop an image onto its surface. Originals stay private. Images fill the surface
              without stretching; adjust the crop to protect important content.
            </p>
            {type.surfaces.includes('spine') && (
              <WrapEditor
                blocked={uploading}
                item={draft}
                repository={repository}
                onChange={setDraft}
                onBusy={setUploading}
              />
            )}
            {surfaces.map((kind) => (
              <UploadField
                key={kind}
                disabled={uploading}
                item={draft}
                kind={kind}
                repository={repository}
                onChange={(asset) => setDraft((d) => withArtwork(d, kind, asset))}
                onCrop={() => setCrop(kind)}
                onBusy={setUploading}
              />
            ))}
            {(type.document || type.contents.includes('manual')) && (
              <label>
                Document access
                <select
                  aria-label="Reading access"
                  value={draft.digitalAccess}
                  onChange={(e) =>
                    setDraft({ ...draft, digitalAccess: e.target.value as 'private' | 'public' })
                  }
                >
                  <option value="private">Owner only — private file</option>
                  <option value="public">Visitors may read and download when published</option>
                </select>
              </label>
            )}
          </fieldset>
          <fieldset disabled={busy || uploading}>
            <legend>Physical appearance</legend>
            <AppearanceControls item={{ ...draft, presentation }} onChange={setDraft} />
            <label>
              Material color
              <input
                type="color"
                value={draft.color}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              />
            </label>
            {(['width', 'height', 'thickness'] as const).map((key) => (
              <label key={key}>
                {key === 'thickness'
                  ? type.id === 'book'
                    ? 'Book thickness'
                    : 'Object depth'
                  : key[0].toUpperCase() + key.slice(1)}
                <input
                  type="number"
                  step=".01"
                  min={key === 'thickness' ? 0.04 : 0.4}
                  max={key === 'thickness' ? 3 : 4}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
                />
              </label>
            ))}
            <p>
              Changing dimensions also changes the recommended artwork ratios. Use Adjust crop to
              save a matching texture.
            </p>
            {type.id === 'certificate' && (
              <label>
                <input
                  type="checkbox"
                  checked={presentation.frame}
                  onChange={(e) => appearance({ frame: e.target.checked })}
                />{' '}
                Framed certificate
              </label>
            )}
            <label>
              Surface roughness
              <input
                type="range"
                min=".1"
                max="1"
                step=".05"
                value={presentation.roughness}
                onChange={(e) => appearance({ roughness: Number(e.target.value) })}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={presentation.textOverlay}
                onChange={(e) => appearance({ textOverlay: e.target.checked })}
              />{' '}
              Add title typography to artwork (optional)
            </label>
            {type.id === 'model' && (
              <>
                <label>
                  Display scale
                  <input
                    type="range"
                    min=".25"
                    max="2"
                    step=".05"
                    value={presentation.scale}
                    onChange={(e) => appearance({ scale: Number(e.target.value) })}
                  />
                </label>
                {['X', 'Y', 'Z'].map((axis, n) => (
                  <label key={axis}>
                    {axis} orientation
                    <input
                      type="number"
                      min={-180}
                      max={180}
                      value={presentation.rotation[n]}
                      onChange={(e) => {
                        const rotation = [...presentation.rotation] as [number, number, number];
                        rotation[n] = Number(e.target.value);
                        appearance({ rotation });
                      }}
                    />
                  </label>
                ))}
              </>
            )}
            <button
              type="button"
              onClick={() => {
                const [width, height, thickness] = type.dimensions;
                setDraft({ ...draft, width, height, thickness, presentation: defaultPresentation });
              }}
            >
              Reset appearance
            </button>
          </fieldset>
          {type.id !== 'model' && (
            <SurfaceStudio
              blocked={uploading}
              item={draft}
              repository={repository}
              onChange={setDraft}
              onBusy={setUploading}
            />
          )}
          <PlacementEditor item={draft} data={data} repository={repository} onChange={setDraft} />
          <label className="library-checkbox">
            <input
              type="checkbox"
              checked={draft.published}
              disabled={busy || uploading}
              onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
            />
            Published — visible to visitors
          </label>
          <button
            className="library-read-button"
            disabled={
              busy ||
              uploading ||
              !draft.title ||
              !draft.shelfId ||
              (draft.published && !(type.id === 'model' ? draft.model : draft.front))
            }
          >
            {busy ? 'Saving…' : draft.published ? 'Save & publish' : 'Save private draft'}
          </button>
        </form>
        <aside>
          <Suspense fallback={<p>Preparing preview…</p>}>
            <BookPreview
              book={draft}
              repository={repository}
              reduced={reduced}
              background={background}
              light={light}
            />
          </Suspense>
          <h3>Your artwork. In three dimensions.</h3>
          <p>
            Uploaded artwork is mapped to the object's physical surfaces. Metadata stays in the
            details panel unless you explicitly enable typography.
          </p>
          <label>
            Preview background
            <input
              type="color"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
            />
          </label>
          <label>
            Preview lighting
            <input
              type="range"
              min="1"
              max="5"
              step=".1"
              value={light}
              onChange={(e) => setLight(Number(e.target.value))}
            />
          </label>
        </aside>
      </div>
      {crop && (
        <CropEditor
          item={draft}
          surface={crop}
          repository={repository}
          onClose={() => setCrop(null)}
          onSave={(asset) => {
            setDraft(withArtwork(draft, crop, asset));
            setCrop(null);
          }}
        />
      )}
    </div>
  );
}
