import mongoose, { Schema } from "mongoose";

const SourceCacheSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    syncedAt: { type: Date, required: true },
    intervalDays: { type: Number, default: 7 },
    syncInProgress: { type: Boolean, default: false },
    syncStartedAt: { type: Date },
    syncTotal: { type: Number },
    syncProcessed: { type: Number },
    syncMessage: { type: String },
  },
  { timestamps: true }
);

export const SourceCache =
  mongoose.models.SourceCache ??
  mongoose.model("SourceCache", SourceCacheSchema);
