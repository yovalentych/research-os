import mongoose, { Schema } from "mongoose";

const ProjectSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String },
    status: { type: String, default: "active" },
    tags: [{ type: String }],
    visibility: { type: String, enum: ["private", "shared"], default: "private" },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

export const Project =
  mongoose.models.Project ?? mongoose.model("Project", ProjectSchema);
