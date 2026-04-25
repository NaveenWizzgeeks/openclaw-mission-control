"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, Plus, Trash2, Save, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

type EditorState = { mode: "new" } | { mode: "edit"; note: Note } | null;

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchNotes = useCallback(async (q = "") => {
    const url = q ? `/api/notes?q=${encodeURIComponent(q)}` : "/api/notes";
    const res = await fetch(url);
    if (res.ok) setNotes(await res.json());
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleSearch = (val: string) => {
    setQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchNotes(val), 300);
  };

  const openNew = () => {
    setEditor({ mode: "new" });
    setTitle("");
    setContent("");
  };

  const openEdit = (note: Note) => {
    setEditor({ mode: "edit", note });
    setTitle(note.title);
    setContent(note.content);
  };

  const closeEditor = () => {
    setEditor(null);
    setTitle("");
    setContent("");
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (editor?.mode === "new") {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content }),
        });
        if (res.ok) {
          closeEditor();
          fetchNotes(query);
        }
      } else if (editor?.mode === "edit") {
        const res = await fetch(`/api/notes/${editor.note.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content }),
        });
        if (res.ok) {
          closeEditor();
          fetchNotes(query);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(id);
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (editor?.mode === "edit" && editor.note.id === id) closeEditor();
        fetchNotes(query);
      }
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Sidebar list */}
      <aside className="w-72 border-r border-border flex flex-col bg-card">
        {/* Search + New */}
        <div className="p-3 space-y-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search notes…"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Note
          </button>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <FileText className="h-8 w-8 opacity-30" />
              <p className="text-sm">{query ? "No matches" : "No notes yet"}</p>
            </div>
          ) : (
            notes.map((note) => {
              const isActive = editor?.mode === "edit" && editor.note.id === note.id;
              return (
                <div
                  key={note.id}
                  onClick={() => openEdit(note)}
                  className={cn(
                    "flex items-start gap-2 px-3 py-3 cursor-pointer border-b border-border group transition-colors",
                    isActive
                      ? "bg-primary/10"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", isActive && "text-primary")}>
                      {note.title}
                    </p>
                    {note.content && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {note.content}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                      {timeAgo(note.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(note.id, e)}
                    disabled={deleting === note.id}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Editor panel */}
      <div className="flex-1 flex flex-col bg-background">
        {editor ? (
          <>
            <div className="flex items-center gap-3 px-6 py-3 border-b border-border">
              <input
                type="text"
                placeholder="Note title…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 text-lg font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
              />
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={closeEditor}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              placeholder="Write your note here…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 px-6 py-4 text-sm bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/40 leading-relaxed"
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <FileText className="h-12 w-12 opacity-20" />
            <p className="text-sm">Select a note or create a new one</p>
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
