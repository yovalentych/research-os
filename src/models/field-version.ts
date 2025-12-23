import mongoose, { Schema } from "mongoose";

const FieldVersionSchema = new Schema(
  {
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    fieldPath: { type: String, required: true },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

FieldVersionSchema.index({ entityType: 1, entityId: 1, changedAt: -1 });

export const FieldVersion =
  mongoose.models.FieldVersion ??
  mongoose.model("FieldVersion", FieldVersionSchema);
