import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { Note } from "../route";

const NOTES_FILE = path.join(
  process.env.HOME || "/home/wizzgeeks",
  ".openclaw/workspace/state/notes.json"
);

function readNotes(): Note[] {
  try {
    if (!fs.existsSync(NOTES_FILE)) return [];
    return JSON.parse(fs.readFileSync(NOTES_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeNotes(notes: Note[]) {
  fs.mkdirSync(path.dirname(NOTES_FILE), { recursive: true });
  fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2), "utf-8");
}

// PUT /api/notes/:id
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const title = (body.title || "").trim();
  const content = (body.content || "").trim();

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const notes = readNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  notes[idx] = { ...notes[idx], title, content, updatedAt: Date.now() };
  writeNotes(notes);
  return NextResponse.json(notes[idx]);
}

// DELETE /api/notes/:id
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notes = readNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  notes.splice(idx, 1);
  writeNotes(notes);
  return NextResponse.json({ success: true });
}
