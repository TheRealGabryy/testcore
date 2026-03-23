export interface ProjectMeta {
  id: string;
  name: string;
  width: number;
  height: number;
  background: string;
  createdAt: number;
  updatedAt: number;
  thumbnail: string;
}

export interface SerializedLayer {
  coreId: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

export interface SerializedClip {
  coreId: string;
  name: string;
  color: string;
  type: string;
  delay: number;
  duration: number;
  sourceInput?: string;
  props: Record<string, unknown>;
}

export interface ProjectData extends ProjectMeta {
  layers: SerializedLayer[];
  clips: Record<string, SerializedClip[]>;
  zoom: number;
}

export const RESOLUTION_PRESETS = [
  { label: '1920 × 1080', sublabel: 'Full HD', width: 1920, height: 1080 },
  { label: '1280 × 720', sublabel: 'HD', width: 1280, height: 720 },
  { label: '3840 × 2160', sublabel: '4K UHD', width: 3840, height: 2160 },
  { label: '720 × 1280', sublabel: 'Vertical HD', width: 720, height: 1280 },
  { label: '1080 × 1080', sublabel: 'Square', width: 1080, height: 1080 },
  { label: '2560 × 1440', sublabel: '2K QHD', width: 2560, height: 1440 },
] as const;
