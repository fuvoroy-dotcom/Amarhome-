import { z } from "zod";

export const estimatorSchema = z.object({
  baseCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(1, "বেসের সংখ্যা কমপক্ষে ১ হতে হবে"),
  baseLengthFt: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  baseWidthFt: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  baseThicknessIn: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  
  columnCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(1, "কলামের সংখ্যা কমপক্ষে ১ হতে হবে"),
  columnLengthIn: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  columnWidthIn: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  columnHeightFt: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  
  beamHeightIn: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  beamWidthIn: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  beamLengthFt: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),

  slabLengthFt: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  slabWidthFt: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না"),
  slabThicknessIn: z.coerce.number().min(2, "ন্যূনতম পুরুত্ব ২ ইঞ্চি").max(12, "সর্বোচ্চ পুরুত্ব ১২ ইঞ্চি"),
  slabRodGapIn: z.coerce.number().min(1, "রডের গ্যাপ কমপক্ষে ১ ইঞ্চি হতে হবে"),

  columnRodCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(0, "মান শূন্যের কম হতে পারে না"),
  beamRodCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(0, "মান শূন্যের কম হতে পারে না"),
  
  mainRodFactor: z.coerce.number(),
  
  ringGapIn: z.coerce.number().min(0.1, "রিং গ্যাপ অবশ্যই শূন্যের বেশি হতে হবে"),
  ringRodFactor: z.coerce.number(),
  
  baseRodLongitudinalCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(0, "মান শূন্যের কম হতে পারে না"),
  baseRodWidthCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(0, "মান শূন্যের কম হতে পারে না"),
});

export type EstimatorValues = z.infer<typeof estimatorSchema>;

export const brickEstimatorSchema = z.object({
  calculationType: z.enum(['wall', 'room']),
  roomCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(1, "রুমের সংখ্যা কমপক্ষে ১ হতে হবে").optional(),
  wallLengthFt: z.coerce.number().min(1, "দৈর্ঘ্য কমপক্ষে ১ হতে হবে"),
  wallWidthFt: z.coerce.number().min(1, "প্রস্থ কমপক্ষে ১ হতে হবে").optional(),
  wallHeightFt: z.coerce.number().min(1, "উচ্চতা কমপক্ষে ১ হতে হবে"),
  wallThicknessIn: z.enum(['5', '10'], { required_error: "দেয়ালের পুরুত্ব নির্বাচন করুন" }),
}).superRefine((data, ctx) => {
    if (data.calculationType === 'room') {
        if (!data.wallWidthFt) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "রুমের প্রস্থ প্রয়োজন।",
                path: ["wallWidthFt"],
            });
        }
        if (!data.roomCount) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "রুমের সংখ্যা প্রয়োজন।",
                path: ["roomCount"],
            });
        }
    }
});


export type BrickEstimatorValues = z.infer<typeof brickEstimatorSchema>;


export const tileEstimatorSchema = z.object({
  calculationType: z.enum(['floor', 'wall']),
  floorLengthFt: z.coerce.number().min(1, "দৈর্ঘ্য কমপক্ষে ১ হতে হবে").optional(),
  floorWidthFt: z.coerce.number().min(1, "প্রস্থ কমপক্ষে ১ হতে হবে").optional(),
  wallLengthFt: z.coerce.number().min(1, "দৈর্ঘ্য কমপক্ষে ১ হতে হবে").optional(),
  wallHeightFt: z.coerce.number().min(1, "উচ্চতা কমপক্ষে ১ হতে হবে").optional(),
  tileLengthIn: z.coerce.number().min(1, "টাইলসের দৈর্ঘ্য কমপক্ষে ১ হতে হবে"),
  tileWidthIn: z.coerce.number().min(1, "টাইলসের প্রস্থ কমপক্ষে ১ হতে হবে"),
  wastagePercent: z.coerce.number().min(0, "অপচয় ০ এর কম হতে পারে না").max(100, "অপচয় ১০০ এর বেশি হতে পারে না").default(10),
}).superRefine((data, ctx) => {
    if (data.calculationType === 'floor') {
        if (!data.floorLengthFt) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ফ্লোরের দৈর্ঘ্য প্রয়োজন।", path: ["floorLengthFt"] });
        }
        if (!data.floorWidthFt) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ফ্লোরের প্রস্থ প্রয়োজন।", path: ["floorWidthFt"] });
        }
    } else { // wall
        if (!data.wallLengthFt) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "দেয়ালের দৈর্ঘ্য প্রয়োজন।", path: ["wallLengthFt"] });
        }
        if (!data.wallHeightFt) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "দেয়ালের উচ্চতা প্রয়োজন।", path: ["wallHeightFt"] });
        }
    }
});

export type TileEstimatorValues = z.infer<typeof tileEstimatorSchema>;


export const plasterEstimatorSchema = z.object({
  wallLengthFt: z.coerce.number().min(1, "দৈর্ঘ্য কমপক্ষে ১ হতে হবে"),
  wallHeightFt: z.coerce.number().min(1, "উচ্চতা কমপক্ষে ১ হতে হবে"),
  plasterThicknessIn: z.coerce.number().min(0.25, "পুরুত্ব কমপক্ষে ০.২৫ ইঞ্চি হতে হবে").max(2, "পুরুত্ব ২ ইঞ্চির বেশি হতে পারে না"),
  plasterSides: z.enum(['1', '2']),
});

export type PlasterEstimatorValues = z.infer<typeof plasterEstimatorSchema>;


export const fullHouseEstimatorSchema = z.object({
  floorCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(1, "ন্যূনতম ১টি ফ্লোর হতে হবে"),
  totalAreaSqFt: z.coerce.number().min(100, "ন্যূনতম ১০০ বর্গফুট হতে হবে"),
  
  // Per floor counts
  roomCount: z.coerce.number().int().min(1, "প্রতি ফ্লোরে ন্যূনতম ১টি রুম থাকতে হবে"),
  bathroomCount: z.coerce.number().int().min(0, "ন্যূনতম ০টি বাথরুম হতে হবে"),
  
  // Average dimensions
  avgRoomLengthFt: z.coerce.number().min(8, "রুমের গড় দৈর্ঘ্য ন্যূনতম ৮ ফুট হতে হবে"),
  avgRoomWidthFt: z.coerce.number().min(8, "রুমের গড় প্রস্থ ন্যূনতম ৮ ফুট হতে হবে"),
  floorHeightFt: z.coerce.number().min(9, "ফ্লোরের উচ্চতা ন্যূনতম ৯ ফুট হতে হবে"),

  // Structural details
  columnCountPerFloor: z.coerce.number().int().min(4, "প্রতি ফ্লোরে ন্যূনতম ৪টি কলাম থাকতে হবে"),
  slabThicknessIn: z.coerce.number().min(4, "ন্যূনতম পুরুত্ব ৪ ইঞ্চি").max(8, "সর্বোচ্চ পুরুত্ব ৮ ইঞ্চি").default(5),
  wallThicknessIn: z.enum(['5', '10']).default('5'),
  
  // Tile details
  tileFloors: z.boolean().default(true),
  tileBathroomWalls: z.boolean().default(true),
  bathroomWallTileHeightFt: z.coerce.number().min(5).max(10).default(7),
  
  // Plaster details
  plasterInterior: z.boolean().default(true),
  plasterExterior: z.boolean().default(true),

  // Rods - Simplified for a full house estimate
  mainRodFactor: z.coerce.number().default(0.48),
  ringRodFactor: z.coerce.number().default(0.12),
  ringGapIn: z.coerce.number().default(7),
});

export type FullHouseEstimatorValues = z.infer<typeof fullHouseEstimatorSchema>;