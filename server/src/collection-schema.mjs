import { z } from 'zod';
import types from './object-types.json' with { type: 'json' };
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
    objectType: z.enum(types.map((t) => t.id)).default('book'),
    details: z.object(fields).strict().default({}),
    presentation: z
      .object({
        frame: z.boolean().default(true),
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
    const type = types.find((t) => t.id === item.objectType);
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
