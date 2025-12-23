import mongoose, { Schema } from "mongoose";

const ScholarshipPaymentSchema = new Schema(
  {
    period: { type: String },
    paidAt: { type: Date },
    grossAmount: { type: Number },
    netAmount: { type: Number },
    taxAmount: { type: Number },
    currency: { type: String, default: "UAH" },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

ScholarshipPaymentSchema.index({ paidAt: -1, period: -1 });

export const ScholarshipPayment =
  mongoose.models.ScholarshipPayment ??
  mongoose.model("ScholarshipPayment", ScholarshipPaymentSchema);
