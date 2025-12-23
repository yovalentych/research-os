import mongoose, { Schema } from "mongoose";

const ManuscriptSectionVersionSchema = new Schema(
  {
    sectionId: { type: Schema.Types.ObjectId, ref: "ManuscriptSection", required: true },
    content: { type: String },
    linkedExperimentIds: [{ type: Schema.Types.ObjectId, ref: "Experiment" }],
    linkedFileIds: [{ type: Schema.Types.ObjectId, ref: "FileItem" }],
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

ManuscriptSectionVersionSchema.index({ sectionId: 1, changedAt: -1 });

export const ManuscriptSectionVersion =
  mongoose.models.ManuscriptSectionVersion ??
  mongoose.model("ManuscriptSectionVersion", ManuscriptSectionVersionSchema);
