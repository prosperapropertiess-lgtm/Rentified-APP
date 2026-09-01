// Generates a PDF from an HTML template (see htmlTemplates.ts — these are
// clearly-labeled drafts, not official forms) and uploads it to the same
// `documents` storage bucket the rest of the app already uses, rather than
// creating a separate storage system.

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../supabase';

export async function generateAndUploadPdf(html: string, landlordId: string, fileName: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

  // Sanitize: keep it a useful, human-readable filename (spec section 29),
  // not a raw UUID, while still stripping characters storage paths dislike.
  const safeName = fileName.replace(/[^a-zA-Z0-9-_. ]/g, '');
  const path = `${landlordId}/ltb/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from('documents').upload(path, decode(base64), { contentType: 'application/pdf' });
  if (error) throw error;

  return path;
}
