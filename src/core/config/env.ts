export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  mapboxAccessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? '',
  mapboxStyleLight: import.meta.env.VITE_MAPBOX_STYLE_LIGHT ?? 'mapbox://styles/mapbox/streets-v12',
  mapboxStyleDark: import.meta.env.VITE_MAPBOX_STYLE_DARK ?? 'mapbox://styles/mapbox/dark-v11',
};
