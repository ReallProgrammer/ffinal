import type { LibraryBook, Presentation } from '../../lib/library/types';
import { objectType } from '../../lib/library/registry';
import { casePresets, framePresets, presetPresentation } from '../../lib/library/presets';
export default function AppearanceControls({
  item,
  onChange,
}: {
  item: LibraryBook;
  onChange: (item: LibraryBook) => void;
}) {
  const p = item.presentation!,
    type = objectType(item),
    set = (value: Partial<Presentation>) => onChange({ ...item, presentation: { ...p, ...value } });
  return (
    <>
      {type.geometry === 'case' && (
        <>
          <label>
            Case preset
            <select
              value={p.casePreset || type.casePreset}
              onChange={(e) => {
                const preset = casePresets.find((v) => v.id === e.target.value)!;
                onChange({
                  ...item,
                  width: preset.dimensions[0],
                  height: preset.dimensions[1],
                  thickness: preset.dimensions[2],
                  presentation: { ...p, ...presetPresentation(preset.id) },
                });
              }}
            >
              {casePresets.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Plastic color
            <input
              type="color"
              value={p.caseColor || item.color}
              onChange={(e) => set({ caseColor: e.target.value })}
            />
          </label>
          {(['plasticOpacity', 'plasticRoughness', 'openAngle'] as const).map((key) => (
            <label key={key}>
              {key === 'openAngle'
                ? 'Opening angle'
                : key === 'plasticOpacity'
                  ? 'Plastic opacity'
                  : 'Plastic roughness'}
              <input
                type="range"
                min={key === 'openAngle' ? 75 : 0.12}
                max={key === 'openAngle' ? 165 : key === 'plasticRoughness' ? 0.8 : 1}
                step={key === 'openAngle' ? 1 : 0.02}
                value={p[key] ?? (key === 'openAngle' ? 125 : 0.8)}
                onChange={(e) => set({ [key]: Number(e.target.value) })}
              />
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={Boolean(p.includeDisc)}
              onChange={(e) => set({ includeDisc: e.target.checked })}
            />{' '}
            Include {p.casePreset === 'cassette-clear' ? 'cassette' : 'disc'} inside the case
          </label>
          <p>Click the case or use Open case to inspect its interior.</p>
        </>
      )}
      {type.geometry === 'certificate' && p.frame && (
        <>
          <label>
            Frame style
            <select
              value={p.frameStyle || 'gold'}
              onChange={(e) => {
                const f = framePresets.find((v) => v.id === e.target.value)!;
                set({
                  frameStyle: f.id,
                  frameColor: f.color,
                  frameWidth: f.width,
                  backingColor: f.backing,
                  glass: f.glass,
                });
              }}
            >
              {framePresets.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Frame color
            <input
              type="color"
              value={p.frameColor || '#b99a57'}
              onChange={(e) => set({ frameColor: e.target.value })}
            />
          </label>
          <label>
            Frame width
            <input
              type="range"
              min=".01"
              max=".25"
              step=".005"
              value={p.frameWidth || 0.075}
              onChange={(e) => set({ frameWidth: Number(e.target.value) })}
            />
          </label>
          <label>
            Backing color
            <input
              type="color"
              value={p.backingColor || '#ede9df'}
              onChange={(e) => set({ backingColor: e.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(p.glass)}
              onChange={(e) => set({ glass: e.target.checked })}
            />{' '}
            Protective glass
          </label>
        </>
      )}
      {type.geometry === 'model' &&
        (['X', 'Y', 'Z'] as const).map((axis, n) => (
          <label key={axis}>
            {axis} placement offset
            <input
              type="range"
              min="-.25"
              max=".25"
              step=".01"
              value={p.offset?.[n] || 0}
              onChange={(e) => {
                const offset: [number, number, number] = [...(p.offset || [0, 0, 0])];
                offset[n] = Number(e.target.value);
                set({ offset });
              }}
            />
          </label>
        ))}
    </>
  );
}
