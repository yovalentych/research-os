'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAutoFocus } from './use-auto-focus';

type Affiliation = {
  _id: string;
  scientistName: string;
  scientistTitle?: string;
  institutionName: string;
  institutionLegalName?: string;
  department?: string;
  address?: string;
  officialCodes?: string;
  officialDetails?: string;
  website?: string;
  email?: string;
  phone?: string;
  emblemUrl?: string;
  emblemStorage?: { bucket: string; key: string } | null;
  emblemTemplateUrl?: string;
  emblemTemplateStorage?: { bucket: string; key: string } | null;
  notes?: string;
  archived?: boolean;
};

type AffiliationForm = Omit<Affiliation, '_id' | 'emblemUrl' | 'emblemStorage'>;

type OrganizationOption = {
  name: string;
  rorId?: string;
  edboId?: string;
  edrpou?: string;
  institutionType?: string;
  regionCode?: string;
  legalName?: string;
  address?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  website?: string;
  types?: string[];
  source?: 'edbo' | 'ror';
};

type LogoMeta = {
  type: string;
  size: number;
  width: number;
  height: number;
};

const emptyForm: AffiliationForm = {
  scientistName: '',
  scientistTitle: '',
  institutionName: '',
  institutionLegalName: '',
  department: '',
  address: '',
  officialCodes: '',
  officialDetails: '',
  website: '',
  email: '',
  phone: '',
  notes: '',
  archived: false,
};

const MAX_LOGO_SIZE = 512;
const CANVAS_SIZE = 260;

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log10(value) / 3));
  const size = value / Math.pow(1000, index);
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не вдалося прочитати зображення'));
    };
    img.src = url;
  });
}

function normalizeWebsite(value?: string) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function displayHostOrLabel(raw?: string) {
  if (!raw) return '';
  const href = normalizeWebsite(raw);
  if (!href) return raw;
  try {
    const url = new URL(href);
    const firstSeg = url.pathname.split('/').filter(Boolean)[0];
    return firstSeg ? `${url.host}/${firstSeg}` : url.host;
  } catch {
    return raw;
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

type CropState = { x: number; y: number; size: number };

type LogoCropperProps = {
  label: string;
  onFileReady: (file: File | null) => void;
  onPreviewReady?: (url: string | null) => void;
  applyTemplateUrl?: string | null;
  onTemplateApplied?: () => void;
  variant?: 'full' | 'compact';
};

function LogoCropper({
  label,
  onFileReady,
  onPreviewReady,
  applyTemplateUrl,
  onTemplateApplied,
  variant = 'full',
}: LogoCropperProps) {
  const compact = variant === 'compact';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const dragRef = useRef<{
    active: boolean;
    offsetX: number;
    offsetY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    vx: number;
    vy: number;
  }>({
    active: false,
    offsetX: 0,
    offsetY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    vx: 0,
    vy: 0,
  });

  const inertiaRef = useRef<number | null>(null);

  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [meta, setMeta] = useState<LogoMeta | null>(null);
  const [busy, setBusy] = useState(false);

  const [crop, setCrop] = useState<CropState>({ x: 40, y: 40, size: 180 });
  const [cropScale, setCropScale] = useState(1);

  useEffect(() => {
    return () => {
      if (sourcePreview) URL.revokeObjectURL(sourcePreview);
      if (processedPreview) URL.revokeObjectURL(processedPreview);
    };
  }, [sourcePreview, processedPreview]);

  useEffect(() => {
    if (!applyTemplateUrl) return;
    const run = async () => {
      try {
        setBusy(true);
        const response = await fetch(applyTemplateUrl);
        if (!response.ok) throw new Error('Не вдалося завантажити шаблон');
        const blob = await response.blob();
        const file = new File([blob], 'template.png', { type: blob.type });
        await handleFile(file);
      } catch {
        onFileReady(null);
        onPreviewReady?.(null);
      } finally {
        setBusy(false);
        onTemplateApplied?.();
      }
    };
    run();
  }, [applyTemplateUrl]);

  function getTransform(img: HTMLImageElement) {
    const scale = Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    const offsetX = (CANVAS_SIZE - drawWidth) / 2;
    const offsetY = (CANVAS_SIZE - drawHeight) / 2;
    return { scale, drawWidth, drawHeight, offsetX, offsetY };
  }

  function clampCrop(next: CropState, img: HTMLImageElement) {
    const { drawWidth, drawHeight, offsetX, offsetY } = getTransform(img);
    const size = Math.min(next.size, Math.min(drawWidth, drawHeight));
    const minX = offsetX;
    const minY = offsetY;
    const maxX = offsetX + drawWidth - size;
    const maxY = offsetY + drawHeight - size;
    return {
      x: Math.min(Math.max(next.x, minX), maxX),
      y: Math.min(Math.max(next.y, minY), maxY),
      size,
    };
  }

  function drawCanvas(nextCrop?: CropState) {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentCrop = nextCrop ?? crop;
    const { drawWidth, drawHeight, offsetX, offsetY } = getTransform(img);

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.clearRect(
      currentCrop.x,
      currentCrop.y,
      currentCrop.size,
      currentCrop.size
    );

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      currentCrop.x,
      currentCrop.y,
      currentCrop.size,
      currentCrop.size
    );
  }

  async function applyCrop(nextCrop?: CropState) {
    const img = imageRef.current;
    if (!img) return;

    const currentCrop = nextCrop ?? crop;
    const { scale, offsetX, offsetY } = getTransform(img);

    const cropX = Math.max(0, (currentCrop.x - offsetX) / scale);
    const cropY = Math.max(0, (currentCrop.y - offsetY) / scale);
    const cropSize = Math.max(1, currentCrop.size / scale);

    const canvas = document.createElement('canvas');
    canvas.width = MAX_LOGO_SIZE;
    canvas.height = MAX_LOGO_SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      img,
      cropX,
      cropY,
      cropSize,
      cropSize,
      0,
      0,
      MAX_LOGO_SIZE,
      MAX_LOGO_SIZE
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png', 0.92)
    );
    if (!blob) return;

    const file = new File([blob], `logo-${Date.now()}.png`, {
      type: 'image/png',
    });

    if (processedPreview) URL.revokeObjectURL(processedPreview);
    const previewUrl = URL.createObjectURL(blob);

    setProcessedPreview(previewUrl);
    setMeta({
      type: file.type,
      size: file.size,
      width: MAX_LOGO_SIZE,
      height: MAX_LOGO_SIZE,
    });

    onFileReady(file);
    onPreviewReady?.(previewUrl);
  }

  async function handleFile(file: File) {
    setBusy(true);

    if (sourcePreview) URL.revokeObjectURL(sourcePreview);
    if (processedPreview) URL.revokeObjectURL(processedPreview);

    const previewUrl = URL.createObjectURL(file);
    setSourcePreview(previewUrl);

    try {
      const img = await loadImage(file);
      imageRef.current = img;

      const { drawWidth, drawHeight, offsetX, offsetY } = getTransform(img);
      const size = Math.min(drawWidth, drawHeight) * cropScale;
      const nextCrop = clampCrop(
        {
          x: offsetX + (drawWidth - size) / 2,
          y: offsetY + (drawHeight - size) / 2,
          size,
        },
        img
      );

      setCrop(nextCrop);
      drawCanvas(nextCrop);
      await applyCrop(nextCrop);
    } catch {
      setSourcePreview(null);
      setProcessedPreview(null);
      setMeta(null);
      imageRef.current = null;

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      onFileReady(null);
      onPreviewReady?.(null);
    } finally {
      setBusy(false);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current.active || !imageRef.current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - dragRef.current.offsetX;
    const y = event.clientY - rect.top - dragRef.current.offsetY;

    const nextCrop = clampCrop({ ...crop, x, y }, imageRef.current);
    setCrop(nextCrop);
    drawCanvas(nextCrop);

    const now = performance.now();
    const dx = x - dragRef.current.lastX;
    const dy = y - dragRef.current.lastY;
    const dt = Math.max(16, now - dragRef.current.lastTime);

    dragRef.current.vx = dx / dt;
    dragRef.current.vy = dy / dt;
    dragRef.current.lastX = x;
    dragRef.current.lastY = y;
    dragRef.current.lastTime = now;
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!imageRef.current) return;

    if (inertiaRef.current) {
      cancelAnimationFrame(inertiaRef.current);
      inertiaRef.current = null;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const within =
      x >= crop.x &&
      x <= crop.x + crop.size &&
      y >= crop.y &&
      y <= crop.y + crop.size;

    if (!within) return;

    dragRef.current.active = true;
    dragRef.current.offsetX = x - crop.x;
    dragRef.current.offsetY = y - crop.y;
    dragRef.current.lastX = x - dragRef.current.offsetX;
    dragRef.current.lastY = y - dragRef.current.offsetY;
    dragRef.current.lastTime = performance.now();
    dragRef.current.vx = 0;
    dragRef.current.vy = 0;
  }

  async function handlePointerUp() {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;

    const speed = Math.hypot(dragRef.current.vx, dragRef.current.vy);
    if (speed > 0.2) startInertia();
    else await applyCrop();
  }

  async function handleScaleChange(next: number) {
    setCropScale(next);
    if (!imageRef.current) return;

    const img = imageRef.current;
    const { drawWidth, drawHeight, offsetX, offsetY } = getTransform(img);
    const size = Math.min(drawWidth, drawHeight) * next;

    const nextCrop = clampCrop(
      {
        x: offsetX + (drawWidth - size) / 2,
        y: offsetY + (drawHeight - size) / 2,
        size,
      },
      img
    );

    setCrop(nextCrop);
    drawCanvas(nextCrop);
    await applyCrop(nextCrop);
  }

  function startInertia() {
    if (!imageRef.current) return;
    if (inertiaRef.current) cancelAnimationFrame(inertiaRef.current);

    let vx = dragRef.current.vx * 20;
    let vy = dragRef.current.vy * 20;
    let currentCrop = crop;
    const friction = 0.9;

    const step = () => {
      if (!imageRef.current) return;

      const nextCrop = clampCrop(
        { ...currentCrop, x: currentCrop.x + vx, y: currentCrop.y + vy },
        imageRef.current
      );

      setCrop(nextCrop);
      drawCanvas(nextCrop);
      currentCrop = nextCrop;

      vx *= friction;
      vy *= friction;

      if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) {
        inertiaRef.current = null;
        applyCrop(nextCrop);
        return;
      }

      inertiaRef.current = requestAnimationFrame(step);
    };

    inertiaRef.current = requestAnimationFrame(step);
  }

  function clearAll() {
    if (sourcePreview) URL.revokeObjectURL(sourcePreview);
    if (processedPreview) URL.revokeObjectURL(processedPreview);
    setSourcePreview(null);
    setProcessedPreview(null);
    setMeta(null);
    imageRef.current = null;

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    onFileReady(null);
    onPreviewReady?.(null);
  }

  return (
    <div className="max-w-full overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-600">{label}</p>

      <div
        className={
          compact
            ? 'mt-3 space-y-3'
            : 'mt-3 grid gap-3 lg:grid-cols-[260px_1fr]'
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-2">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="h-[260px] w-[260px] max-w-full touch-none rounded-xl bg-slate-100"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700">
              {busy ? 'Обробка...' : 'Обрати файл'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  handleFile(file);
                }}
              />
            </label>

            <button
              type="button"
              onClick={clearAll}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
            >
              Очистити
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="shrink-0">Масштаб:</span>
            <input
              type="range"
              min={0.6}
              max={1}
              step={0.05}
              value={cropScale}
              onChange={(event) =>
                handleScaleChange(Number(event.target.value))
              }
              className="w-full"
            />
          </div>

          {meta ? (
            <p className="text-[11px] text-slate-500">
              Тип: {meta.type} · Розмір: {formatBytes(meta.size)} · {meta.width}
              ×{meta.height}
            </p>
          ) : null}
        </div>

        {compact ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Після
            </p>
            <div className="mt-2 flex h-32 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2">
              {processedPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={processedPreview}
                  alt="Після"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-xs text-slate-400">Немає обробки</div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Перетягни рамку. Якщо лого вже квадратне — залиш масштаб 1.0.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  До
                </p>
                <div className="mt-2 h-32 rounded-xl border border-slate-200 bg-slate-50 p-2">
                  {sourcePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sourcePreview}
                      alt="До"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">
                      Немає файлу
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Після
                </p>
                <div className="mt-2 h-32 rounded-xl border border-slate-200 bg-slate-50 p-2">
                  {processedPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={processedPreview}
                      alt="Після"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">
                      Немає обробки
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Перетягни рамку, щоб обрізати вручну. Якщо лого вже квадратне —
              залиш масштаб 1.0.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AffiliationsPanel() {
  const [items, setItems] = useState<Affiliation[]>([]);
  const [archived, setArchived] = useState<Affiliation[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const [form, setForm] = useState<AffiliationForm>({ ...emptyForm });
  const [createLogoFile, setCreateLogoFile] = useState<File | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const createFormRef = useRef<HTMLFormElement | null>(null);
  useAutoFocus(createOpen, createFormRef);

  const [editing, setEditing] = useState<Affiliation | null>(null);
  const [editForm, setEditForm] = useState<AffiliationForm>({ ...emptyForm });
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const [applyTemplateUrl, setApplyTemplateUrl] = useState<string | null>(null);

  const [previewLogo, setPreviewLogo] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const [templateMessage, setTemplateMessage] = useState<string | null>(null);

  const [listMessage, setListMessage] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  const [imgErrors, setImgErrors] = useState(0);

  const [copied, setCopied] = useState<string | null>(null);
  const [createOrgQuery, setCreateOrgQuery] = useState('');
  const [createOrgResults, setCreateOrgResults] = useState<OrganizationOption[]>([]);
  const [createOrgLoading, setCreateOrgLoading] = useState(false);
  const createOrgTimerRef = useRef<number | null>(null);
  const [createOrgSource, setCreateOrgSource] = useState<'all' | 'edbo' | 'ror'>(
    'all'
  );
  const [editOrgQuery, setEditOrgQuery] = useState('');
  const [editOrgResults, setEditOrgResults] = useState<OrganizationOption[]>([]);
  const [editOrgLoading, setEditOrgLoading] = useState(false);
  const editOrgTimerRef = useRef<number | null>(null);
  const [editOrgSource, setEditOrgSource] = useState<'all' | 'edbo' | 'ror'>(
    'all'
  );

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 1200);
    return () => window.clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    if (createOrgTimerRef.current) {
      window.clearTimeout(createOrgTimerRef.current);
    }
    const trimmed = createOrgQuery.trim();
    if (!trimmed || trimmed.length < 3) {
      setCreateOrgResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setCreateOrgLoading(true);
      try {
        const response = await fetch(
          `/api/organizations/search?q=${encodeURIComponent(
            trimmed
          )}&source=${createOrgSource}`
        );
        if (response.ok) {
          const data = await response.json();
          setCreateOrgResults(Array.isArray(data) ? data : []);
        }
      } finally {
        setCreateOrgLoading(false);
      }
    }, 350);
    createOrgTimerRef.current = timer;
    return () => window.clearTimeout(timer);
  }, [createOrgQuery, createOrgSource]);

  useEffect(() => {
    if (editOrgTimerRef.current) {
      window.clearTimeout(editOrgTimerRef.current);
    }
    const trimmed = editOrgQuery.trim();
    if (!trimmed || trimmed.length < 3) {
      setEditOrgResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setEditOrgLoading(true);
      try {
        const response = await fetch(
          `/api/organizations/search?q=${encodeURIComponent(
            trimmed
          )}&source=${editOrgSource}`
        );
        if (response.ok) {
          const data = await response.json();
          setEditOrgResults(Array.isArray(data) ? data : []);
        }
      } finally {
        setEditOrgLoading(false);
      }
    }, 350);
    editOrgTimerRef.current = timer;
    return () => window.clearTimeout(timer);
  }, [editOrgQuery, editOrgSource]);

  function buildOfficialCodes(option: OrganizationOption) {
    const codes = [];
    if (option.edrpou) {
      codes.push(`ЄДРПОУ ${option.edrpou}`);
    }
    if (option.edboId) {
      codes.push(`ЄДЕБО ${option.edboId}`);
    }
    if (option.rorId) {
      codes.push(`ROR ${option.rorId}`);
    }
    return codes.join('\n');
  }

  function applyOrgToCreate(option: OrganizationOption) {
    const codes = buildOfficialCodes(option);
    setForm((prev) => ({
      ...prev,
      institutionName: option.name,
      institutionLegalName:
        prev.institutionLegalName || option.legalName || option.name,
      address: prev.address || option.address || "",
      officialCodes: codes || prev.officialCodes,
      website: option.website || prev.website,
    }));
    setCreateOrgQuery(option.name);
    setCreateOrgResults([]);
  }

  function applyOrgToEdit(option: OrganizationOption) {
    const codes = buildOfficialCodes(option);
    setEditForm((prev) => ({
      ...prev,
      institutionName: option.name,
      institutionLegalName: prev.institutionLegalName || option.legalName || option.name,
      address: prev.address || option.address || "",
      officialCodes: codes || prev.officialCodes,
      website: option.website || prev.website,
    }));
    setEditOrgQuery(option.name);
    setEditOrgResults([]);
  }

  async function loadItems(archivedOnly = false) {
    const response = await fetch(
      `/api/affiliations${archivedOnly ? '?archived=1' : ''}`
    );
    if (response.ok) {
      const data = await response.json();
      if (archivedOnly) setArchived(data);
      else setItems(data);
    }
  }

  useEffect(() => {
    loadItems();
    setMounted(true);
    const interval = window.setInterval(() => loadItems(), 50 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (imgErrors === 0) return;
    loadItems();
  }, [imgErrors]);

  function openCreate() {
    setForm({ ...emptyForm });
    setCreateLogoFile(null);
    setCreateMessage(null);
    setListMessage(null);
    setCreateOrgQuery('');
    setCreateOrgResults([]);
    setCreateOrgSource('all');
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setCreateMessage(null);
    setCreateOrgResults([]);
  }

  function handleOpenEdit(item: Affiliation) {
    setEditing(item);
    setEditForm({
      scientistName: item.scientistName ?? '',
      scientistTitle: item.scientistTitle ?? '',
      institutionName: item.institutionName ?? '',
      institutionLegalName: item.institutionLegalName ?? '',
      department: item.department ?? '',
      address: item.address ?? '',
      officialCodes: item.officialCodes ?? '',
      officialDetails: item.officialDetails ?? '',
      website: item.website ?? '',
      email: item.email ?? '',
      phone: item.phone ?? '',
      notes: item.notes ?? '',
      archived: !!item.archived,
    });
    setEditLogoFile(null);
    setEditLogoPreview(null);
    setApplyTemplateUrl(null);
    setTemplateMessage(null);
    setEditMessage(null);
    setListMessage(null);
    setEditOrgQuery(item.institutionName ?? '');
    setEditOrgResults([]);
    setEditOrgSource('all');
  }

  function handleCloseEdit() {
    setEditing(null);
    setEditLogoFile(null);
    setEditLogoPreview(null);
    setApplyTemplateUrl(null);
    setTemplateMessage(null);
    setEditMessage(null);
    setEditOrgResults([]);
  }

  useEffect(() => {
    if (!editing && !previewLogo && !createOpen) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (previewLogo) {
        setPreviewLogo(null);
        return;
      }
      if (editing) {
        handleCloseEdit();
        return;
      }
      if (createOpen) closeCreate();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [editing, previewLogo, createOpen]);

  async function uploadLogo(affiliationId: string, file: File) {
    const formData = new FormData();
    formData.set('file', file);

    const response = await fetch(`/api/affiliations/${affiliationId}/logo`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? 'Не вдалося завантажити логотип');
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateMessage(null);

    const response = await fetch('/api/affiliations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        scientistName: form.scientistName || form.institutionName,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setCreateMessage(data.error ?? 'Не вдалося створити афіліацію');
      return;
    }

    const created = await response.json();

    if (createLogoFile) {
      try {
        await uploadLogo(created._id, createLogoFile);
      } catch (error) {
        setCreateMessage(
          error instanceof Error
            ? error.message
            : 'Не вдалося завантажити логотип'
        );
      }
    }

    await loadItems();
    closeCreate();
  }

  async function handleUpdate() {
    if (!editing) return;
    setEditMessage(null);

    const response = await fetch(`/api/affiliations/${editing._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editForm,
        scientistName: editForm.institutionName,
        scientistTitle: '',
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setEditMessage(data.error ?? 'Не вдалося оновити афіліацію');
      return;
    }

    if (editLogoFile) {
      try {
        await uploadLogo(editing._id, editLogoFile);
      } catch (error) {
        setEditMessage(
          error instanceof Error
            ? error.message
            : 'Не вдалося завантажити логотип'
        );
        return;
      }
    }

    handleCloseEdit();
    loadItems();
  }

  async function handleRemoveLogo() {
    if (!editing) return;
    setEditMessage(null);

    const response = await fetch(`/api/affiliations/${editing._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emblemStorage: null }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setEditMessage(data.error ?? 'Не вдалося видалити логотип');
      return;
    }

    setEditLogoFile(null);
    setEditLogoPreview(null);
    setEditing((prev) =>
      prev ? { ...prev, emblemStorage: null, emblemUrl: undefined } : prev
    );
    loadItems();
  }

  async function handleSaveTemplate() {
    if (!editing || !editLogoFile) return;
    setTemplateMessage(null);

    const formData = new FormData();
    formData.set('file', editLogoFile);

    const response = await fetch(
      `/api/affiliations/${editing._id}/logo-template`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setTemplateMessage(data.error ?? 'Не вдалося зберегти шаблон');
      return;
    }

    setTemplateMessage('Шаблон логотипу збережено');
    loadItems();
  }

  async function handleArchive(id: string) {
    setListMessage(null);

    const response = await fetch(`/api/affiliations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setListMessage(data.error ?? 'Не вдалося архівувати афіліацію');
      return;
    }

    loadItems();
    if (showArchived) loadItems(true);
  }

  async function handleRestore(id: string) {
    setListMessage(null);

    const response = await fetch(`/api/affiliations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: false }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setListMessage(data.error ?? 'Не вдалося відновити афіліацію');
      return;
    }

    loadItems();
    loadItems(true);
  }

  const renderItem = (label: string, value?: string) => {
    if (!value) return null;

    const Row = ({ children }: { children: React.ReactNode }) => (
      <div className="flex min-w-0 items-start gap-2 text-xs text-slate-600">
        <span className="shrink-0 text-slate-400">{label}</span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    );

    if (label === 'Вебсайт') {
      const href = normalizeWebsite(value);
      if (!href) {
        return (
          <Row>
            <span className="block min-w-0 break-words font-medium text-slate-700">
              {value}
            </span>
          </Row>
        );
      }

      const pretty = displayHostOrLabel(value);

      return (
        <Row>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
              title={href}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="opacity-80"
              >
                <path
                  d="M14 5h5v5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 14L19 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M19 14v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Відкрити сайт</span>
              <span className="text-slate-400 font-medium">({pretty})</span>
            </a>

            <button
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(href);
                if (ok) setCopied('Посилання скопійовано');
              }}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
              title="Скопіювати посилання"
              aria-label="Скопіювати посилання"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="opacity-80"
              >
                <path
                  d="M8 8h11v11H8V8z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="sr-only">Copy</span>
            </button>
          </div>
        </Row>
      );
    }

    return (
      <Row>
        <span className="block min-w-0 break-words font-medium text-slate-700">
          {value}
        </span>
      </Row>
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Афіліації</h3>
            <p className="mt-2 text-sm text-slate-600">
              Інституційні картки для підтягання реквізитів і даних науковця.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
          >
            Додати
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-slate-600">
              Поки немає афіліацій. Додай першу картку.
            </p>
          ) : (
            items.map((item) => {
              const logoUrl = item.emblemStorage?.key
                ? item.emblemUrl ?? null
                : null;
              const websiteUrl = normalizeWebsite(item.website);

              return (
                <div
                  key={item._id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (!logoUrl) return;
                        setPreviewLogo({
                          url: logoUrl,
                          title: item.institutionName,
                        });
                      }}
                      disabled={!logoUrl}
                      className={[
                        'h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50',
                        logoUrl ? 'cursor-zoom-in' : 'cursor-default',
                      ].join(' ')}
                      aria-label={
                        logoUrl ? 'Переглянути лого' : 'Лого відсутнє'
                      }
                    >
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoUrl}
                          alt={item.institutionName}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                          Logo
                        </div>
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          {websiteUrl ? (
                            <a
                              href={websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block min-w-0 break-words text-base font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:text-slate-700"
                              title={item.institutionName}
                            >
                              {item.institutionName}
                            </a>
                          ) : (
                            <p className="min-w-0 break-words text-base font-semibold text-slate-900">
                              {item.institutionName}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            Редагувати
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchive(item._id)}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                          >
                            Архівувати
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {renderItem('Підрозділ', item.department)}
                        {renderItem('Адреса', item.address)}
                        {/* ПРИБРАНО: "Офіційна назва" бо дублює заголовок */}
                        {renderItem('Коди', item.officialCodes)}
                        {renderItem('Контакти', item.email || item.phone)}
                        {renderItem('Вебсайт', item.website)}
                      </div>

                      {item.notes ? (
                        <p className="mt-3 text-xs text-slate-500">
                          {item.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              const next = !showArchived;
              setShowArchived(next);
              if (next) loadItems(true);
            }}
            className="text-xs font-semibold text-slate-500"
          >
            {showArchived ? 'Сховати архів' : 'Показати архів'}
          </button>

          {showArchived ? (
            <div className="mt-3 space-y-2">
              {archived.length === 0 ? (
                <p className="text-xs text-slate-500">Архів порожній.</p>
              ) : (
                archived.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                  >
                    <span className="font-semibold">
                      {item.institutionName}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRestore(item._id)}
                      className="text-xs font-semibold text-slate-600"
                    >
                      Відновити
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>

        {listMessage ? (
          <p className="mt-4 text-sm text-slate-600">{listMessage}</p>
        ) : null}
      </section>

      {copied ? (
        <div className="fixed bottom-6 right-6 z-[200] rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {copied}
        </div>
      ) : null}

      {/* CREATE MODAL */}
      {createOpen && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={closeCreate}
              />

              <div className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_40px_90px_rgba(15,23,42,0.25)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 p-5 backdrop-blur">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Нова афіліація
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">
                      Додати інституцію
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={closeCreate}
                    className="text-xs font-semibold text-slate-500"
                  >
                    Закрити
                  </button>
                </div>

                <div className="max-h-[82vh] overflow-y-auto p-5">
                  <form
                    ref={createFormRef}
                    onSubmit={handleCreate}
                    className="grid gap-5 lg:grid-cols-[420px_1fr]"
                  >
                    <div className="min-w-0 space-y-4">
                      <LogoCropper
                        label="Лого інституції (manual crop)"
                        onFileReady={setCreateLogoFile}
                        variant="compact"
                      />
                      <p className="text-[11px] text-slate-400">
                        У модалці кропер завжди “stacked”, щоб нічого не
                        залазило на поля.
                      </p>
                    </div>

                    <div className="min-w-0 space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                          Пошук у реєстрах
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {[
                            { id: 'all', label: 'Обидва' },
                            { id: 'edbo', label: 'ЄДЕБО' },
                            { id: 'ror', label: 'ROR' },
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() =>
                                setCreateOrgSource(item.id as 'all' | 'edbo' | 'ror')
                              }
                              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                                createOrgSource === item.id
                                  ? 'bg-slate-900 text-white'
                                  : 'border border-slate-200 text-slate-600'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        <input
                          value={createOrgQuery}
                          onChange={(event) => setCreateOrgQuery(event.target.value)}
                          placeholder="ЄДЕБО або ROR: назва інституції"
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                        {createOrgLoading ? (
                          <p className="mt-2 text-xs text-slate-500">Пошук...</p>
                        ) : null}
                        {createOrgResults.length ? (
                          <div className="mt-2 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-white text-xs text-slate-600">
                            {createOrgResults.map((option, index) => (
                              <button
                                key={`${option.edboId ?? option.rorId ?? option.name}-${index}`}
                                type="button"
                                onClick={() => applyOrgToCreate(option)}
                                className="flex w-full items-start justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
                              >
                                <div>
                                  <p className="font-semibold text-slate-900">
                                    {option.name}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    {option.city ? `${option.city}, ` : ''}
                                    {option.country ?? ''}
                                    {option.edrpou ? ` · ЄДРПОУ ${option.edrpou}` : ''}
                                  </p>
                                </div>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                                  {option.source === 'edbo'
                                    ? 'ЄДЕБО'
                                    : option.rorId
                                      ? 'ROR'
                                      : 'ORG'}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <input
                        required
                        value={form.institutionName}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            institutionName: event.target.value,
                          }))
                        }
                        placeholder="Назва інституції"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <input
                        value={form.institutionLegalName}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            institutionLegalName: event.target.value,
                          }))
                        }
                        placeholder="Офіційна назва інституції (опційно)"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <input
                        value={form.department}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            department: event.target.value,
                          }))
                        }
                        placeholder="Підрозділ"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <textarea
                        value={form.address}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            address: event.target.value,
                          }))
                        }
                        placeholder="Адреса"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        rows={2}
                      />
                      <textarea
                        value={form.officialCodes}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            officialCodes: event.target.value,
                          }))
                        }
                        placeholder="Коди, реквізити (ЄДРПОУ, ROR, інше)"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        rows={2}
                      />
                      <textarea
                        value={form.officialDetails}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            officialDetails: event.target.value,
                          }))
                        }
                        placeholder="Офіційні реквізити"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        rows={2}
                      />

                      <div className="grid gap-2 md:grid-cols-3">
                        <input
                          value={form.website}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              website: event.target.value,
                            }))
                          }
                          placeholder="Вебсайт"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                        <input
                          value={form.email}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              email: event.target.value,
                            }))
                          }
                          placeholder="Email"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                        <input
                          value={form.phone}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              phone: event.target.value,
                            }))
                          }
                          placeholder="Телефон"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>

                      <textarea
                        value={form.notes}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            notes: event.target.value,
                          }))
                        }
                        placeholder="Додаткові нотатки"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        rows={2}
                      />

                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={closeCreate}
                          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Скасувати
                        </button>
                        <button
                          type="submit"
                          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                        >
                          Створити
                        </button>
                      </div>

                      {createMessage ? (
                        <p className="text-sm text-slate-600">
                          {createMessage}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-slate-400">
                        Esc — закрити
                      </p>
                    </div>
                  </form>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {/* EDIT MODAL */}
      {editing && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={handleCloseEdit}
              />

              <div className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_40px_90px_rgba(15,23,42,0.25)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 p-5 backdrop-blur">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Редагування
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">
                      {editing.institutionName}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseEdit}
                    className="text-xs font-semibold text-slate-500"
                  >
                    Закрити
                  </button>
                </div>

                <div className="max-h-[82vh] overflow-y-auto p-5">
                  <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
                    <div className="min-w-0 space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-600">
                          Поточне лого
                        </p>
                        <div className="mt-3 flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          {editing.emblemStorage?.key && editing.emblemUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={editing.emblemUrl}
                              alt="Логотип"
                              className="h-24 w-24 object-contain"
                              onError={() => setImgErrors((prev) => prev + 1)}
                            />
                          ) : (
                            <div className="text-xs text-slate-400">Logo</div>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {editing.emblemStorage?.key && editing.emblemUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewLogo({
                                  url: editing.emblemUrl!,
                                  title: editing.institutionName,
                                })
                              }
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                            >
                              Переглянути
                            </button>
                          ) : null}

                          {editLogoFile ? (
                            <button
                              type="button"
                              onClick={handleSaveTemplate}
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                            >
                              Зберегти як шаблон
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                          >
                            Видалити
                          </button>
                        </div>

                        {templateMessage ? (
                          <p className="mt-2 text-xs text-slate-500">
                            {templateMessage}
                          </p>
                        ) : null}
                      </div>

                      <LogoCropper
                        label="Нове лого (manual crop)"
                        onFileReady={setEditLogoFile}
                        onPreviewReady={setEditLogoPreview}
                        applyTemplateUrl={applyTemplateUrl}
                        onTemplateApplied={() => setApplyTemplateUrl(null)}
                        variant="compact"
                      />

                      <p className="text-[11px] text-slate-400">
                        {editing.emblemTemplateStorage?.key
                          ? 'Є збережений шаблон логотипу.'
                          : 'Шаблон логотипу ще не збережено.'}
                      </p>

                      {editing.emblemTemplateStorage?.key &&
                      editing.emblemTemplateUrl ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="h-10 w-10 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={editing.emblemTemplateUrl}
                              alt="Шаблон"
                              className="h-full w-full object-contain"
                              onError={() => setImgErrors((prev) => prev + 1)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setApplyTemplateUrl(
                                editing.emblemTemplateUrl ?? null
                              )
                            }
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                          >
                            Застосувати шаблон
                          </button>
                        </div>
                      ) : null}

                      {editLogoPreview ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                            Попередній перегляд
                          </p>
                          <div className="mt-2 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={editLogoPreview}
                              alt="Нове лого"
                              className="h-20 w-20 object-contain"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-0 space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                          Пошук у реєстрах
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {[
                            { id: 'all', label: 'Обидва' },
                            { id: 'edbo', label: 'ЄДЕБО' },
                            { id: 'ror', label: 'ROR' },
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() =>
                                setEditOrgSource(item.id as 'all' | 'edbo' | 'ror')
                              }
                              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                                editOrgSource === item.id
                                  ? 'bg-slate-900 text-white'
                                  : 'border border-slate-200 text-slate-600'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        <input
                          value={editOrgQuery}
                          onChange={(event) => setEditOrgQuery(event.target.value)}
                          placeholder="ЄДЕБО або ROR: назва інституції"
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                        {editOrgLoading ? (
                          <p className="mt-2 text-xs text-slate-500">Пошук...</p>
                        ) : null}
                        {editOrgResults.length ? (
                          <div className="mt-2 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-white text-xs text-slate-600">
                            {editOrgResults.map((option, index) => (
                              <button
                                key={`${option.edboId ?? option.rorId ?? option.name}-${index}`}
                                type="button"
                                onClick={() => applyOrgToEdit(option)}
                                className="flex w-full items-start justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
                              >
                                <div>
                                  <p className="font-semibold text-slate-900">
                                    {option.name}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    {option.city ? `${option.city}, ` : ''}
                                    {option.country ?? ''}
                                    {option.edrpou ? ` · ЄДРПОУ ${option.edrpou}` : ''}
                                  </p>
                                </div>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                                  {option.source === 'edbo'
                                    ? 'ЄДЕБО'
                                    : option.rorId
                                      ? 'ROR'
                                      : 'ORG'}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <input
                          value={editForm.institutionName}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              institutionName: event.target.value,
                            }))
                          }
                          placeholder="Назва інституції"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                        <input
                          value={editForm.institutionLegalName}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              institutionLegalName: event.target.value,
                            }))
                          }
                          placeholder="Офіційна назва (опційно)"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>

                      <input
                        value={editForm.department}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            department: event.target.value,
                          }))
                        }
                        placeholder="Підрозділ"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />

                      <textarea
                        value={editForm.address}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            address: event.target.value,
                          }))
                        }
                        placeholder="Адреса"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        rows={2}
                      />

                      <textarea
                        value={editForm.officialCodes}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            officialCodes: event.target.value,
                          }))
                        }
                        placeholder="Коди, реквізити"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        rows={2}
                      />

                      <textarea
                        value={editForm.officialDetails}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            officialDetails: event.target.value,
                          }))
                        }
                        placeholder="Офіційні реквізити"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        rows={2}
                      />

                      <div className="grid gap-2 md:grid-cols-3">
                        <input
                          value={editForm.website}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              website: event.target.value,
                            }))
                          }
                          placeholder="Вебсайт"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                        <input
                          value={editForm.email}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              email: event.target.value,
                            }))
                          }
                          placeholder="Email"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                        <input
                          value={editForm.phone}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              phone: event.target.value,
                            }))
                          }
                          placeholder="Телефон"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>

                      <textarea
                        value={editForm.notes}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            notes: event.target.value,
                          }))
                        }
                        placeholder="Нотатки"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        rows={2}
                      />

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleCloseEdit}
                          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Скасувати
                        </button>
                        <button
                          type="button"
                          onClick={handleUpdate}
                          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                        >
                          Зберегти зміни
                        </button>
                      </div>

                      {editMessage ? (
                        <p className="mt-3 text-sm text-slate-600">
                          {editMessage}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-slate-400">
                        Esc — закрити
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {/* PREVIEW LOGO MODAL */}
      {previewLogo && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={() => setPreviewLogo(null)}
              />
              <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_40px_90px_rgba(15,23,42,0.25)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 p-5 backdrop-blur">
                  <p className="text-sm font-semibold text-slate-800">
                    {previewLogo.title}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPreviewLogo(null)}
                    className="text-xs font-semibold text-slate-500"
                  >
                    Закрити
                  </button>
                </div>
                <div className="max-h-[80vh] overflow-y-auto p-5">
                  <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewLogo.url}
                      alt={previewLogo.title}
                      className="max-h-[70vh] w-auto object-contain"
                    />
                  </div>
                  <p className="mt-3 text-xs text-slate-400">Esc — закрити</p>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
