import mongoose, { Schema } from "mongoose";

const ProjectTaskSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true },
    status: { type: String, default: "todo" },
    dueDate: { type: Date },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User" },
    assigneeName: { type: String },
    notes: { type: String },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

ProjectTaskSchema.index({ projectId: 1, updatedAt: -1 });

export const ProjectTask =
  mongoose.models.ProjectTask ??
  mongoose.model("ProjectTask", ProjectTaskSchema);
