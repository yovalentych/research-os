"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import DOMPurify from "isomorphic-dompurify";
import "quill/dist/quill.snow.css";

const toolbarOptions = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["blockquote", "code-block"],
  ["link", "image"],
  ["clean"],
];

type Template = { label: string; html: string };
type QuillClass = typeof import("quill").default;
type QuillInstance = InstanceType<QuillClass>;

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  templates?: Template[];
  uploadContext?: { projectId?: string };
};

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  templates,
  uploadContext,
}: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<QuillInstance | null>(null);
  const initialValueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const uploadImage = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);
      if (uploadContext?.projectId) {
        formData.append("projectId", uploadContext.projectId);
      }

      const response = await fetch("/api/editor-media/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        console.error("Image upload failed");
        return;
      }

      const data = await response.json();
      if (!data?.url) return;
      const editor = quillRef.current;
      if (!editor) return;
      const range = editor.getSelection(true);
      editor.insertEmbed(range?.index ?? 0, "image", data.url, "user");
      editor.setSelection((range?.index ?? 0) + 1);
    };
  }, [uploadContext?.projectId]);

  const insertTemplate = useCallback((html: string) => {
    const editor = quillRef.current;
    if (!editor) return;
    const range = editor.getSelection(true);
    editor.clipboard.dangerouslyPasteHTML(range?.index ?? 0, html);
    editor.setSelection((range?.index ?? 0) + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let editor: QuillInstance | null = null;
    import("quill").then((module) => {
      if (!isMounted || !containerRef.current) return;
      const Quill = module.default as QuillClass;
      editor = new Quill(containerRef.current, {
        theme: "snow",
        modules: {
          toolbar: {
            container: toolbarOptions,
            handlers: {
              image: uploadImage,
            },
          },
        },
        placeholder,
      });
      editor.root.innerHTML = initialValueRef.current ?? "";
      quillRef.current = editor;
      editor.on("text-change", () => {
        const html = editor.root.innerHTML;
        const normalized = html === "<p><br></p>" ? "" : html;
        onChangeRef.current(normalized);
      });
    });
    return () => {
      isMounted = false;
      if (editor) {
        editor.off("text-change");
        editor.disable?.();
      }
      quillRef.current = null;
    };
  }, [placeholder, uploadImage]);

  useEffect(() => {
    const editor = quillRef.current;
    if (!editor) return;
    const normalizedValue = value ?? "";
    const current = editor.root.innerHTML;
    const normalizedCurrent = current === "<p><br></p>" ? "" : current;
    if (normalizedValue === normalizedCurrent) return;
    const selection = editor.getSelection();
    editor.clipboard.dangerouslyPasteHTML(normalizedValue);
    if (selection) {
      editor.setSelection(selection.index, selection.length);
    }
  }, [value]);

  return (
    <div className={`rich-text-editor ${className ?? ""}`}>
      {templates?.length ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {templates.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => insertTemplate(template.html)}
              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600"
            >
              {template.label}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={containerRef} className="min-h-[140px] rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}

export function RichTextViewer({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  const safe = useMemo(() => {
    if (!value) return "";
    const normalized = value.includes("<") ? value : value.replace(/\n/g, "<br />");
    return DOMPurify.sanitize(normalized);
  }, [value]);

  if (!safe) return null;

  return (
    <div className={`rich-text-viewer ql-snow ${className ?? ""}`}>
      <div
        className="ql-editor"
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    </div>
  );
}
