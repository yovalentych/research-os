import mongoose, { Schema } from "mongoose";

const ProjectMaterialSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true },
    description: { type: String },
    quantity: { type: Number },
    unit: { type: String },
    status: { type: String, default: "planned" },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

ProjectMaterialSchema.index({ projectId: 1, updatedAt: -1 });

export const ProjectMaterial =
  mongoose.models.ProjectMaterial ??
  mongoose.model("ProjectMaterial", ProjectMaterialSchema);
