import mongoose, { Schema } from "mongoose";

const MembershipSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["Collaborator", "Viewer"], required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

MembershipSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export const Membership =
  mongoose.models.Membership ?? mongoose.model("Membership", MembershipSchema);
