import { NextResponse } from "next/server";
import { EdboInstitution } from "@/models/edbo-institution";
import { syncEdboInstitutions } from "@/lib/edbo";

type EdboInstitutionItem = {
  edboId: string;
  name: string;
  edrpou?: string;
  institutionType?: string;
  regionCode?: string;
  city?: string;
  address?: string;
  legalName?: string;
  website?: string;
  source: "edbo";
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json([]);
  }

  await syncEdboInstitutions();
  const cleanedQuery = query.trim();
  const numericQuery = cleanedQuery.replace(/\s/g, "");
  const matchByEdrpou = numericQuery.length >= 5 ? numericQuery : null;
  const regex = new RegExp(escapeRegex(cleanedQuery), "i");

  const sourceFilter = searchParams.get("source") ?? "all";
  let edboResults: EdboInstitutionItem[] = [];
  try {
    if (sourceFilter === "all" || sourceFilter === "edbo") {
      const edboItems = await EdboInstitution.find(
        matchByEdrpou
          ? { $or: [{ name: regex }, { edrpou: matchByEdrpou }] }
          : { name: regex }
      )
        .limit(15)
        .lean();
      edboResults = edboItems.map((item) => ({
        edboId: item.edboId,
        name: item.name,
        edrpou: item.edrpou ?? undefined,
        institutionType: item.institutionType ?? undefined,
        regionCode: item.regionCode ?? undefined,
        city: item.city ?? undefined,
        address: item.address ?? undefined,
        legalName: item.legalName ?? undefined,
        website: item.website ?? undefined,
        source: "edbo",
      }));
    }
  } catch {
    edboResults = [];
  }

  let rorResults: {
    name: string;
    rorId: string;
    country: string;
    countryCode: string;
    city: string;
    website: string;
    types: string[];
    source: "ror";
  }[] = [];

  if (sourceFilter === "all" || sourceFilter === "ror") {
    try {
      const response = await fetch(
        `https://api.ror.org/organizations?query=${encodeURIComponent(query)}&page=1`
      );
      if (response.ok) {
        const data = await response.json();
        type RorOrganization = {
          name?: string;
          id?: string;
          country?: { country_name?: string; country_code?: string };
          addresses?: { city?: string }[];
          links?: string[];
          types?: string[];
        };

        type RorItem = {
          organization?: RorOrganization;
        };

        const items = Array.isArray(data?.items) ? (data.items as RorItem[]) : [];

        rorResults = items.map((item) => {
          const organization = item?.organization ?? {};
          const addresses = Array.isArray(organization?.addresses)
            ? organization.addresses
            : [];
          const address = addresses[0] ?? {};
          const links = Array.isArray(organization?.links) ? organization.links : [];
          return {
            name: organization.name ?? "",
            rorId: organization.id ?? "",
            country: organization.country?.country_name ?? "",
            countryCode: organization.country?.country_code ?? "",
            city: address?.city ?? "",
            website: links[0] ?? "",
            types: organization.types ?? [],
            source: "ror",
          };
        });
      }
    } catch {
      rorResults = [];
    }
  }

  const results = [
    ...edboResults.map((item) => ({
      name: item.name,
      edboId: item.edboId,
      edrpou: item.edrpou ?? "",
      institutionType: item.institutionType ?? "",
      regionCode: item.regionCode ?? "",
      legalName: item.legalName ?? "",
      address: item.address ?? "",
      country: "Україна",
      countryCode: "UA",
      city: item.city ?? "",
      website: item.website ?? "",
      source: item.source,
    })),
    ...rorResults,
  ];

  return NextResponse.json(results.slice(0, 20));
}
