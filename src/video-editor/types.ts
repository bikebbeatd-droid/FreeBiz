/**
 * CineAI Studio — Video Editor Type Definitions
 * Strict types for projects, multi-track timelines, media clips, AI plans, and rendering.
 */

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export type TrackType = 'video' | 'voice' | 'music' | 'sfx' | 'caption' | 'text';

export type MediaType = 'video' | 'audio' | 'image';

export type TransitionType = 'cut' | 'crossfade' | 'dip_black' | 'zoom' | 'slide_left';

export interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  url: string; // Blob URL, Data URL, or safe static asset
  duration: number; // in seconds
  width?: number;
  height?: number;
  fps?: number;
  fileSize?: number; // in bytes
  mimeType: string;
  waveform?: number[]; // Audio peaks for visualization
  transcript?: TranscriptSegment[];
}

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  words?: { word: string; start: number; end: number }[];
  isPause?: boolean;
  isFiller?: boolean;
}

export interface ColorGrading {
  brightness: number; // -100 to 100, default 0
  contrast: number; // -100 to 100, default 0
  saturation: number; // -100 to 100, default 0
  temperature: number; // -100 to 100 (warm/cool), default 0
  vignette: number; // 0 to 100, default 0
  preset?: 'natural' | 'cinematic' | 'vibrant' | 'noir' | 'vintage' | 'warm';
}

export interface Transform {
  scale: number; // 0.1 to 3.0, default 1.0
  positionX: number; // -100 to 100, default 0
  positionY: number; // -100 to 100, default 0
  rotation: number; // 0 to 360, default 0
  opacity: number; // 0 to 1, default 1.0
}

export interface Transition {
  type: TransitionType;
  duration: number; // in seconds, typically 0.3 - 1.0
}

export interface TimelineClip {
  id: string;
  trackId: string;
  assetId: string;
  name: string;
  type: MediaType;
  start: number; // Position on timeline in seconds
  end: number; // End position on timeline in seconds
  sourceStart: number; // In-point in source asset in seconds
  sourceEnd: number; // Out-point in source asset in seconds
  volume: number; // 0 to 2.0, default 1.0
  speed: number; // 0.25 to 4.0, default 1.0
  muted: boolean;
  colorGrading?: ColorGrading;
  transform?: Transform;
  transitionIn?: Transition;
  transitionOut?: Transition;
  captionText?: string;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  volume: number; // 0 to 2.0, default 1.0
  order: number;
}

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number; // in px
  textColor: string;
  highlightColor: string;
  backgroundColor: string; // rgba
  position: 'bottom' | 'middle' | 'top';
  outline: boolean;
}

export interface CaptionCue {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface AudioSettings {
  masterVolume: number;
  autoDucking: boolean;
  duckingAmountDb: number; // e.g. -12dB
  voiceTrackId?: string;
  musicTrackId?: string;
}

export interface ProjectSettings {
  id: string;
  name: string;
  aspectRatio: AspectRatio;
  resolutionWidth: number;
  resolutionHeight: number;
  fps: number;
  createdAt: number;
  updatedAt: number;
}

export interface VideoProject {
  settings: ProjectSettings;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  assets: MediaAsset[];
  captions: CaptionCue[];
  captionStyle: CaptionStyle;
  audioSettings: AudioSettings;
  duration: number; // computed timeline duration in seconds
  version: number;
}

// ==========================================
// AI Editing Schema
// ==========================================

export type OperationType =
  | 'trim'
  | 'split'
  | 'move'
  | 'delete'
  | 'duplicate'
  | 'caption'
  | 'transition'
  | 'effect'
  | 'color'
  | 'audio'
  | 'speed'
  | 'title';

export interface EditOperation {
  type: OperationType;
  clipId?: string;
  trackId?: string;
  start?: number;
  end?: number;
  time?: number;
  sourceStart?: number;
  sourceEnd?: number;
  value?: any;
  parameters?: Record<string, any>;
  description: string;
}

export interface EditPlan {
  id: string;
  prompt: string;
  summary: string;
  operations: EditOperation[];
  estimatedDurationDelta: number; // change in duration in seconds
  createdAt: number;
  isValidated: boolean;
  validationErrors: string[];
}

export interface RenderSettings {
  format: 'video/webm' | 'video/mp4';
  resolution: '720p' | '1080p' | '4k';
  width: number;
  height: number;
  fps: number;
  videoBitrate: number; // in bps
}

export interface RenderJob {
  id: string;
  projectId: string;
  status: 'queued' | 'rendering' | 'verifying' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0 to 100
  currentFrame: number;
  totalFrames: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  outputBlob?: Blob;
  outputUrl?: string;
  fileSizeBytes?: number;
  verifiedDuration?: number;
  verifiedResolution?: string;
  errorMessage?: string;
}
