import mongoose, { Schema } from "mongoose";

const AffiliationSchema = new Schema(
  {
    scientistName: { type: String, required: true },
    scientistTitle: { type: String },
    institutionName: { type: String, required: true },
    institutionLegalName: { type: String },
    department: { type: String },
    address: { type: String },
    officialCodes: { type: String },
    officialDetails: { type: String },
    website: { type: String },
    email: { type: String },
    phone: { type: String },
    emblemUrl: { type: String },
    emblemStorage: {
      bucket: { type: String },
      key: { type: String },
    },
    emblemTemplateStorage: {
      bucket: { type: String },
      key: { type: String },
    },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

AffiliationSchema.index({ institutionName: 1, updatedAt: -1 });

export const Affiliation =
  mongoose.models.Affiliation ??
  mongoose.model("Affiliation", AffiliationSchema);
