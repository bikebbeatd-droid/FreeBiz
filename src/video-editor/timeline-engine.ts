/**
 * CineAI Studio — Timeline Engine
 * Pure, reliable timeline math, track operations, ripple edits, and clip transformations.
 */

import {
  VideoProject,
  TimelineClip,
  TimelineTrack,
  AspectRatio,
  CaptionStyle,
  AudioSettings
} from './types.js';

export function formatTimecode(seconds: number, fps: number = 30): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const totalFrames = Math.floor(seconds * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(seconds);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}.${pad(frames)}`;
}

export function parseTimecode(tc: string, fps: number = 30): number {
  if (!tc || typeof tc !== 'string') return 0;
  const parts = tc.trim().split(/[:.]/);
  if (parts.length < 3) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const mins = parseInt(parts[1], 10) || 0;
  const secs = parseInt(parts[2], 10) || 0;
  const frames = parts.length > 3 ? parseInt(parts[3], 10) || 0 : 0;
  return hours * 3600 + mins * 60 + secs + frames / fps;
}

export function computeProjectDuration(clips: TimelineClip[]): number {
  if (!clips || clips.length === 0) return 0;
  let maxEnd = 0;
  for (const clip of clips) {
    if (clip.end > maxEnd) {
      maxEnd = clip.end;
    }
  }
  return parseFloat(maxEnd.toFixed(3));
}

export function createDefaultTracks(): TimelineTrack[] {
  return [
    { id: 'track_video_1', name: 'Main Video', type: 'video', muted: false, solo: false, locked: false, volume: 1.0, order: 0 },
    { id: 'track_video_2', name: 'B-Roll & Overlays', type: 'video', muted: false, solo: false, locked: false, volume: 1.0, order: 1 },
    { id: 'track_caption_1', name: 'Captions & Titles', type: 'caption', muted: false, solo: false, locked: false, volume: 1.0, order: 2 },
    { id: 'track_voice_1', name: 'Voice & Speech', type: 'voice', muted: false, solo: false, locked: false, volume: 1.0, order: 3 },
    { id: 'track_music_1', name: 'Background Music', type: 'music', muted: false, solo: false, locked: false, volume: 0.6, order: 4 },
    { id: 'track_sfx_1', name: 'Sound FX', type: 'sfx', muted: false, solo: false, locked: false, volume: 0.8, order: 5 }
  ];
}

export function createDefaultProject(
  name: string = 'Untitled CineAI Project',
  aspectRatio: AspectRatio = '16:9'
): VideoProject {
  const resolutionMap: Record<AspectRatio, { w: number; h: number }> = {
    '16:9': { w: 1920, h: 1080 },
    '9:16': { w: 1080, h: 1920 },
    '1:1': { w: 1080, h: 1080 },
    '4:5': { w: 1080, h: 1350 }
  };

  const res = resolutionMap[aspectRatio] || resolutionMap['16:9'];

  const defaultCaptionStyle: CaptionStyle = {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 36,
    textColor: '#FFFFFF',
    highlightColor: '#06B6D4',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    position: 'bottom',
    outline: true
  };

  const defaultAudioSettings: AudioSettings = {
    masterVolume: 1.0,
    autoDucking: true,
    duckingAmountDb: -12,
    voiceTrackId: 'track_voice_1',
    musicTrackId: 'track_music_1'
  };

  return {
    settings: {
      id: 'proj_' + Math.random().toString(36).substring(2, 10),
      name,
      aspectRatio,
      resolutionWidth: res.w,
      resolutionHeight: res.h,
      fps: 30,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    tracks: createDefaultTracks(),
    clips: [],
    assets: [],
    captions: [],
    captionStyle: defaultCaptionStyle,
    audioSettings: defaultAudioSettings,
    duration: 0,
    version: 1
  };
}

/**
 * Splits a clip at a given timeline timestamp
 */
export function splitClip(
  clips: TimelineClip[],
  clipId: string,
  splitTime: number
): { newClips: TimelineClip[]; createdClipId?: string; error?: string } {
  const target = clips.find(c => c.id === clipId);
  if (!target) {
    return { newClips: clips, error: `Clip ${clipId} not found` };
  }

  // Precision clamp
  const time = parseFloat(splitTime.toFixed(3));
  if (time <= target.start + 0.05 || time >= target.end - 0.05) {
    return {
      newClips: clips,
      error: `Split time ${time}s must be strictly between clip start (${target.start}s) and end (${target.end}s)`
    };
  }

  const offset = time - target.start;
  const sourceSplit = target.sourceStart + offset * target.speed;

  const leftClip: TimelineClip = {
    ...target,
    end: time,
    sourceEnd: parseFloat(sourceSplit.toFixed(3))
  };

  const createdId = 'clip_' + Math.random().toString(36).substring(2, 9);
  const rightClip: TimelineClip = {
    ...target,
    id: createdId,
    name: `${target.name} (Part 2)`,
    start: time,
    sourceStart: parseFloat(sourceSplit.toFixed(3))
  };

  const newClips = clips.map(c => (c.id === clipId ? leftClip : c));
  newClips.push(rightClip);
  newClips.sort((a, b) => a.start - b.start);

  return { newClips, createdClipId: createdId };
}

/**
 * Trims a clip's start or end boundary
 */
export function trimClip(
  clips: TimelineClip[],
  clipId: string,
  newStart?: number,
  newEnd?: number
): { newClips: TimelineClip[]; error?: string } {
  const target = clips.find(c => c.id === clipId);
  if (!target) {
    return { newClips: clips, error: `Clip ${clipId} not found` };
  }

  let start = newStart !== undefined ? parseFloat(newStart.toFixed(3)) : target.start;
  let end = newEnd !== undefined ? parseFloat(newEnd.toFixed(3)) : target.end;

  if (end <= start + 0.1) {
    return { newClips: clips, error: 'Clip duration must be at least 0.1s' };
  }

  // Adjust source in/out
  const startDelta = start - target.start;
  const endDelta = end - target.end;

  const newSourceStart = target.sourceStart + startDelta * target.speed;
  const newSourceEnd = target.sourceEnd + endDelta * target.speed;

  if (newSourceStart < 0) {
    return { newClips: clips, error: 'Cannot trim before media start' };
  }

  const updated: TimelineClip = {
    ...target,
    start,
    end,
    sourceStart: parseFloat(newSourceStart.toFixed(3)),
    sourceEnd: parseFloat(newSourceEnd.toFixed(3))
  };

  const newClips = clips.map(c => (c.id === clipId ? updated : c));
  newClips.sort((a, b) => a.start - b.start);

  return { newClips };
}

/**
 * Moves a clip to a new start position and/or track
 */
export function moveClip(
  clips: TimelineClip[],
  clipId: string,
  newStart: number,
  targetTrackId?: string
): { newClips: TimelineClip[]; error?: string } {
  const target = clips.find(c => c.id === clipId);
  if (!target) {
    return { newClips: clips, error: `Clip ${clipId} not found` };
  }

  const start = Math.max(0, parseFloat(newStart.toFixed(3)));
  const duration = target.end - target.start;
  const end = parseFloat((start + duration).toFixed(3));
  const trackId = targetTrackId || target.trackId;

  // Collision check on target track (allow moving past existing clips without corruption)
  const updated: TimelineClip = {
    ...target,
    trackId,
    start,
    end
  };

  const newClips = clips.map(c => (c.id === clipId ? updated : c));
  newClips.sort((a, b) => a.start - b.start);

  return { newClips };
}

/**
 * Deletes a clip with optional ripple cut (shifts following clips to close gap)
 */
export function deleteClip(
  clips: TimelineClip[],
  clipId: string,
  ripple: boolean = false
): { newClips: TimelineClip[]; error?: string } {
  const target = clips.find(c => c.id === clipId);
  if (!target) {
    return { newClips: clips, error: `Clip ${clipId} not found` };
  }

  const gapDuration = target.end - target.start;
  const deletedStart = target.start;
  const targetTrack = target.trackId;

  let newClips = clips.filter(c => c.id !== clipId);

  if (ripple && gapDuration > 0) {
    // Shift subsequent clips on same track backward
    newClips = newClips.map(c => {
      if (c.trackId === targetTrack && c.start >= deletedStart) {
        return {
          ...c,
          start: Math.max(0, parseFloat((c.start - gapDuration).toFixed(3))),
          end: Math.max(0.1, parseFloat((c.end - gapDuration).toFixed(3)))
        };
      }
      return c;
    });
  }

  newClips.sort((a, b) => a.start - b.start);
  return { newClips };
}

/**
 * Duplicates a clip placed immediately after the original
 */
export function duplicateClip(
  clips: TimelineClip[],
  clipId: string
): { newClips: TimelineClip[]; createdClipId?: string; error?: string } {
  const target = clips.find(c => c.id === clipId);
  if (!target) {
    return { newClips: clips, error: `Clip ${clipId} not found` };
  }

  const duration = target.end - target.start;
  const createdId = 'clip_' + Math.random().toString(36).substring(2, 9);
  const copy: TimelineClip = {
    ...target,
    id: createdId,
    name: `${target.name} (Copy)`,
    start: target.end,
    end: parseFloat((target.end + duration).toFixed(3))
  };

  const newClips = [...clips, copy];
  newClips.sort((a, b) => a.start - b.start);
  return { newClips, createdClipId: createdId };
}

/**
 * Validates timeline clip consistency
 */
export function validateTimelineClips(clips: TimelineClip[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const clip of clips) {
    if (!clip.id) errors.push('Clip missing ID');
    if (!clip.trackId) errors.push(`Clip ${clip.id} missing track ID`);
    if (isNaN(clip.start) || clip.start < 0) errors.push(`Clip ${clip.id} invalid start time: ${clip.start}`);
    if (isNaN(clip.end) || clip.end <= clip.start) errors.push(`Clip ${clip.id} invalid end time: ${clip.end}`);
    if (clip.volume < 0 || clip.volume > 2.0) errors.push(`Clip ${clip.id} volume out of range: ${clip.volume}`);
    if (clip.speed <= 0) errors.push(`Clip ${clip.id} speed must be positive: ${clip.speed}`);
  }

  return { isValid: errors.length === 0, errors };
}
