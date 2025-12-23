import mongoose, { Schema } from "mongoose";

const ExperimentSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true },
    status: { type: String, default: "draft" },
    protocol: {
      version: { type: String },
      checklist: [{ type: String }],
      steps: [{ type: String }],
    },
    plan: {
      steps: [{ type: String }],
      deadlines: [{ type: Date }],
      dependencies: [{ type: Schema.Types.ObjectId, ref: "Experiment" }],
    },
    results: {
      metrics: [{ type: String }],
      figures: [{ type: String }],
      conclusion: { type: String },
    },
    quality: {
      issues: { type: String },
      nextTime: { type: String },
    },
    links: {
      papers: [{ type: String }],
      tasks: [{ type: String }],
      collaborations: [{ type: String }],
      materials: [{ type: String }],
    },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

ExperimentSchema.index({ projectId: 1, status: 1 });

export const Experiment =
  mongoose.models.Experiment ?? mongoose.model("Experiment", ExperimentSchema);
