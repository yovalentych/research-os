import mongoose, { Schema } from "mongoose";

const MilestoneSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    parentId: { type: Schema.Types.ObjectId, ref: "Milestone" },
    title: { type: String, required: true },
    status: { type: String, default: "planned" },
    dueDate: { type: Date },
    achievements: { type: String },
    plan: { type: String },
    linkedExperimentIds: [{ type: Schema.Types.ObjectId, ref: "Experiment" }],
    linkedFileIds: [{ type: Schema.Types.ObjectId, ref: "FileItem" }],
    includeInGlobal: { type: Boolean, default: false },
    icon: { type: String },
    color: { type: String },
    order: { type: Number },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

MilestoneSchema.index({ projectId: 1, updatedAt: -1 });
MilestoneSchema.index({ parentId: 1, order: 1 });

export const Milestone =
  mongoose.models.Milestone ?? mongoose.model("Milestone", MilestoneSchema);
