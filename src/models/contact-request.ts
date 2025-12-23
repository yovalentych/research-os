import mongoose, { Schema } from "mongoose";

const ContactRequestSchema = new Schema(
  {
    requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
  },
  { timestamps: true }
);

ContactRequestSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true });
ContactRequestSchema.index({ recipientId: 1, status: 1 });

export const ContactRequest =
  mongoose.models.ContactRequest ??
  mongoose.model("ContactRequest", ContactRequestSchema);
