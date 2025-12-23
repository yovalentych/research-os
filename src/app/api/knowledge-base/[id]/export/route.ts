import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import PDFDocument from "pdfkit";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { KnowledgeBaseEntry } from "@/models/knowledge-base-entry";

export const runtime = "nodejs";

function stripHtml(value?: string | null) {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

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
  const entry = await KnowledgeBaseEntry.findById(
    new mongoose.Types.ObjectId(id)
  ).lean();

  if (!entry || entry.archivedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (format === "pdf") {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));

    doc.fontSize(18).text(entry.title, { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Категорія: ${entry.category ?? "—"}`);
    if (entry.tags?.length) {
      doc.text(`Теги: ${entry.tags.join(", ")}`);
    }
    if (entry.visibility) {
      doc.text(`Доступ: ${entry.visibility}`);
    }
    doc.moveDown();
    doc.fontSize(11).text(stripHtml(entry.content));
    doc.end();

    const buffer = await new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=knowledge-${id}.pdf`,
      },
    });
  }

  const paragraphs = [
    new Paragraph({ text: entry.title, heading: HeadingLevel.TITLE }),
    new Paragraph(`Категорія: ${entry.category ?? "—"}`),
  ];

  if (entry.tags?.length) {
    paragraphs.push(new Paragraph(`Теги: ${entry.tags.join(", ")}`));
  }
  if (entry.visibility) {
    paragraphs.push(new Paragraph(`Доступ: ${entry.visibility}`));
  }
  paragraphs.push(new Paragraph(""));
  paragraphs.push(new Paragraph(stripHtml(entry.content)));

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
      "Content-Disposition": `attachment; filename=knowledge-${id}.docx`,
    },
  });
}
