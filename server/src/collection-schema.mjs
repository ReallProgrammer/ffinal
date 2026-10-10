import { z } from 'zod';
import types from './object-types.json' with { type: 'json' };
import presets from './presets.json' with {type:'json'};
export { types };
const uuid = z.string().uuid();
const date = z
  .string()
  .refine(
    (v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v))),
    'Use an ISO date.',
  );
const fields = Object.fromEntries(
  types
    .flatMap((t) => t.fields)
    .map((f) => [
      f.key,
      f.input === 'date'
        ? date.optional()
        : f.input === 'url'
          ? z
              .string()
              .max(2000)
              .refine(
                (v) =>
                  !v ||
                  (/^https:\/\//.test(v) &&
                    (() => {
                      try {
                        return Boolean(new URL(v).hostname);
                      } catch {
                        return false;
                      }
                    })()),
                'Use an HTTPS verification URL.',
              )
              .optional()
          : z
              .string()
              .max(f.key === 'notes' ? 3000 : 500)
              .optional(),
    ]),
);
export const artworkRoles = ['disc', 'interior', 'booklet', 'card', 'insert', 'wrap', 'manual'];
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/);
const layer = z
  .object({
    id: uuid,
    type: z.enum(['image', 'text']),
    assetId: uuid.optional(),
    text: z.string().max(500).optional(),
    x: z.number().min(-1).max(2),
    y: z.number().min(-1).max(2),
    width: z.number().min(0.01).max(2),
    height: z.number().min(0.01).max(2),
    rotation: z.number().min(-360).max(360).default(0),
    locked: z.boolean().default(false),
    color: color.default('#222222'),
    font: z.enum(['sans-serif', 'serif', 'monospace']).default('sans-serif'),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.type === 'image' && !v.assetId)
      c.addIssue({ code: 'custom', message: 'Image layer requires an asset.' });
  });
export const placementSchema = z
  .object({
    shelfId: uuid,
    beforeId: uuid.nullable().default(null),
    expectedIds: z.array(uuid).max(1000).optional(),
    expectedShelfId: uuid.optional(),
  })
  .strict();
export const shelfAppearanceSchema = z
  .object({
    width: z.number().min(6).max(20).default(11.8),
    depth: z.number().min(1).max(8).default(2.6),
    spacing: z.number().min(0.2).max(2).default(0.5),
    color: color.default('#ad855f'),
  })
  .strict();
export const itemSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    author: z.string().trim().max(120).default(''),
    description: z.string().max(6000).default(''),
    genre: z.string().trim().max(80).default(''),
    year: z.number().int().min(1).max(2200).nullable().default(null),
    isbn: z.string().max(32).default(''),
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    height: z.number().min(0.4).max(4),
    width: z.number().min(0.4).max(4),
    thickness: z.number().min(0.04).max(3),
    shelfId: uuid,
    published: z.boolean().default(false),
    digitalAccess: z.enum(['private', 'public']).default('private'),
    front: uuid.nullable().default(null),
    spine: uuid.nullable().default(null),
    back: uuid.nullable().default(null),
    digital: uuid.nullable().default(null),
    model: uuid.nullable().default(null),
    artwork: z.partialRecord(z.enum(artworkRoles), uuid.nullable()).default({}),
    layers: z
      .partialRecord(
        z.enum(['front', 'spine', 'back', 'disc', 'interior', 'booklet', 'card', 'insert']),
        z.array(layer).max(30),
      )
      .default({}),
    genreIds: z.array(uuid).max(20).optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
    bookNumber: z.string().max(40).default(''),
    bookOrder: z.number().int().min(0).max(1000000).nullable().default(null),
    placement: z
      .object({ beforeId: uuid.nullable(), expectedIds: z.array(uuid).max(1000).optional() })
      .strict()
      .optional(),
    objectType: z.enum(types.map((t) => t.id)).default('book'),
    details: z.object(fields).strict().default({}),
    presentation: z
      .object({
        frame: z.boolean().default(true),
        frameStyle: z
          .enum(['black', 'white', 'silver', 'gold', 'wood', 'glass', 'floating', 'academic'])
          .default('gold'),
        frameWidth: z.number().min(0.01).max(0.25).default(0.075),
        frameColor: color.optional(),
        backingColor: color.default('#eee9dd'),
        glass: z.boolean().default(false),
        casePreset: z.enum(['',...presets.cases.map(p=>p.id)]).default(''),
        caseColor: color.optional(),
        plasticOpacity: z.number().min(0.12).max(1).default(0.88),
        plasticRoughness: z.number().min(0.08).max(0.8).default(0.18),
        openAngle: z.number().min(75).max(165).default(125),
        includeDisc: z.boolean().default(false),
        offset: z
          .tuple([
            z.number().min(-0.25).max(0.25),
            z.number().min(-0.25).max(0.25),
            z.number().min(-0.25).max(0.25),
          ])
          .default([0, 0, 0]),
        roughness: z.number().min(0.1).max(1).default(0.65),
        textOverlay: z.boolean().default(false),
        scale: z.number().min(0.25).max(2).default(1),
        rotation: z
          .tuple([
            z.number().min(-180).max(180),
            z.number().min(-180).max(180),
            z.number().min(-180).max(180),
          ])
          .default([0, 0, 0]),
      })
      .strict()
      .default({}),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (
      item.presentation.frame &&
      item.objectType === 'certificate' &&
      item.presentation.frameWidth * 2 >= Math.min(item.width, item.height)
    )
      ctx.addIssue({ code: 'custom', message: 'Frame width must leave room for the artwork.' });
    const type = types.find((t) => t.id === item.objectType);
    if (type.id !== 'book' && (item.bookNumber || item.bookOrder !== null))
      ctx.addIssue({ code: 'custom', message: 'Only books have collection numbering.' });
    for (const role of Object.keys(item.artwork))
      if (item.artwork[role] && role !== 'wrap' && !type.contents.includes(role))
        ctx.addIssue({ code: 'custom', message: 'Unsupported interior surface.' });
    for (const role of Object.keys(item.layers))
      if (!type.surfaces.includes(role) && !type.contents.includes(role))
        ctx.addIssue({ code: 'custom', message: 'Unsupported layer surface.' });
    for (const key of Object.keys(item.details))
      if (!type.fields.some((f) => f.key === key))
        ctx.addIssue({
          code: 'custom',
          message: 'Metadata does not match object type.',
          path: ['details', key],
        });
    for (const surface of ['front', 'spine', 'back'])
      if (item[surface] && !type.surfaces.includes(surface))
        ctx.addIssue({ code: 'custom', message: 'Unsupported surface', path: [surface] });
    if (item.digital && !type.document)
      ctx.addIssue({
        code: 'custom',
        message: 'This type does not accept documents.',
        path: ['digital'],
      });
    if (item.model && type.id !== 'model')
      ctx.addIssue({
        code: 'custom',
        message: 'Only model objects accept models.',
        path: ['model'],
      });
    if (item.published && !(type.id === 'model' ? item.model : item.front))
      ctx.addIssue({
        code: 'custom',
        message: 'Published items require artwork or a model.',
        path: ['front'],
      });
  });
export const cropSchema = z
  .object({
    x: z.number().min(0).max(1).default(0.5),
    y: z.number().min(0).max(1).default(0.5),
    zoom: z.number().min(1).max(4).default(1),
    ratio: z.number().min(0.01).max(100),
  })
  .strict();
