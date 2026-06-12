import { z } from "zod";

export const estimatorSchema = z.object({
  includeBase: z.boolean().default(true),
  includeColumn: z.boolean().default(true),
  includeBeam: z.boolean().default(true),

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

  columnRodCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(0, "মান শূন্যের কম হতে পারে না"),
  beamRodCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(0, "মান শূন্যের কম হতে পারে না"),
  
  mainRodFactor: z.coerce.number(),
  
  ringGapIn: z.coerce.number().min(0.1, "রিং গ্যাপ অবশ্যই শূন্যের বেশি হতে হবে"),
  ringRodFactor: z.coerce.number(),
  
  baseRodLongitudinalCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(0, "মান শূন্যের কম হতে পারে না"),
  baseRodWidthCount: z.coerce.number().int("পূর্ণ সংখ্যা হতে হবে").min(0, "মান শূন্যের কম হতে পারে না"),
});

export type EstimatorValues = z.infer<typeof estimatorSchema>;

const slabSectionSchema = z.object({
    length: z.coerce.number().min(1, "দৈর্ঘ্য কমপক্ষে ১ হতে হবে"),
    width: z.coerce.number().min(1, "প্রস্থ কমপক্ষে ১ হতে হবে"),
});

export const slabEstimatorSchema = z.object({
    slabs: z.array(slabSectionSchema).min(1, "কমপক্ষে একটি ছাদের অংশ যোগ করুন।"),
    slabThicknessIn: z.coerce.number().min(2, "ন্যূনতম পুরুত্ব ২ ইঞ্চি").max(12, "সর্বোচ্চ পুরুত্ব ১২ ইঞ্চি"),
    slabRodGapIn: z.coerce.number().min(1, "রডের গ্যাপ কমপক্ষে ১ ইঞ্চি হতে হবে"),
    mainRodFactor: z.coerce.number(),
});
export type SlabEstimatorValues = z.infer<typeof slabEstimatorSchema>;

const roomSchema = z.object({
    length: z.coerce.number().min(1, "দৈর্ঘ্য কমপক্ষে ১ হতে হবে"),
    width: z.coerce.number().min(1, "প্রস্থ কমপক্ষে ১ হতে হবে"),
});

export const brickEstimatorSchema = z.object({
  calculationType: z.enum(['wall', 'rooms']),
  wallLengthFt: z.coerce.number().min(1, "প্রাচীরের দৈর্ঘ্য কমপক্ষে ১ হতে হবে").optional(),
  wallHeightFt: z.coerce.number().min(1, "উচ্চতা কমপক্ষে ১ হতে হবে"),
  wallThicknessIn: z.enum(['5', '10'], { required_error: "দেয়ালের পুরুত্ব নির্বাচন করুন" }),
  rooms: z.array(roomSchema).optional(),
}).superRefine((data, ctx) => {
    if (data.calculationType === 'wall' && !data.wallLengthFt) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "প্রাচীরের দৈর্ঘ্য প্রয়োজন।",
            path: ["wallLengthFt"],
        });
    }
    if (data.calculationType === 'rooms' && (!data.rooms || data.rooms.length < 1)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "কমপক্ষে একটি রুম যোগ করুন।",
            path: ["rooms"],
        });
    }
});

export type BrickEstimatorValues = z.infer<typeof brickEstimatorSchema>;

const singleWallSchema = z.object({
    length: z.coerce.number().min(1, "দৈর্ঘ্য কমপক্ষে ১ হতে হবে"),
    height: z.coerce.number().min(1, "উচ্চতা কমপক্ষে ১ হতে হবে"),
});

export const tileEstimatorSchema = z.object({
  calculationType: z.enum(['floor', 'walls']),
  floorLengthFt: z.coerce.number().min(1, "দৈর্ঘ্য কমপক্ষে ১ হতে হবে").optional(),
  floorWidthFt: z.coerce.number().min(1, "প্রস্থ কমপক্ষে ১ হতে হবে").optional(),
  walls: z.array(singleWallSchema).optional(),
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
    }
    if (data.calculationType === 'walls' && (!data.walls || data.walls.length < 1)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "কমপক্ষে একটি দেয়াল যোগ করুন।",
            path: ["walls"],
        });
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

export const septicTankSchema = z.object({
  lengthFt: z.coerce.number().min(1, "দৈর্ঘ্য কমপক্ষে ১ হতে হবে"),
  widthFt: z.coerce.number().min(1, "প্রস্থ কমপক্ষে ১ হতে হবে"),
  depthFt: z.coerce.number().min(1, "গভীরতা কমপক্ষে ১ হতে হবে"),
});
export type SepticTankValues = z.infer<typeof septicTankSchema>;

export const AiConstructionAdvisoryInputSchema = z.object({
  baseCount: z.number().describe('Number of foundation bases.'),
  baseLengthFt: z.number().describe('Length of the foundation base in feet.'),
  baseWidthFt: z.number().describe('Width of the foundation base in feet.'),
  baseThicknessIn: z.number().describe('Thickness of the foundation base in inches.'),

  columnCount: z.number().describe('Number of columns.'),
  columnLengthIn: z.number().describe('Length of the column cross-section in inches.'),
  columnWidthIn: z.number().describe('Width of the column cross-section in inches.'),
  columnHeightFt: z.number().describe('Total height of the column in feet.'),
  columnRodCount: z.number().describe('Number of main steel reinforcement rods in the column.'),

  beamHeightIn: z.number().describe('Height of the beam cross-section in inches.'),
  beamWidthIn: z.number().describe('Width of the beam cross-section in inches.'),
  beamLengthFt: z.number().describe('Total length of the beam in feet.'),
  beamRodCount: z.number().describe('Number of main steel reinforcement rods in the beam.'),
  
  slabLengthFt: z.number().describe('Length of the roof slab in feet.'),
  slabWidthFt: z.number().describe('Width of the roof slab in feet.'),
  slabThicknessIn: z.number().describe('Thickness of the roof slab in inches.'),
  slabRodGapIn: z.number().describe('Gap between main and extra top rods in the slab in inches.'),

  mainRodFactor: z.number().describe('Weight per foot factor for the main steel reinforcement rods.'),
  ringRodFactor: z.number().describe('Weight per foot factor for the ring steel reinforcement rods.'),
  ringGapIn: z.number().describe('Gap between ring (stirrup) reinforcements in inches.'),

  baseRodLongitudinalCount: z.number().describe('Number of longitudinal reinforcement rods in the foundation base mesh.'),
  baseRodWidthCount: z.number().describe('Number of width-wise reinforcement rods in the foundation base mesh.'),
});

export const stairEstimatorSchema = z.object({
  flightCount: z.coerce.number().int().min(1, "অন্তত একটি ফ্লাইট থাকতে হবে"),
  waistSlabLengthFt: z.coerce.number().min(1, "দৈর্ঘ্য কমপক্ষে ১ হতে হবে"),
  waistSlabWidthFt: z.coerce.number().min(1, "প্রস্থ কমপক্ষে ১ হতে হবে"),
  waistSlabThicknessIn: z.coerce.number().min(3, "পুরুত্ব কমপক্ষে ৩ ইঞ্চি হতে হবে"),
  stepCountPerFlight: z.coerce.number().int().min(1, "প্রতি ফ্লাইটে অন্তত একটি ধাপ থাকতে হবে"),
  riserHeightIn: z.coerce.number().min(5, "রাইজার কমপক্ষে ৫ ইঞ্চি হতে হবে").max(8, "রাইজার ৮ ইঞ্চির বেশি হওয়া উচিত নয়"),
  treadWidthIn: z.coerce.number().min(10, "ট্রেড কমপক্ষে ১০ ইঞ্চি হতে হবে"),
  landingLengthFt: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না").default(0),
  landingWidthFt: z.coerce.number().min(0, "মান শূন্যের কম হতে পারে না").default(0),
  mainRodFactor: z.coerce.number(),
  distRodFactor: z.coerce.number(),
  distRodGapIn: z.coerce.number().min(1, "রডের গ্যাপ কমপক্ষে ১ ইঞ্চি হতে হবে"),
});

export type StairEstimatorValues = z.infer<typeof stairEstimatorSchema>;

export const HouseDesignInputSchema = z.object({
  style: z.string().min(1, "স্টাইল নির্বাচন করুন"),
  floors: z.coerce.number().min(1, "ন্যূনতম ১ তলা হতে হবে"),
  surroundings: z.string().min(1, "পরিবেশ বর্ণনা করুন"),
});
export type HouseDesignInput = z.infer<typeof HouseDesignInputSchema>;
