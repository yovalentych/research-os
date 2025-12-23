import mongoose, { Schema } from "mongoose";

const FileItemSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    entityType: { type: String },
    entityId: { type: Schema.Types.ObjectId },
    name: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number },
    storage: {
      bucket: { type: String },
      key: { type: String },
      url: { type: String },
    },
    version: { type: Number, default: 1 },
    tags: [{ type: String }],
    notes: { type: String },
    folderIds: [{ type: Schema.Types.ObjectId, ref: "VaultFolder" }],
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

FileItemSchema.index({ projectId: 1, entityType: 1, entityId: 1 });

export const FileItem =
  mongoose.models.FileItem ?? mongoose.model("FileItem", FileItemSchema);
