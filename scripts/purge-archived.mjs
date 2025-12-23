import "dotenv/config";
import mongoose from "mongoose";

const { MONGODB_URI } = process.env;

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI.");
  process.exit(1);
}

const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

async function run() {
  await mongoose.connect(MONGODB_URI, { dbName: "research_os" });

  const withArchiveSchema = new mongoose.Schema(
    { archivedAt: { type: Date } },
    { strict: false }
  );

  const Project = mongoose.models.Project ?? mongoose.model("Project", withArchiveSchema);
  const ProjectTask =
    mongoose.models.ProjectTask ?? mongoose.model("ProjectTask", withArchiveSchema);
  const ProjectNote =
    mongoose.models.ProjectNote ?? mongoose.model("ProjectNote", withArchiveSchema);
  const ProjectMaterial =
    mongoose.models.ProjectMaterial ??
    mongoose.model("ProjectMaterial", withArchiveSchema);
  const ProjectProtocol =
    mongoose.models.ProjectProtocol ??
    mongoose.model("ProjectProtocol", withArchiveSchema);
  const Experiment =
    mongoose.models.Experiment ?? mongoose.model("Experiment", withArchiveSchema);
  const FileItem =
    mongoose.models.FileItem ?? mongoose.model("FileItem", withArchiveSchema);
  const Manuscript =
    mongoose.models.Manuscript ?? mongoose.model("Manuscript", withArchiveSchema);
  const ManuscriptSection =
    mongoose.models.ManuscriptSection ??
    mongoose.model("ManuscriptSection", withArchiveSchema);
  const ManuscriptSectionVersion =
    mongoose.models.ManuscriptSectionVersion ??
    mongoose.model("ManuscriptSectionVersion", withArchiveSchema);
  const Milestone =
    mongoose.models.Milestone ?? mongoose.model("Milestone", withArchiveSchema);

  const filter = { archivedAt: { $lte: cutoff } };

  const archivedManuscripts = await Manuscript.find(filter)
    .select("_id")
    .lean();
  const archivedManuscriptIds = archivedManuscripts.map((doc) => doc._id);
  const archivedSections = archivedManuscriptIds.length
    ? await ManuscriptSection.find({ manuscriptId: { $in: archivedManuscriptIds } })
        .select("_id")
        .lean()
    : [];
  const archivedSectionIds = archivedSections.map((doc) => doc._id);

  await Promise.all([
    ProjectTask.deleteMany(filter),
    ProjectNote.deleteMany(filter),
    ProjectMaterial.deleteMany(filter),
    ProjectProtocol.deleteMany(filter),
    Experiment.deleteMany(filter),
    FileItem.deleteMany(filter),
    Milestone.deleteMany(filter),
    Manuscript.deleteMany(filter),
    archivedManuscriptIds.length
      ? ManuscriptSection.deleteMany({ manuscriptId: { $in: archivedManuscriptIds } })
      : Promise.resolve(),
    archivedSectionIds.length
      ? ManuscriptSectionVersion.deleteMany({ sectionId: { $in: archivedSectionIds } })
      : Promise.resolve(),
    Project.deleteMany(filter),
  ]);

  console.log("Archived items purged.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
