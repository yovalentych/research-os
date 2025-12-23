import { connectToDatabase } from "@/lib/db";
import { EdboInstitution } from "@/models/edbo-institution";
import { SourceCache } from "@/models/source-cache";

const EDBO_BASE_URL = "https://registry.edbo.gov.ua/api/universities/";
const EDBO_TYPES = [
  { ut: 1, label: "ЗВО" },
  { ut: 8, label: "Науковий інститут" },
];
const EDBO_CACHE_KEY = "edbo-universities";
const DEFAULT_INTERVAL_DAYS = 7;

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

function normalizeEdboRecord(record: Record<string, unknown>, label: string) {
  const idRaw =
    record.id ??
    record.university_id ??
    record.universityId ??
    record.UNIVERSITY_ID ??
    record.universityID;
  const nameRaw =
    record.name ??
    record.university_name ??
    record.full_name ??
    record.university_full_name ??
    record.universityName ??
    record.NAME;

  if (!nameRaw || !idRaw) return null;

  const edrpouRaw =
    record.edrpou ??
    record.code_edrpou ??
    record.edrpou_code ??
    record.edrpouCode ??
    record.EDRPOU;
  const regionRaw =
    record.lc ??
    record.region_code ??
    record.regionCode ??
    record.region ??
    record.REGION;
  const cityRaw =
    record.city ??
    record.settlement ??
    record.town ??
    record.locality ??
    record.CITY;
  const addressRaw =
    record.address ??
    record.postal_address ??
    record.location ??
    record.location_address ??
    record.ADDRESS;
  const legalNameRaw =
    record.legal_name ??
    record.legalName ??
    record.full_name ??
    record.university_full_name ??
    record.university_full ??
    record.FULL_NAME;
  const websiteRaw =
    record.website ??
    record.site ??
    record.url ??
    record.web ??
    record.SITE;

  return {
    edboId: String(idRaw),
    name: String(nameRaw),
    edrpou: edrpouRaw ? String(edrpouRaw) : undefined,
    institutionType: label,
    regionCode: regionRaw ? String(regionRaw) : undefined,
    city: cityRaw ? String(cityRaw) : undefined,
    address: addressRaw ? String(addressRaw) : undefined,
    legalName: legalNameRaw ? String(legalNameRaw) : undefined,
    website: websiteRaw ? String(websiteRaw) : undefined,
    source: "edbo",
  };
}

export async function syncEdboInstitutions(force = false) {
  await connectToDatabase();
  const cached = await SourceCache.findOne({ key: EDBO_CACHE_KEY }).lean();
  const intervalDays = cached?.intervalDays ?? DEFAULT_INTERVAL_DAYS;
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  const needsSync =
    force || !cached || Date.now() - new Date(cached.syncedAt).getTime() > intervalMs;

  if (!needsSync) {
    return cached?.syncedAt ?? null;
  }

  await SourceCache.updateOne(
    { key: EDBO_CACHE_KEY },
    {
      $set: {
        syncInProgress: true,
        syncStartedAt: new Date(),
        syncTotal: EDBO_TYPES.length,
        syncProcessed: 0,
        syncMessage: "Починаємо синхронізацію",
        intervalDays,
      },
      $setOnInsert: {
        syncedAt: new Date(0),
      },
    },
    { upsert: true }
  );

  const records: EdboInstitutionItem[] = [];
  let processed = 0;
  for (const type of EDBO_TYPES) {
    const url = `${EDBO_BASE_URL}?ut=${type.ut}&exp=json`;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const payload = await response.json();
      const items = Array.isArray(payload) ? payload : payload?.data ?? [];
      if (!Array.isArray(items)) continue;
      items.forEach((record: Record<string, unknown>) => {
        const normalized = normalizeEdboRecord(record, type.label);
        if (normalized) records.push(normalized);
      });
    } catch {
      processed += 1;
      await SourceCache.updateOne(
        { key: EDBO_CACHE_KEY },
        {
          $set: {
            syncProcessed: processed,
            syncMessage: `Не вдалося завантажити тип ${type.label}`,
          },
        }
      );
      continue;
    }
    processed += 1;
    await SourceCache.updateOne(
      { key: EDBO_CACHE_KEY },
      {
        $set: {
          syncProcessed: processed,
          syncMessage: `Завантажено ${type.label}`,
        },
      }
    );
  }

  if (!records.length) {
    await SourceCache.updateOne(
      { key: EDBO_CACHE_KEY },
      {
        $set: {
          syncInProgress: false,
          syncMessage: "Немає нових даних для синхронізації",
        },
      }
    );
    return cached?.syncedAt ?? null;
  }

  await EdboInstitution.deleteMany({});
  await EdboInstitution.insertMany(records, { ordered: false });
  const syncedAt = new Date();
  await SourceCache.updateOne(
    { key: EDBO_CACHE_KEY },
    {
      $set: {
        syncedAt,
        syncInProgress: false,
        syncMessage: "Синхронізація завершена",
      },
    },
    { upsert: true }
  );
  return syncedAt;
}

export async function getEdboSyncInfo() {
  await connectToDatabase();
  const cached = await SourceCache.findOne({ key: EDBO_CACHE_KEY }).lean();
  const count = await EdboInstitution.countDocuments();
  return {
    syncedAt: cached?.syncedAt ?? null,
    intervalDays: cached?.intervalDays ?? DEFAULT_INTERVAL_DAYS,
    syncInProgress: cached?.syncInProgress ?? false,
    syncStartedAt: cached?.syncStartedAt ?? null,
    syncTotal: cached?.syncTotal ?? null,
    syncProcessed: cached?.syncProcessed ?? null,
    syncMessage: cached?.syncMessage ?? null,
    count,
  };
}
