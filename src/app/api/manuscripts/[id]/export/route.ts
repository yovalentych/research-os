import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import PDFDocument from "pdfkit";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Manuscript } from "@/models/manuscript";
import { ManuscriptSection } from "@/models/manuscript-section";
import { hasManuscriptAccess } from "@/lib/manuscript-access";

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
  const manuscript = await Manuscript.findById(id).lean();

  if (!manuscript) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await hasManuscriptAccess(session, manuscript);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sections = await ManuscriptSection.find({ manuscriptId: manuscript._id })
    .sort({ sectionType: 1 })
    .lean();

  if (format === "pdf") {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));

    doc.fontSize(18).text(manuscript.title, { underline: true });
    doc.moveDown();

    sections.forEach((section) => {
      doc.fontSize(14).text(section.sectionType, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(section.content ?? "");
      doc.moveDown();
    });

    doc.end();
    const buffer = await new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=manuscript-${id}.pdf`,
      },
    });
  }

  const paragraphs = [
    new Paragraph({ text: manuscript.title, heading: HeadingLevel.TITLE }),
  ];

  sections.forEach((section) => {
    paragraphs.push(
      new Paragraph({
        text: section.sectionType,
        heading: HeadingLevel.HEADING_1,
      })
    );
    paragraphs.push(new Paragraph(section.content ?? ""));
  });

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
      "Content-Disposition": `attachment; filename=manuscript-${id}.docx`,
    },
  });
}
