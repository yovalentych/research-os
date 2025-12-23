import mongoose, { Schema } from 'mongoose';

const EdboInstitutionSchema = new Schema(
  {
    name: { type: String, required: true },

    // ❗ без index: true — індекси нижче
    edboId: { type: String, required: true },

    edrpou: { type: String },
    institutionType: { type: String },
    regionCode: { type: String },
    city: { type: String },
    address: { type: String },
    legalName: { type: String },
    website: { type: String },
    source: { type: String, default: 'edbo' },
  },
  { timestamps: true }
);

// 🔹 індекси — централізовано
EdboInstitutionSchema.index({ name: 1 });
EdboInstitutionSchema.index({ edboId: 1 }, { unique: true });
EdboInstitutionSchema.index({ edrpou: 1 }, { unique: true, sparse: true });

export const EdboInstitution =
  mongoose.models.EdboInstitution ??
  mongoose.model('EdboInstitution', EdboInstitutionSchema);
