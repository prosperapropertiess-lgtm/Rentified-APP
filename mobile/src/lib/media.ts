import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const BUCKET = 'documents';

/** Lets the user take a photo or pick several from the library. Returns local URIs. */
export async function pickPhotos(source: 'camera' | 'library'): Promise<string[]> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Camera access needed', 'Allow camera access in Settings to take photos.'); return []; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    return res.canceled ? [] : res.assets.map((a) => a.uri);
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: true, selectionLimit: 10 });
  return res.canceled ? [] : res.assets.map((a) => a.uri);
}

/** Uploads local images under `folder/` in storage and returns their storage paths. */
export async function uploadImages(folder: string, uris: string[]): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < uris.length; i++) {
    const base64 = await FileSystem.readAsStringAsync(uris[i], { encoding: 'base64' });
    const ext = (uris[i].split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z]/g, '') || 'jpg';
    const path = `${folder}/${Date.now()}-${i}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, decode(base64), { contentType: ext === 'png' ? 'image/png' : 'image/jpeg' });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

/** Turns private storage paths into short-lived links for display. */
export function useSignedUrls(paths: string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.join('|');
  useEffect(() => {
    const list = key ? key.split('|') : [];
    if (!list.length) return;
    let alive = true;
    supabase.storage.from(BUCKET).createSignedUrls(list, 3600).then(({ data }) => {
      if (!alive || !data) return;
      const map: Record<string, string> = {};
      for (const d of data) if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
      setUrls(map);
    });
    return () => { alive = false; };
  }, [key]);
  return urls;
}
