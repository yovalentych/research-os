import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id).lean();
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const organization = user.organizationId
    ? await Organization.findById(user.organizationId).lean()
    : null;

  return NextResponse.json({
    email: user.email,
    fullName: user.fullName ?? "",
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    latinFirstName: user.latinFirstName ?? "",
    latinLastName: user.latinLastName ?? "",
    latinFullName: user.latinFullName ?? "",
    degreeCompleted: user.degreeCompleted ?? user.degreeLevel ?? "",
    degreeInProgress: user.degreeInProgress ?? "",
    publicProfile: user.publicProfile ?? true,
    contactVisibility: user.contactVisibility ?? "public",
    organizationName: user.organizationName ?? "",
    organization: organization
      ? {
          name: organization.name ?? "",
          rorId: organization.rorId ?? "",
          edboId: organization.edboId ?? "",
          edrpou: organization.edrpou ?? "",
          institutionType: organization.institutionType ?? "",
          regionCode: organization.regionCode ?? "",
          legalName: organization.legalName ?? "",
          address: organization.address ?? "",
          country: organization.country ?? "",
          countryCode: organization.countryCode ?? "",
          city: organization.city ?? "",
          website: organization.website ?? "",
          types: Array.isArray(organization.types) ? organization.types : [],
          source: organization.source ?? "",
        }
      : null,
    plan: user.plan ?? "free",
    planStatus: user.planStatus ?? "active",
    planRenewalAt: user.planRenewalAt ?? null,
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    firstName,
    lastName,
    latinFirstName,
    latinLastName,
    degreeCompleted,
    degreeInProgress,
    publicProfile,
    contactVisibility,
    organization,
  } = body ?? {};

  await connectToDatabase();
  const user = await User.findById(session.user.id).lean();
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof firstName === "string") updates.firstName = firstName.trim();
  if (typeof lastName === "string") updates.lastName = lastName.trim();
  if (typeof latinFirstName === "string")
    updates.latinFirstName = latinFirstName.trim();
  if (typeof latinLastName === "string")
    updates.latinLastName = latinLastName.trim();

  const fullName = `${updates.firstName ?? user.firstName ?? ""} ${
    updates.lastName ?? user.lastName ?? ""
  }`.trim();
  if (fullName) {
    updates.fullName = fullName;
  }

  const latinFullName = `${
    updates.latinFirstName ?? user.latinFirstName ?? ""
  } ${updates.latinLastName ?? user.latinLastName ?? ""}`.trim();
  if (latinFullName) {
    updates.latinFullName = latinFullName;
  }

  if (DEGREE_LEVELS.includes(degreeCompleted)) {
    updates.degreeCompleted = degreeCompleted;
    updates.degreeLevel = degreeCompleted;
  }
  if (degreeInProgress === "" || degreeInProgress === null) {
    updates.degreeInProgress = "";
  }
  if (DEGREE_LEVELS.includes(degreeInProgress)) {
    updates.degreeInProgress = degreeInProgress;
  }
  if (typeof publicProfile === "boolean") {
    updates.publicProfile = publicProfile;
  }
  if (contactVisibility === "public" || contactVisibility === "email") {
    updates.contactVisibility = contactVisibility;
  }

  if (organization === null) {
    updates.organizationId = null;
    updates.organizationName = "";
  }

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
      updates.organizationId = existingOrg._id;
      updates.organizationName = existingOrg.name;
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
      updates.organizationId = created._id;
      updates.organizationName = created.name;
    }
  }

  const updated = await User.findByIdAndUpdate(
    session.user.id,
    { $set: updates },
    { new: true }
  ).lean();

  return NextResponse.json({
    email: updated?.email ?? user.email,
    fullName: updated?.fullName ?? user.fullName ?? "",
    firstName: updated?.firstName ?? "",
    lastName: updated?.lastName ?? "",
    latinFirstName: updated?.latinFirstName ?? "",
    latinLastName: updated?.latinLastName ?? "",
    latinFullName: updated?.latinFullName ?? user.latinFullName ?? "",
    degreeCompleted: updated?.degreeCompleted ?? updated?.degreeLevel ?? "",
    degreeInProgress: updated?.degreeInProgress ?? "",
    publicProfile: updated?.publicProfile ?? user.publicProfile ?? true,
    contactVisibility: updated?.contactVisibility ?? user.contactVisibility ?? "public",
    organizationName: updated?.organizationName ?? "",
    plan: updated?.plan ?? user.plan ?? "free",
    planStatus: updated?.planStatus ?? user.planStatus ?? "active",
    planRenewalAt: updated?.planRenewalAt ?? user.planRenewalAt ?? null,
  });
}
