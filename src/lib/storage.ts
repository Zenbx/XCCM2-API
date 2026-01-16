import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Configure storage path
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "profile_pictures");

// Ensure directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Save a profile picture to local storage
 * @param file - File object from FormData
 * @returns Relative path to the saved image (e.g., "/uploads/profile_pictures/abc.jpg")
 */
export async function saveProfilePicture(file: File): Promise<string> {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const extension = path.extname(file.name) || ".jpg";
    const filename = `${uuidv4()}${extension}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Save file
    await fs.promises.writeFile(filePath, buffer);

    return `/uploads/profile_pictures/${filename}`;
}
