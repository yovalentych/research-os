import mongoose, { Schema } from "mongoose";

const ManuscriptSectionSchema = new Schema(
  {
    manuscriptId: { type: Schema.Types.ObjectId, ref: "Manuscript", required: true },
    sectionType: { type: String, required: true },
    content: { type: String },
    order: { type: Number, default: 0 },
    linkedExperimentIds: [{ type: Schema.Types.ObjectId, ref: "Experiment" }],
    linkedFileIds: [{ type: Schema.Types.ObjectId, ref: "FileItem" }],
  },
  { timestamps: true }
);

ManuscriptSectionSchema.index({ manuscriptId: 1, sectionType: 1 });

export const ManuscriptSection =
  mongoose.models.ManuscriptSection ??
  mongoose.model("ManuscriptSection", ManuscriptSectionSchema);
