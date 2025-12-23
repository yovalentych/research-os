import mongoose, { Schema } from "mongoose";

const ProjectNoteSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true },
    body: { type: String },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

ProjectNoteSchema.index({ projectId: 1, updatedAt: -1 });

export const ProjectNote =
  mongoose.models.ProjectNote ??
  mongoose.model("ProjectNote", ProjectNoteSchema);
