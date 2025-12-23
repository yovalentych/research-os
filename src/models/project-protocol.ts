import mongoose, { Schema } from "mongoose";

const ProjectProtocolSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true },
    steps: [{ type: String }],
    notes: { type: String },
    version: { type: String, default: "v1" },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

ProjectProtocolSchema.index({ projectId: 1, updatedAt: -1 });

export const ProjectProtocol =
  mongoose.models.ProjectProtocol ??
  mongoose.model("ProjectProtocol", ProjectProtocolSchema);
