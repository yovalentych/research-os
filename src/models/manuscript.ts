import mongoose, { Schema } from "mongoose";

const ManuscriptSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    title: { type: String, required: true },
    type: { type: String, required: true },
    status: { type: String, default: "draft" },
    summary: { type: String },
    deadlineAt: { type: Date },
    targetJournal: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

ManuscriptSchema.index({ projectId: 1, updatedAt: -1 });

export const Manuscript =
  mongoose.models.Manuscript ??
  mongoose.model("Manuscript", ManuscriptSchema);
