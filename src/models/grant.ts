import mongoose, { Schema } from "mongoose";

const GrantSchema = new Schema(
  {
    title: { type: String, required: true },
    status: { type: String, default: "planned" },
    organization: { type: String },
    country: { type: String },
    description: { type: String },
    deadlineAt: { type: Date },
    plannedSubmissionAt: { type: Date },
    amount: { type: Number },
    currency: { type: String, default: "UAH" },
    documents: { type: String },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

GrantSchema.index({ status: 1, deadlineAt: 1 });

export const Grant =
  mongoose.models.Grant ?? mongoose.model("Grant", GrantSchema);
