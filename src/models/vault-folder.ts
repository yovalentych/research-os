import mongoose, { Schema } from "mongoose";

const VaultFolderSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    name: { type: String, required: true },
    description: { type: String },
    color: { type: String, default: "slate" },
    archivedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

VaultFolderSchema.index({ projectId: 1, updatedAt: -1 });

export const VaultFolder =
  mongoose.models.VaultFolder ??
  mongoose.model("VaultFolder", VaultFolderSchema);
