import mongoose, { Schema } from "mongoose";

const OrganizationSchema = new Schema(
  {
    name: { type: String, required: true },
    rorId: { type: String, index: true },
    edboId: { type: String, index: true },
    edrpou: { type: String, index: true },
    institutionType: { type: String },
    regionCode: { type: String },
    legalName: { type: String },
    address: { type: String },
    country: { type: String },
    countryCode: { type: String },
    city: { type: String },
    website: { type: String },
    types: [{ type: String }],
    source: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

OrganizationSchema.index({ rorId: 1 }, { unique: true, sparse: true });
OrganizationSchema.index({ edboId: 1 }, { unique: true, sparse: true });
OrganizationSchema.index({ edrpou: 1 }, { unique: true, sparse: true });
OrganizationSchema.index({ name: 1 });

export const Organization =
  mongoose.models.Organization ??
  mongoose.model("Organization", OrganizationSchema);
