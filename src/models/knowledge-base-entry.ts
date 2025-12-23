import mongoose, { Schema } from "mongoose";

const KnowledgeBaseEntrySchema = new Schema(
  {
    title: { type: String, required: true },
    category: { type: String, default: "Протокол" },
    content: { type: String },
    tags: [{ type: String }],
    visibility: { type: String, enum: ["private", "shared"], default: "private" },
    sharedProjectIds: [{ type: Schema.Types.ObjectId, ref: "Project" }],
    sharedUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

KnowledgeBaseEntrySchema.index({ category: 1, updatedAt: -1 });
KnowledgeBaseEntrySchema.index({
  title: "text",
  content: "text",
  tags: "text",
  category: "text",
});

export const KnowledgeBaseEntry =
  mongoose.models.KnowledgeBaseEntry ??
  mongoose.model("KnowledgeBaseEntry", KnowledgeBaseEntrySchema);
