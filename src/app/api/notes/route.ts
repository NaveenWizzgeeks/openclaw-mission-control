import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

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

// GET /api/notes?q=search
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase().trim();
  let notes = readNotes();

  if (q) {
    notes = notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
    );
  }

  notes.sort((a, b) => b.updatedAt - a.updatedAt);
  return NextResponse.json(notes);
}

// POST /api/notes
export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = (body.title || "").trim();
  const content = (body.content || "").trim();

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const now = Date.now();
  const note: Note = { id: randomUUID(), title, content, createdAt: now, updatedAt: now };
  const notes = readNotes();
  notes.push(note);
  writeNotes(notes);

  return NextResponse.json(note, { status: 201 });
}
