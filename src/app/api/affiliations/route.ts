import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { buildArchiveFilter } from "@/lib/archive";
import { isElevatedRole } from "@/lib/access";
import { Affiliation } from "@/models/affiliation";
import { logCreate } from "@/lib/audit";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "@/lib/r2";

const R2_BUCKET = process.env.R2_BUCKET;

if (!R2_BUCKET) {
  throw new Error("Missing R2_BUCKET environment variable");
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isElevatedRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const archiveFilter = buildArchiveFilter(searchParams);

  await connectToDatabase();
  const affiliations = await Affiliation.find(archiveFilter)
    .sort({ updatedAt: -1 })
    .lean();

  const signed = await Promise.all(
    affiliations.map(async (affiliation) => {
      if (!affiliation.emblemStorage?.key) {
        return affiliation;
      }
      const command = new GetObjectCommand({
        Bucket: affiliation.emblemStorage.bucket ?? R2_BUCKET,
        Key: affiliation.emblemStorage.key,
      });
      const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

      let templateUrl: string | undefined;
      if (affiliation.emblemTemplateStorage?.key) {
        const templateCommand = new GetObjectCommand({
          Bucket: affiliation.emblemTemplateStorage.bucket ?? R2_BUCKET,
          Key: affiliation.emblemTemplateStorage.key,
        });
        templateUrl = await getSignedUrl(r2Client, templateCommand, {
          expiresIn: 3600,
        });
      }

      return { ...affiliation, emblemUrl: url, emblemTemplateUrl: templateUrl };
    })
  );

  return NextResponse.json(signed);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isElevatedRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { scientistName, institutionName } = body ?? {};

  if (!scientistName || !institutionName) {
    return NextResponse.json(
      { error: "scientistName and institutionName are required" },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const affiliation = await Affiliation.create({
    ...body,
    createdBy: session.user.id,
  });

  await logCreate({
    actorId: session.user.id,
    entityType: "Affiliation",
    entityId: affiliation._id,
  });

  return NextResponse.json(affiliation);
}
