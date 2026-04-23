import { z } from "zod";

export const estimatorSchema = z.object({
  baseLengthFt: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  baseWidthFt: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  baseThicknessIn: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  
  columnLengthIn: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  columnWidthIn: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  columnHeightFt: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  
  beamHeightIn: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  beamWidthIn: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  beamLengthFt: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),

  columnRodCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(0, "মান শূন্যের কম হতে পারে না"),
  beamRodCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(0, "মান শূন্যের কম হতে পারে না"),
  
  mainRodFactor: z.coerce.number(),
  
  ringGapIn: z.coerce.number().min(0.1, "রিং গ্যাপ অবশ্যই শূন্যের বেশি হতে হবে"),
  ringRodFactor: z.coerce.number(),
  
  baseRodLongitudinalCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(0, "মান শূন্যের কম হতে পারে না"),
  baseRodWidthCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(0, "মান শূন্যের কম হতে পারে না"),
});

export type EstimatorValues = z.infer<typeof estimatorSchema>;
