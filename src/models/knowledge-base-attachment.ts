import mongoose, { Schema } from "mongoose";

const KnowledgeBaseAttachmentSchema = new Schema(
  {
    entryId: { type: Schema.Types.ObjectId, ref: "KnowledgeBaseEntry", required: true },
    name: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number },
    storage: {
      bucket: { type: String },
      key: { type: String },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

KnowledgeBaseAttachmentSchema.index({ entryId: 1, updatedAt: -1 });

export const KnowledgeBaseAttachment =
  mongoose.models.KnowledgeBaseAttachment ??
  mongoose.model("KnowledgeBaseAttachment", KnowledgeBaseAttachmentSchema);
