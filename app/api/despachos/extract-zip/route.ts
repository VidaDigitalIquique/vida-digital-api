import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import JSZip from "jszip";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) return NextResponse.json({ error: "Falta el archivo ZIP" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    const extractedFiles: { name: string, base64: string }[] = [];

    // Extract valid images
    for (const [filename, zipEntry] of Object.entries(zip.files)) {
      if (!zipEntry.dir && filename.match(/\.(jpg|jpeg|png|webp)$/i)) {
        // Read as base64 so client can re-submit them as standard DataURIs to the queue
        const base64Data = await zipEntry.async("base64");
        // Infer basic mime type from extension
        const ext = filename.split('.').pop()?.toLowerCase() || 'jpeg';
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        
        extractedFiles.push({
          name: filename,
          base64: `data:${mime};base64,${base64Data}`
        });
      }
    }

    return NextResponse.json({ files: extractedFiles });

  } catch (error: any) {
    console.error("GET /api/despachos/extract-zip error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
