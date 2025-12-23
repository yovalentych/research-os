import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/user";
import { Organization } from "@/models/organization";

const DEGREE_LEVELS = [
  "Бакалавр",
  "Магістр",
  "PhD/Докторант",
  "Постдок",
  "Науковець",
  "Інше",
] as const;

export async function POST(request: Request) {
  const body = await request.json();
  const {
    email,
    password,
    firstName,
    lastName,
    latinFirstName,
    latinLastName,
    degreeCompleted,
    degreeInProgress,
    organization,
  } = body ?? {};

  if (!email || !password || !firstName || !lastName) {
    return NextResponse.json(
      { error: "email, password, firstName, lastName are required" },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }

  let organizationId = undefined;
  let organizationName = undefined;
  if (organization?.name) {
    const rorId =
      typeof organization.rorId === "string" ? organization.rorId : undefined;
    const edboId =
      typeof organization.edboId === "string" ? organization.edboId : undefined;
    const edrpou =
      typeof organization.edrpou === "string" ? organization.edrpou : undefined;
    const existingOrg = edboId
      ? await Organization.findOne({ edboId }).lean()
      : edrpou
        ? await Organization.findOne({ edrpou }).lean()
        : rorId
          ? await Organization.findOne({ rorId }).lean()
          : await Organization.findOne({ name: organization.name }).lean();

    if (existingOrg) {
      organizationId = existingOrg._id;
      organizationName = existingOrg.name;
    } else {
      const created = await Organization.create({
        name: organization.name,
        rorId: rorId ?? undefined,
        edboId: edboId ?? undefined,
        edrpou: edrpou ?? undefined,
        institutionType: organization.institutionType ?? undefined,
        regionCode: organization.regionCode ?? undefined,
        legalName: organization.legalName ?? undefined,
        address: organization.address ?? undefined,
        country: organization.country ?? undefined,
        countryCode: organization.countryCode ?? undefined,
        city: organization.city ?? undefined,
        website: organization.website ?? undefined,
        types: Array.isArray(organization.types) ? organization.types : [],
        source: organization.source ?? undefined,
      });
      organizationId = created._id;
      organizationName = created.name;
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const fullName = `${firstName} ${lastName}`.trim();
  const latinFullName = [latinFirstName, latinLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const existingCount = await User.countDocuments();
  const role = existingCount === 0 ? "Owner" : "Collaborator";
  const safeCompleted = DEGREE_LEVELS.includes(degreeCompleted)
    ? degreeCompleted
    : undefined;
  const safeInProgress = DEGREE_LEVELS.includes(degreeInProgress)
    ? degreeInProgress
    : undefined;

  const user = await User.create({
    email,
    passwordHash,
    fullName,
    firstName,
    lastName,
    latinFirstName,
    latinLastName,
    latinFullName: latinFullName || undefined,
    globalRole: role,
    degreeLevel: safeCompleted,
    degreeCompleted: safeCompleted,
    degreeInProgress: safeInProgress,
    organizationId,
    organizationName,
  });

  return NextResponse.json({
    id: user._id.toString(),
    email: user.email,
    fullName: user.fullName,
    globalRole: user.globalRole,
  });
}
