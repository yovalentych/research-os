import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import PDFDocument from "pdfkit";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { canAccessProject } from "@/lib/access";
import { Milestone } from "@/models/milestone";
import { Experiment } from "@/models/experiment";
import { FileItem } from "@/models/file-item";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "docx";

  await connectToDatabase();
  const milestone = await Milestone.findById(id).lean();

  if (!milestone) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (milestone.projectId) {
    const allowed = await canAccessProject(
      session,
      new mongoose.Types.ObjectId(milestone.projectId)
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const experimentIds = milestone.linkedExperimentIds ?? [];
  const fileIds = milestone.linkedFileIds ?? [];

  const experiments = experimentIds.length
    ? await Experiment.find({ _id: { $in: experimentIds } })
        .select("title status")
        .lean()
    : [];
  const files = fileIds.length
    ? await FileItem.find({ _id: { $in: fileIds } })
        .select("name")
        .lean()
    : [];

  const dueDate = milestone.dueDate
    ? new Date(milestone.dueDate).toLocaleDateString("uk-UA")
    : "—";

  const experimentLines =
    experiments.length === 0
      ? ["Експерименти не прив'язані."]
      : experiments.map(
          (experiment) =>
            `- ${experiment.title} (${experiment.status ?? "—"})`
        );
  const fileLines =
    files.length === 0
      ? ["Фігури не прив'язані."]
      : files.map((file) => `- ${file.name}`);

  if (format === "pdf") {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));

    doc.fontSize(18).text(milestone.title, { underline: true });
    doc.moveDown();
    doc.fontSize(11).text(`Статус: ${milestone.status ?? "planned"}`);
    doc.text(`Дедлайн: ${dueDate}`);
    doc.moveDown();

    doc.fontSize(13).text("План", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).text(milestone.plan ?? "—");
    doc.moveDown();

    doc.fontSize(13).text("Здобутки", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).text(milestone.achievements ?? "—");
    doc.moveDown();

    doc.fontSize(13).text("Експерименти", { underline: true });
    doc.moveDown(0.5);
    experimentLines.forEach((line) => doc.text(line));
    doc.moveDown();

    doc.fontSize(13).text("Фігури", { underline: true });
    doc.moveDown(0.5);
    fileLines.forEach((line) => doc.text(line));

    doc.end();
    const buffer = await new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=milestone-${id}.pdf`,
      },
    });
  }

  const paragraphs = [
    new Paragraph({ text: milestone.title, heading: HeadingLevel.TITLE }),
    new Paragraph(`Статус: ${milestone.status ?? "planned"}`),
    new Paragraph(`Дедлайн: ${dueDate}`),
    new Paragraph(""),
    new Paragraph({ text: "План", heading: HeadingLevel.HEADING_1 }),
    new Paragraph(milestone.plan ?? "—"),
    new Paragraph(""),
    new Paragraph({ text: "Здобутки", heading: HeadingLevel.HEADING_1 }),
    new Paragraph(milestone.achievements ?? "—"),
    new Paragraph(""),
    new Paragraph({ text: "Експерименти", heading: HeadingLevel.HEADING_1 }),
    ...experimentLines.map((line) => new Paragraph(line)),
    new Paragraph(""),
    new Paragraph({ text: "Фігури", heading: HeadingLevel.HEADING_1 }),
    ...fileLines.map((line) => new Paragraph(line)),
  ];

  const document = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename=milestone-${id}.docx`,
    },
  });
}
