import mongoose, { Schema } from "mongoose";

const AuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, enum: ["create", "update", "delete"], required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    metadata: {
      ip: { type: String },
      userAgent: { type: String },
    },
  },
  { timestamps: { createdAt: "timestamp", updatedAt: false } }
);

AuditLogSchema.index({ projectId: 1, entityType: 1, timestamp: -1 });

export const AuditLog =
  mongoose.models.AuditLog ?? mongoose.model("AuditLog", AuditLogSchema);
