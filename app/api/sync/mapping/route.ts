import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const MAPPING_FILE = path.join(process.cwd(), "treez-opticon-mapping.json");

interface MappingEntry {
  opticonProductId: string;
  treezProductId: string;
  treezSku: string;
  barcode: string;
}

interface MappingData {
  mappings: MappingEntry[];
}

// Read mapping file
function readMapping(): MappingData {
  try {
    const content = fs.readFileSync(MAPPING_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return { mappings: [] };
  }
}

// Write mapping file
function writeMapping(data: MappingData): void {
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  try {
    const data = readMapping();
    return NextResponse.json({
      success: true,
      mappings: data.mappings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to read mappings",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const entry = await request.json() as MappingEntry;
    
    const data = readMapping();
    
    // Update existing or add new
    const existingIndex = data.mappings.findIndex(
      m => m.opticonProductId === entry.opticonProductId
    );
    
    if (existingIndex >= 0) {
      data.mappings[existingIndex] = entry;
    } else {
      data.mappings.push(entry);
    }
    
    writeMapping(data);
    
    console.log(`[Mapping] Saved: Opticon #${entry.opticonProductId} → Treez ${entry.treezProductId}`);
    
    return NextResponse.json({
      success: true,
      mapping: entry,
    });
  } catch (error) {
    console.error("Mapping save error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save mapping",
      },
      { status: 500 }
    );
  }
}
