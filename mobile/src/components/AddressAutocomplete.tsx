import React, { useState, useRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, ActivityIndicator } from 'react-native';

// React Native equivalent of the website's AddressAutocomplete.tsx —
// that one loads the Google Maps JS SDK via a <script> tag and uses its
// browser-only Autocomplete widget, which doesn't exist in React Native.
// This calls the same underlying Places API directly over HTTP instead:
// Autocomplete (as the user types) -> Place Details (once they pick one,
// to get the actual address components) -- same two-step flow the JS SDK
// does internally, just done by hand.

interface PlaceResult {
  formatted_address: string;
  street_address: string;
  city?: string;
  province?: string;
  postal_code?: string;
  lat: number;
  lng: number;
}

interface Prediction {
  place_id: string;
  description: string;
}

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  onPlaceSelect: (place: PlaceResult) => void;
  placeholder?: string;
  country?: string;
}

const DEBOUNCE_MS = 300;

export default function AddressAutocomplete({ value, onChangeText, onPlaceSelect, placeholder = 'Start typing an address...', country = 'ca' }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef<string>(randomSessionToken());

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  const fetchPredictions = useCallback(async (text: string) => {
    if (!apiKey || text.trim().length < 3) { setPredictions([]); return; }
    setLoading(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${apiKey}&components=country:${country}&types=address&sessiontoken=${sessionTokenRef.current}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK') {
        setPredictions((data.predictions ?? []).map((p: any) => ({ place_id: p.place_id, description: p.description })));
      } else {
        console.error('AddressAutocomplete: Places API returned', data.status, data.error_message);
        setPredictions([]);
      }
    } catch (e) {
      console.error('AddressAutocomplete: fetch failed', e);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, [apiKey, country]);

  function handleChangeText(text: string) {
    onChangeText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(text), DEBOUNCE_MS);
  }

  async function handleSelect(prediction: Prediction) {
    setPredictions([]);
    if (!apiKey) return;
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&key=${apiKey}&fields=formatted_address,address_component,geometry&sessiontoken=${sessionTokenRef.current}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status !== 'OK' || !data.result) return;

      const result = data.result;
      let streetNumber = '';
      let route = '';
      let city = '';
      let province = '';
      let postal_code = '';
      for (const comp of result.address_components ?? []) {
        if (comp.types.includes('street_number')) streetNumber = comp.long_name;
        if (comp.types.includes('route')) route = comp.long_name;
        if (comp.types.includes('locality')) city = comp.long_name;
        if (comp.types.includes('administrative_area_level_1')) province = comp.short_name;
        if (comp.types.includes('postal_code')) postal_code = comp.long_name;
      }
      const streetAddress = streetNumber && route ? `${streetNumber} ${route}` : (result.formatted_address?.split(',')[0] ?? prediction.description);

      onChangeText(streetAddress);
      onPlaceSelect({
        formatted_address: result.formatted_address ?? prediction.description,
        street_address: streetAddress,
        city: city || undefined,
        province: province || undefined,
        postal_code: postal_code || undefined,
        lat: result.geometry?.location?.lat,
        lng: result.geometry?.location?.lng,
      });
      sessionTokenRef.current = randomSessionToken();
    } catch {
      // A failed details lookup shouldn't lose what the user already typed —
      // the text input keeps whatever they had, they can just retype/retry.
    }
  }

  return (
    <View>
      <View className="bg-card border border-navy-border rounded-xl p-4 flex-row items-center">
        <TextInput
          className="flex-1 font-sans text-navy"
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color="#1F2F3A" />}
      </View>

      {predictions.length > 0 && (
        <View className="bg-white border border-navy-border rounded-xl mt-1 overflow-hidden">
          {predictions.map((p, i) => (
            <TouchableOpacity
              key={p.place_id}
              onPress={() => handleSelect(p)}
              className={`p-3.5 ${i !== predictions.length - 1 ? 'border-b border-navy-border/30' : ''}`}
            >
              <Text className="text-navy font-sans text-[13px]">{p.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!apiKey && (
        <Text className="text-amber-700 font-sans text-[11px] mt-1">Address autocomplete isn&apos;t configured — type the address manually.</Text>
      )}
    </View>
  );
}

function randomSessionToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
