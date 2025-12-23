import mongoose, { Schema } from "mongoose";

const TaskSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true },
    description: { type: String },
    status: { type: String, default: "todo" },
    priority: { type: String, default: "medium" },
    dependencies: [{ type: Schema.Types.ObjectId, ref: "Task" }],
    dueDate: { type: Date },
  },
  { timestamps: true }
);

TaskSchema.index({ projectId: 1, status: 1, dueDate: 1 });

export const Task =
  mongoose.models.Task ?? mongoose.model("Task", TaskSchema);
