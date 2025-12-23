import mongoose, { Schema } from "mongoose";

export const GLOBAL_ROLES = [
  "Owner",
  "Supervisor",
  "Mentor",
  "Collaborator",
  "Viewer",
] as const;

export type GlobalRole = (typeof GLOBAL_ROLES)[number];

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
    latinFullName: { type: String },
    latinFirstName: { type: String },
    latinLastName: { type: String },
    globalRole: { type: String, enum: GLOBAL_ROLES, default: "Collaborator" },
    degreeLevel: { type: String },
    degreeCompleted: { type: String },
    degreeInProgress: { type: String },
    publicProfile: { type: Boolean, default: true },
    contactVisibility: {
      type: String,
      enum: ["public", "email"],
      default: "public",
    },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    organizationName: { type: String },
    plan: { type: String, default: "free" },
    planStatus: { type: String, default: "active" },
    planRenewalAt: { type: Date },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
  },
  { timestamps: true }
);

export const User =
  mongoose.models.User ?? mongoose.model("User", UserSchema);
