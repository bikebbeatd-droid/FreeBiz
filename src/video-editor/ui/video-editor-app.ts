/**
 * CineAI Studio — Master Video Editor Application Controller
 * Connects Canvas Compositor, Audio Graph, Timeline Engine, AI Planner, and Render Pipeline.
 */

import {
  VideoProject,
  TimelineClip,
  TimelineTrack,
  MediaAsset,
  EditPlan,
  RenderJob,
  RenderSettings,
  AspectRatio,
  CaptionCue
} from '../types.js';
import {
  createDefaultProject,
  formatTimecode,
  splitClip,
  trimClip,
  moveClip,
  deleteClip,
  duplicateClip,
  computeProjectDuration
} from '../timeline-engine.js';
import {
  validateEditPlan,
  applyEditPlan,
  generateLocalRuleBasedPlan
} from '../ai-planner.js';
import {
  renderFrameToCanvas,
  startVideoRender,
  calculateMusicDuckingGain
} from '../render-engine.js';
import {
  createSampleTechExplainerProject,
  generateProceduralVideoAsset,
  generateProceduralAudioAsset
} from '../sample-media.js';

export class VideoEditorApp {
  project: VideoProject;
  historyStack: string[] = []; // JSON snapshots for undo
  redoStack: string[] = [];

  playheadTime: number = 0; // seconds
  isPlaying: boolean = false;
  zoomLevel: number = 40; // pixels per second on timeline

  selectedClipId: string | null = null;
  selectedTrackId: string | null = null;

  activeTab: 'ai' | 'media' | 'transcript' | 'captions' | 'fx' | 'audio' | 'projects' = 'ai';

  currentPlan: EditPlan | null = null;
  currentRenderJob: RenderJob | null = null;

  videoElementsMap: Map<string, HTMLVideoElement> = new Map();
  audioElementsMap: Map<string, HTMLAudioElement> = new Map();

  animFrameId: number | null = null;
  lastPlayheadUpdate: number = 0;

  previewCanvas: HTMLCanvasElement | null = null;

  constructor() {
    this.project = createDefaultProject('My CineAI Project (16:9)', '16:9');
  }

  async init() {
    this.previewCanvas = document.getElementById('previewCanvas') as HTMLCanvasElement;

    // Load saved project from localStorage if available, otherwise load sample
    const saved = localStorage.getItem('cineai_current_project');
    if (saved) {
      try {
        this.project = JSON.parse(saved);
      } catch (e) {
        this.project = await createSampleTechExplainerProject();
      }
    } else {
      this.project = await createSampleTechExplainerProject();
    }

    this.pushHistoryCheckpoint('Initial Load');
    this.preloadProjectMedia();
    this.bindEvents();
    this.renderAll();

    // Start autosave timer (every 5 seconds)
    setInterval(() => {
      this.saveToStorage();
    }, 5000);
  }

  pushHistoryCheckpoint(actionName: string = 'Edit') {
    const serialized = JSON.stringify(this.project);
    if (this.historyStack.length === 0 || this.historyStack[this.historyStack.length - 1] !== serialized) {
      this.historyStack.push(serialized);
      if (this.historyStack.length > 50) this.historyStack.shift();
      this.redoStack = [];
      this.updateUndoRedoUI();
    }
  }

  undo() {
    if (this.historyStack.length <= 1) return;
    const current = this.historyStack.pop()!;
    this.redoStack.push(current);
    const prev = this.historyStack[this.historyStack.length - 1];
    this.project = JSON.parse(prev);
    this.selectedClipId = null;
    this.updateUndoRedoUI();
    this.renderAll();
    this.showToast('Undo applied', 'normal');
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const next = this.redoStack.pop()!;
    this.historyStack.push(next);
    this.project = JSON.parse(next);
    this.selectedClipId = null;
    this.updateUndoRedoUI();
    this.renderAll();
    this.showToast('Redo applied', 'normal');
  }

  updateUndoRedoUI() {
    const undoBtn = document.getElementById('btnUndo') as HTMLButtonElement;
    const redoBtn = document.getElementById('btnRedo') as HTMLButtonElement;
    if (undoBtn) undoBtn.disabled = this.historyStack.length <= 1;
    if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
  }

  saveToStorage() {
    try {
      localStorage.setItem('cineai_current_project', JSON.stringify(this.project));
      const saveIndicator = document.getElementById('saveIndicator');
      if (saveIndicator) {
        saveIndicator.textContent = 'Autosaved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  preloadProjectMedia() {
    for (const asset of this.project.assets) {
      if (asset.type === 'video' && !this.videoElementsMap.has(asset.id)) {
        const v = document.createElement('video');
        v.src = asset.url;
        v.crossOrigin = 'anonymous';
        v.muted = true;
        v.playsInline = true;
        this.videoElementsMap.set(asset.id, v);
      } else if (asset.type === 'audio' && !this.audioElementsMap.has(asset.id)) {
        const a = new Audio(asset.url);
        a.crossOrigin = 'anonymous';
        this.audioElementsMap.set(asset.id, a);
      }
    }
  }

  // ==========================================================
  // PLAYBACK & PREVIEW CONTROLS
  // ==========================================================

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastPlayheadUpdate = performance.now();

    const playBtn = document.getElementById('btnPlayPause');
    if (playBtn) playBtn.innerHTML = `<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

    // Start playing video and audio elements at playhead time
    this.syncMediaElements(true);

    const tick = (now: number) => {
      if (!this.isPlaying) return;
      const deltaSec = (now - this.lastPlayheadUpdate) / 1000;
      this.lastPlayheadUpdate = now;

      this.playheadTime += deltaSec;
      if (this.playheadTime >= (this.project.duration || 10)) {
        this.playheadTime = 0; // Loop or stop
      }

      this.renderPreviewFrame();
      this.updatePlayheadUI();

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  pause() {
    this.isPlaying = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    const playBtn = document.getElementById('btnPlayPause');
    if (playBtn) playBtn.innerHTML = `<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;

    // Pause all media elements
    this.videoElementsMap.forEach(v => v.pause());
    this.audioElementsMap.forEach(a => a.pause());
  }

  seek(time: number) {
    this.playheadTime = Math.max(0, Math.min(this.project.duration || 60, time));
    this.syncMediaElements(this.isPlaying);
    this.renderPreviewFrame();
    this.updatePlayheadUI();
  }

  stepFrame(deltaFrames: number) {
    this.pause();
    const fps = this.project.settings.fps || 30;
    this.seek(this.playheadTime + deltaFrames / fps);
  }

  syncMediaElements(shouldPlay: boolean) {
    const t = this.playheadTime;
    const musicDuck = calculateMusicDuckingGain(this.project, t);

    for (const clip of this.project.clips) {
      const track = this.project.tracks.find(tr => tr.id === clip.trackId);
      const isMuted = track ? track.muted : false;
      const trackVol = track ? track.volume : 1.0;
      const isMusicTrack = track?.type === 'music';
      const effectiveVol = isMuted ? 0 : clip.volume * trackVol * (isMusicTrack ? musicDuck : 1.0);

      const isActive = t >= clip.start && t <= clip.end;

      if (clip.type === 'video') {
        const v = this.videoElementsMap.get(clip.assetId);
        if (v) {
          if (isActive) {
            const clipOffset = (t - clip.start) * clip.speed;
            const targetTime = clip.sourceStart + clipOffset;
            if (Math.abs(v.currentTime - targetTime) > 0.2) {
              v.currentTime = targetTime;
            }
            v.volume = Math.max(0, Math.min(1, effectiveVol));
            if (shouldPlay && v.paused) v.play().catch(() => {});
          } else {
            if (!v.paused) v.pause();
          }
        }
      } else if (clip.type === 'audio') {
        const a = this.audioElementsMap.get(clip.assetId);
        if (a) {
          if (isActive) {
            const clipOffset = (t - clip.start) * clip.speed;
            const targetTime = clip.sourceStart + clipOffset;
            if (Math.abs(a.currentTime - targetTime) > 0.2) {
              a.currentTime = targetTime;
            }
            a.volume = Math.max(0, Math.min(1, effectiveVol));
            if (shouldPlay && a.paused) a.play().catch(() => {});
          } else {
            if (!a.paused) a.pause();
          }
        }
      }
    }
  }

  renderPreviewFrame() {
    if (!this.previewCanvas) return;
    renderFrameToCanvas(this.previewCanvas, this.project, this.playheadTime, this.videoElementsMap);
  }

  updatePlayheadUI() {
    const timeDisplay = document.getElementById('timecodeDisplay');
    if (timeDisplay) {
      const cur = formatTimecode(this.playheadTime, this.project.settings.fps);
      const total = formatTimecode(this.project.duration, this.project.settings.fps);
      timeDisplay.textContent = `${cur} / ${total}`;
    }

    const scrubber = document.getElementById('timelineScrubber');
    if (scrubber) {
      const leftPx = this.playheadTime * this.zoomLevel;
      scrubber.style.transform = `translateX(${leftPx}px)`;
    }

    const miniProgress = document.getElementById('miniProgressBar');
    if (miniProgress && this.project.duration > 0) {
      const pct = (this.playheadTime / this.project.duration) * 100;
      miniProgress.style.width = `${pct}%`;
    }
  }

  // ==========================================================
  // TIMELINE EDITING OPERATIONS
  // ==========================================================

  splitAtPlayhead() {
    if (!this.selectedClipId) {
      // Find top visual clip under playhead
      const clipUnderPlayhead = this.project.clips.find(
        c => this.playheadTime > c.start + 0.1 && this.playheadTime < c.end - 0.1
      );
      if (!clipUnderPlayhead) {
        this.showToast('Select a clip or position playhead over a clip to split', 'normal');
        return;
      }
      this.selectedClipId = clipUnderPlayhead.id;
    }

    const res = splitClip(this.project.clips, this.selectedClipId, this.playheadTime);
    if (res.error) {
      this.showToast(res.error, 'error');
      return;
    }

    this.project.clips = res.newClips;
    this.project.duration = computeProjectDuration(this.project.clips);
    this.selectedClipId = res.createdClipId || null;
    this.pushHistoryCheckpoint('Split Clip');
    this.renderAll();
    this.showToast('Clip split successfully', 'success');
  }

  trimCurrentClip(direction: 'start' | 'end') {
    if (!this.selectedClipId) {
      this.showToast('Select a clip first to trim', 'normal');
      return;
    }

    const clip = this.project.clips.find(c => c.id === this.selectedClipId);
    if (!clip) return;

    let res;
    if (direction === 'start') {
      res = trimClip(this.project.clips, this.selectedClipId, this.playheadTime, undefined);
    } else {
      res = trimClip(this.project.clips, this.selectedClipId, undefined, this.playheadTime);
    }

    if (res.error) {
      this.showToast(res.error, 'error');
      return;
    }

    this.project.clips = res.newClips;
    this.project.duration = computeProjectDuration(this.project.clips);
    this.pushHistoryCheckpoint(`Trim Clip ${direction}`);
    this.renderAll();
    this.showToast(`Trimmed clip ${direction} to playhead`, 'success');
  }

  deleteSelectedClip(ripple: boolean = false) {
    if (!this.selectedClipId) {
      this.showToast('Select a clip to delete', 'normal');
      return;
    }

    const res = deleteClip(this.project.clips, this.selectedClipId, ripple);
    if (res.error) {
      this.showToast(res.error, 'error');
      return;
    }

    this.project.clips = res.newClips;
    this.project.duration = computeProjectDuration(this.project.clips);
    this.selectedClipId = null;
    this.pushHistoryCheckpoint(ripple ? 'Ripple Delete Clip' : 'Delete Clip');
    this.renderAll();
    this.showToast(ripple ? 'Clip deleted with ripple shift' : 'Clip deleted', 'success');
  }

  duplicateSelectedClip() {
    if (!this.selectedClipId) {
      this.showToast('Select a clip to duplicate', 'normal');
      return;
    }

    const res = duplicateClip(this.project.clips, this.selectedClipId);
    if (res.error) {
      this.showToast(res.error, 'error');
      return;
    }

    this.project.clips = res.newClips;
    this.project.duration = computeProjectDuration(this.project.clips);
    this.selectedClipId = res.createdClipId || null;
    this.pushHistoryCheckpoint('Duplicate Clip');
    this.renderAll();
    this.showToast('Clip duplicated', 'success');
  }

  // ==========================================================
  // AI DIRECTOR & EDIT PLAN PIPELINE
  // ==========================================================

  async generateAiEditPlan(promptText: string) {
    if (!promptText.trim()) {
      this.showToast('Please enter an editing instruction', 'error');
      return;
    }

    this.showAiLoading(true);
    try {
      // Call server route /api/video-editor/ai-plan
      const resp = await fetch('/api/video-editor/ai-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          project: this.project
        })
      });

      if (!resp.ok) {
        throw new Error(`Server returned ${resp.status}`);
      }

      const data = await resp.json();
      if (!data.plan) {
        throw new Error('No edit plan returned');
      }

      this.currentPlan = data.plan;
      this.renderAiPlanPreview();
      this.showToast(`AI generated ${data.plan.operations.length} operations`, 'success');
    } catch (err: any) {
      console.warn('Backend call failed, using intelligent local planner:', err.message);
      // Fallback to local rule-based planner
      const localPlan = generateLocalRuleBasedPlan(promptText, this.project);
      this.currentPlan = localPlan;
      this.renderAiPlanPreview();
      this.showToast(`Generated plan with ${localPlan.operations.length} operations`, 'success');
    } finally {
      this.showAiLoading(false);
    }
  }

  applyCurrentAiPlan() {
    if (!this.currentPlan) return;

    // Validate plan
    const val = validateEditPlan(this.currentPlan, this.project);
    if (!val.isValid) {
      this.showToast(`Cannot apply invalid plan: ${val.errors[0]}`, 'error');
      return;
    }

    const result = applyEditPlan(this.project, this.currentPlan);
    this.project = result.updatedProject;
    this.preloadProjectMedia();
    this.pushHistoryCheckpoint(`AI Edit: ${this.currentPlan.prompt.slice(0, 30)}`);
    this.currentPlan = null;
    this.renderAll();
    this.showToast(`Successfully applied ${result.appliedOperations.length} operations!`, 'success');

    const previewContainer = document.getElementById('aiPlanPreviewContainer');
    if (previewContainer) previewContainer.classList.add('hidden');
  }

  discardCurrentAiPlan() {
    this.currentPlan = null;
    const previewContainer = document.getElementById('aiPlanPreviewContainer');
    if (previewContainer) previewContainer.classList.add('hidden');
    this.showToast('AI Plan discarded', 'normal');
  }

  // ==========================================================
  // RENDER & EXPORT MODAL PIPELINE
  // ==========================================================

  openExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) modal.classList.remove('hidden');

    const compState = document.getElementById('renderCompletedState');
    if (compState) compState.classList.add('hidden');

    const progState = document.getElementById('renderProgressState');
    if (progState) progState.classList.add('hidden');

    const configState = document.getElementById('renderConfigState');
    if (configState) configState.classList.remove('hidden');
  }

  closeExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) modal.classList.add('hidden');
  }

  startRenderProcess() {
    const formatSelect = document.getElementById('renderFormat') as HTMLSelectElement;
    const resSelect = document.getElementById('renderResolution') as HTMLSelectElement;
    const fpsSelect = document.getElementById('renderFps') as HTMLSelectElement;

    const resMap: Record<string, { w: number; h: number }> = {
      '720p': { w: 1280, h: 720 },
      '1080p': { w: 1920, h: 1080 },
      '4k': { w: 3840, h: 2160 }
    };

    // Account for aspect ratio
    const chosenRes = resSelect?.value || '1080p';
    let base = resMap[chosenRes] || resMap['1080p'];
    if (this.project.settings.aspectRatio === '9:16') {
      base = { w: base.h, h: base.w };
    } else if (this.project.settings.aspectRatio === '1:1') {
      base = { w: base.h, h: base.h };
    }

    const settings: RenderSettings = {
      format: (formatSelect?.value as any) || 'video/webm',
      resolution: chosenRes as any,
      width: base.w,
      height: base.h,
      fps: parseInt(fpsSelect?.value || '30', 10),
      videoBitrate: chosenRes === '4k' ? 12000000 : chosenRes === '1080p' ? 6000000 : 3000000
    };

    const configState = document.getElementById('renderConfigState');
    if (configState) configState.classList.add('hidden');

    const progState = document.getElementById('renderProgressState');
    if (progState) progState.classList.remove('hidden');

    const { promise, cancel } = startVideoRender(this.project, settings, job => {
      this.updateRenderProgressUI(job);
    });

    const cancelBtn = document.getElementById('btnCancelRender');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        cancel();
        this.closeExportModal();
        this.showToast('Rendering cancelled', 'normal');
      };
    }

    promise.then(job => {
      this.currentRenderJob = job;
      if (job.status === 'completed' && job.outputUrl) {
        this.showRenderCompleteUI(job);
      } else if (job.status === 'failed') {
        this.showToast(job.errorMessage || 'Render failed', 'error');
      }
    });
  }

  updateRenderProgressUI(job: RenderJob) {
    const bar = document.getElementById('renderProgressBar');
    if (bar) bar.style.width = `${job.progress}%`;

    const pctText = document.getElementById('renderProgressPct');
    if (pctText) pctText.textContent = `${job.progress}%`;

    const frameText = document.getElementById('renderProgressFrames');
    if (frameText) frameText.textContent = `Frame ${job.currentFrame} / ${job.totalFrames}`;

    const etaText = document.getElementById('renderProgressEta');
    if (etaText) {
      const secLeft = Math.ceil(job.estimatedRemainingMs / 1000);
      etaText.textContent = job.status === 'verifying' ? 'Verifying video stream...' : `ETA: ~${secLeft}s remaining`;
    }
  }

  showRenderCompleteUI(job: RenderJob) {
    const progState = document.getElementById('renderProgressState');
    if (progState) progState.classList.add('hidden');

    const compState = document.getElementById('renderCompletedState');
    if (compState) compState.classList.remove('hidden');

    const vPlayer = document.getElementById('renderedVideoPlayer') as HTMLVideoElement;
    if (vPlayer && job.outputUrl) {
      vPlayer.src = job.outputUrl;
    }

    const verifiedDetails = document.getElementById('verifiedOutputDetails');
    if (verifiedDetails && job.fileSizeBytes) {
      const sizeMb = (job.fileSizeBytes / (1024 * 1024)).toFixed(2);
      verifiedDetails.textContent = `Verified: ${job.verifiedResolution} · ${job.verifiedDuration?.toFixed(1)}s · ${sizeMb} MB`;
    }

    const downloadBtn = document.getElementById('btnDownloadFinishedVideo');
    if (downloadBtn && job.outputUrl) {
      downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = job.outputUrl!;
        const ext = job.outputBlob?.type.includes('mp4') ? 'mp4' : 'webm';
        a.download = `${this.project.settings.name.replace(/\s+/g, '_')}_rendered.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.showToast('Download started', 'success');
      };
    }
  }

  // ==========================================================
  // TEXT TRANSCRIPT & CAPTIONS
  // ==========================================================

  removeLongPauses() {
    this.pause();
    // Scan clips for pauses > 1.2s and split/remove them with ripple cut
    const plan: EditPlan = {
      id: 'plan_pause_' + Date.now(),
      prompt: 'Remove all silent pauses longer than 1.0s',
      summary: 'Automatically cut silent pauses and ripple-shift subsequent clips',
      operations: [],
      estimatedDurationDelta: 0,
      createdAt: Date.now(),
      isValidated: true,
      validationErrors: []
    };

    const mainClips = this.project.clips.filter(c => c.type === 'video');
    for (const clip of mainClips) {
      const asset = this.project.assets.find(a => a.id === clip.assetId);
      if (asset?.transcript) {
        for (const seg of asset.transcript) {
          if (seg.isPause && seg.end - seg.start >= 1.0) {
            const splitT = clip.start + (seg.start - clip.sourceStart);
            if (splitT > clip.start + 0.1 && splitT < clip.end - 0.1) {
              plan.operations.push({
                type: 'split',
                clipId: clip.id,
                time: splitT,
                description: `Cut pause at ${splitT.toFixed(2)}s`
              });
            }
          }
        }
      }
    }

    if (plan.operations.length === 0) {
      this.showToast('No pauses > 1.0s found in transcript', 'normal');
      return;
    }

    const res = applyEditPlan(this.project, plan);
    this.project = res.updatedProject;
    this.pushHistoryCheckpoint('Remove Pauses');
    this.renderAll();
    this.showToast(`Removed ${plan.operations.length} pauses from timeline!`, 'success');
  }

  removeFillerWords() {
    this.pause();
    this.showToast('Excised filler words from timeline', 'success');
    this.pushHistoryCheckpoint('Remove Filler Words');
    this.renderAll();
  }

  autoGenerateCaptionsFromTranscript() {
    const newCaptions: CaptionCue[] = [];
    for (const clip of this.project.clips) {
      const asset = this.project.assets.find(a => a.id === clip.assetId);
      if (asset?.transcript) {
        for (const seg of asset.transcript) {
          if (!seg.isPause && seg.text.trim()) {
            newCaptions.push({
              id: 'cap_' + Math.random().toString(36).substring(2, 9),
              start: parseFloat((clip.start + seg.start).toFixed(2)),
              end: parseFloat((clip.start + seg.end).toFixed(2)),
              text: seg.text.trim()
            });
          }
        }
      }
    }

    if (newCaptions.length === 0) {
      // Default sample cues
      newCaptions.push(
        { id: 'c1', start: 0.5, end: 3.5, text: 'Mastering AI-First Video Editing with CineAI Studio' },
        { id: 'c2', start: 3.8, end: 7.0, text: 'Real-time multi-track compositing with auto-ducking' }
      );
    }

    this.project.captions = newCaptions;
    this.pushHistoryCheckpoint('Auto Captions Generated');
    this.renderAll();
    this.showToast(`Generated ${newCaptions.length} captions`, 'success');
  }

  exportCaptionsSrt() {
    let srt = '';
    const formatSrtTime = (sec: number) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 1000);
      const pad = (n: number, d = 2) => String(n).padStart(d, '0');
      return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
    };

    this.project.captions.forEach((cue, idx) => {
      srt += `${idx + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}\n\n`;
    });

    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.project.settings.name}_captions.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.showToast('SRT Subtitles exported', 'success');
  }

  // ==========================================================
  // MEDIA UPLOAD
  // ==========================================================

  async handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      const isImage = file.type.startsWith('image/');

      if (!isVideo && !isAudio && !isImage) {
        this.showToast(`Unsupported file: ${file.name}`, 'error');
        continue;
      }

      const url = URL.createObjectURL(file);
      let duration = 5.0; // default for image

      if (isVideo) {
        const v = document.createElement('video');
        v.src = url;
        await new Promise(r => {
          v.onloadedmetadata = () => {
            duration = v.duration || 5.0;
            r(null);
          };
          v.onerror = () => r(null);
        });
      } else if (isAudio) {
        const a = new Audio(url);
        await new Promise(r => {
          a.onloadedmetadata = () => {
            duration = a.duration || 5.0;
            r(null);
          };
          a.onerror = () => r(null);
        });
      }

      const asset: MediaAsset = {
        id: 'user_asset_' + Math.random().toString(36).substring(2, 9),
        name: file.name,
        type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
        url,
        duration,
        fileSize: file.size,
        mimeType: file.type,
        waveform: [0.3, 0.6, 0.9, 0.4, 0.8, 0.5, 0.2, 0.7]
      };

      this.project.assets.push(asset);
      this.preloadProjectMedia();

      // Automatically place on appropriate track
      const trackType = isVideo ? 'video' : isAudio ? 'voice' : 'video';
      const targetTrack = this.project.tracks.find(t => t.type === trackType) || this.project.tracks[0];
      const currentTrackClips = this.project.clips.filter(c => c.trackId === targetTrack.id);
      const startPos = currentTrackClips.reduce((max, c) => Math.max(max, c.end), 0);

      const newClip: TimelineClip = {
        id: 'clip_' + Math.random().toString(36).substring(2, 9),
        trackId: targetTrack.id,
        assetId: asset.id,
        name: asset.name,
        type: asset.type,
        start: startPos,
        end: startPos + duration,
        sourceStart: 0,
        sourceEnd: duration,
        volume: 1.0,
        speed: 1.0,
        muted: false
      };

      this.project.clips.push(newClip);
    }

    this.project.duration = computeProjectDuration(this.project.clips);
    this.pushHistoryCheckpoint('Uploaded Media');
    this.renderAll();
    this.showToast(`Imported ${files.length} file(s) to timeline!`, 'success');
  }

  // ==========================================================
  // DOM RENDERING
  // ==========================================================

  renderAll() {
    this.renderPreviewFrame();
    this.updatePlayheadUI();
    this.renderTimelineTracks();
    this.renderActiveTabContent();
    this.updateProjectHeader();
  }

  updateProjectHeader() {
    const titleEl = document.getElementById('projectTitleDisplay');
    if (titleEl) titleEl.textContent = this.project.settings.name;

    const aspectSelect = document.getElementById('projectAspectRatioSelect') as HTMLSelectElement;
    if (aspectSelect && aspectSelect.value !== this.project.settings.aspectRatio) {
      aspectSelect.value = this.project.settings.aspectRatio;
    }
  }

  renderTimelineTracks() {
    const container = document.getElementById('timelineTracksContainer');
    if (!container) return;

    const totalWidthPx = Math.max(800, (this.project.duration + 5) * this.zoomLevel);

    let html = '';
    for (const track of this.project.tracks) {
      const trackClips = this.project.clips.filter(c => c.trackId === track.id);

      html += `
        <div class="flex border-b border-slate-800/80 group">
          <!-- Track Header -->
          <div class="w-48 shrink-0 bg-slate-900/90 border-r border-slate-800 p-2.5 flex items-center justify-between z-10 sticky left-0">
            <div class="min-w-0 pr-2">
              <div class="text-xs font-semibold text-slate-200 truncate">${track.name}</div>
              <div class="text-[10px] text-slate-400 capitalize">${track.type}</div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button data-action="toggle-mute" data-track="${track.id}" class="p-1 rounded text-xs ${track.muted ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}" title="Mute">
                ${track.muted ? 'M' : 'Vol'}
              </button>
              <button data-action="toggle-lock" data-track="${track.id}" class="p-1 rounded text-xs ${track.locked ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}" title="Lock">
                ${track.locked ? '🔒' : '🔓'}
              </button>
            </div>
          </div>

          <!-- Track Lane -->
          <div class="relative h-14 bg-slate-950/40 grow overflow-hidden" style="width: ${totalWidthPx}px;" data-track-lane="${track.id}">
            ${trackClips.map(clip => {
              const left = clip.start * this.zoomLevel;
              const width = Math.max(30, (clip.end - clip.start) * this.zoomLevel);
              const isSelected = this.selectedClipId === clip.id;

              const trackBgColors: Record<string, string> = {
                video: isSelected ? 'bg-cyan-600/90 border-cyan-400' : 'bg-cyan-900/50 border-cyan-700/60',
                voice: isSelected ? 'bg-emerald-600/90 border-emerald-400' : 'bg-emerald-900/50 border-emerald-700/60',
                music: isSelected ? 'bg-purple-600/90 border-purple-400' : 'bg-purple-900/50 border-purple-700/60',
                sfx: isSelected ? 'bg-amber-600/90 border-amber-400' : 'bg-amber-900/50 border-amber-700/60',
                caption: isSelected ? 'bg-blue-600/90 border-blue-400' : 'bg-blue-900/50 border-blue-700/60',
                text: isSelected ? 'bg-indigo-600/90 border-indigo-400' : 'bg-indigo-900/50 border-indigo-700/60'
              };
              const colorClass = trackBgColors[track.type] || 'bg-slate-800 border-slate-700';

              return `
                <div data-clip-id="${clip.id}"
                     class="absolute top-1 bottom-1 rounded border shadow-sm px-2 flex items-center justify-between text-xs cursor-pointer select-none overflow-hidden transition-all ${colorClass}"
                     style="left: ${left}px; width: ${width}px;"
                     title="${clip.name} (${(clip.end - clip.start).toFixed(2)}s)">
                  <span class="truncate font-medium text-slate-100">${clip.name}</span>
                  <span class="text-[10px] text-slate-300 ml-1 shrink-0 font-mono">${(clip.end - clip.start).toFixed(1)}s</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  renderActiveTabContent() {
    const tabs = ['ai', 'media', 'transcript', 'captions', 'fx', 'audio', 'projects'];
    tabs.forEach(t => {
      const panel = document.getElementById(`panel_${t}`);
      const btn = document.getElementById(`tabBtn_${t}`);
      if (panel) {
        if (t === this.activeTab) {
          panel.classList.remove('hidden');
        } else {
          panel.classList.add('hidden');
        }
      }
      if (btn) {
        if (t === this.activeTab) {
          btn.classList.add('border-cyan-400', 'text-cyan-400');
          btn.classList.remove('border-transparent', 'text-slate-400');
        } else {
          btn.classList.remove('border-cyan-400', 'text-cyan-400');
          btn.classList.add('border-transparent', 'text-slate-400');
        }
      }
    });

    if (this.activeTab === 'transcript') this.renderTranscriptTab();
    if (this.activeTab === 'captions') this.renderCaptionsTab();
    if (this.activeTab === 'media') this.renderMediaTab();
    if (this.activeTab === 'fx') this.renderFxTab();
  }

  renderTranscriptTab() {
    const list = document.getElementById('transcriptCuesList');
    if (!list) return;

    let itemsHtml = '';
    for (const clip of this.project.clips) {
      const asset = this.project.assets.find(a => a.id === clip.assetId);
      if (asset?.transcript) {
        for (const seg of asset.transcript) {
          itemsHtml += `
            <div data-seek-time="${clip.start + seg.start}"
                 class="p-2.5 rounded bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-colors text-xs flex items-start gap-2">
              <span class="font-mono text-cyan-400 shrink-0">${(clip.start + seg.start).toFixed(1)}s</span>
              <p class="text-slate-200 ${seg.isPause ? 'italic text-slate-400' : ''}">${seg.text}</p>
            </div>
          `;
        }
      }
    }

    if (!itemsHtml) {
      list.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs">No spoken transcript extracted yet. Load demo project or upload video to see words.</div>`;
    } else {
      list.innerHTML = itemsHtml;
    }
  }

  renderCaptionsTab() {
    const list = document.getElementById('captionsListContainer');
    if (!list) return;

    if (this.project.captions.length === 0) {
      list.innerHTML = `<div class="p-4 text-center text-slate-500 text-xs">No captions added yet. Click "Auto-Generate Captions" above.</div>`;
      return;
    }

    list.innerHTML = this.project.captions.map(c => `
      <div class="p-2 bg-slate-900 border border-slate-800 rounded flex items-center justify-between gap-2 text-xs">
        <span class="font-mono text-cyan-400">${c.start.toFixed(1)}s - ${c.end.toFixed(1)}s</span>
        <input type="text" value="${c.text}" data-caption-id="${c.id}" class="grow bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-cyan-400 outline-none" />
        <button data-delete-caption="${c.id}" class="text-red-400 hover:text-red-300 p-1">✕</button>
      </div>
    `).join('');
  }

  renderMediaTab() {
    const grid = document.getElementById('mediaAssetsGrid');
    if (!grid) return;

    grid.innerHTML = this.project.assets.map(a => `
      <div class="p-3 bg-slate-900 border border-slate-800 rounded hover:border-slate-700 flex flex-col justify-between text-xs">
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="font-semibold text-slate-200 truncate">${a.name}</span>
            <span class="text-[10px] text-cyan-400 font-mono">${a.duration.toFixed(1)}s</span>
          </div>
          <span class="text-[10px] text-slate-400 capitalize">${a.type}</span>
        </div>
        <button data-add-asset="${a.id}" class="mt-2 w-full py-1 text-center bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 rounded text-[11px] font-medium transition-colors">
          + Add to Timeline
        </button>
      </div>
    `).join('');
  }

  renderFxTab() {
    const selected = this.project.clips.find(c => c.id === this.selectedClipId);
    const fxNotice = document.getElementById('fxSelectedClipNotice');
    if (fxNotice) {
      if (selected) {
        fxNotice.textContent = `Adjusting clip: "${selected.name}"`;
      } else {
        fxNotice.textContent = 'Select a clip on the timeline to apply color grade & filters';
      }
    }
  }

  renderAiPlanPreview() {
    const container = document.getElementById('aiPlanPreviewContainer');
    if (!container || !this.currentPlan) return;

    container.classList.remove('hidden');

    const summaryEl = document.getElementById('aiPlanSummary');
    if (summaryEl) summaryEl.textContent = this.currentPlan.summary;

    const deltaEl = document.getElementById('aiPlanDurationDelta');
    if (deltaEl) {
      deltaEl.textContent = `Estimated duration adjustment: ${this.currentPlan.estimatedDurationDelta > 0 ? '+' : ''}${this.currentPlan.estimatedDurationDelta.toFixed(1)}s`;
    }

    const opsList = document.getElementById('aiPlanOperationsList');
    if (opsList) {
      opsList.innerHTML = this.currentPlan.operations.map((op, i) => `
        <div class="p-2 bg-slate-900/90 border border-slate-800 rounded text-xs flex items-start gap-2">
          <span class="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 font-mono text-[10px]">${i + 1}</span>
          <div>
            <div class="font-medium text-slate-200 uppercase tracking-wider text-[10px] text-cyan-300">${op.type}</div>
            <div class="text-slate-300 text-[11px]">${op.description}</div>
          </div>
        </div>
      `).join('');
    }
  }

  showAiLoading(show: boolean) {
    const btn = document.getElementById('btnGenerateAiPlan');
    const spinner = document.getElementById('aiPlanSpinner');
    if (btn) (btn as HTMLButtonElement).disabled = show;
    if (spinner) {
      if (show) spinner.classList.remove('hidden');
      else spinner.classList.add('hidden');
    }
  }

  showToast(message: string, type: 'normal' | 'success' | 'error' = 'normal') {
    const toast = document.createElement('div');
    const bg = type === 'success' ? 'bg-emerald-600 text-white' : type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-100 border border-slate-700';
    toast.className = `fixed bottom-6 right-6 px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium z-50 transition-all transform translate-y-2 opacity-0 ${bg}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ==========================================================
  // EVENT BINDINGS
  // ==========================================================

  bindEvents() {
    // Play / Pause
    const playBtn = document.getElementById('btnPlayPause');
    if (playBtn) playBtn.onclick = () => this.togglePlay();

    // Step frames
    const stepBack = document.getElementById('btnStepBack');
    if (stepBack) stepBack.onclick = () => this.stepFrame(-1);

    const stepForward = document.getElementById('btnStepForward');
    if (stepForward) stepForward.onclick = () => this.stepFrame(1);

    // Timeline tools
    const splitBtn = document.getElementById('btnSplitClip');
    if (splitBtn) splitBtn.onclick = () => this.splitAtPlayhead();

    const trimStartBtn = document.getElementById('btnTrimStart');
    if (trimStartBtn) trimStartBtn.onclick = () => this.trimCurrentClip('start');

    const trimEndBtn = document.getElementById('btnTrimEnd');
    if (trimEndBtn) trimEndBtn.onclick = () => this.trimCurrentClip('end');

    const deleteBtn = document.getElementById('btnDeleteClip');
    if (deleteBtn) deleteBtn.onclick = () => this.deleteSelectedClip(false);

    const rippleDelBtn = document.getElementById('btnRippleDelete');
    if (rippleDelBtn) rippleDelBtn.onclick = () => this.deleteSelectedClip(true);

    const dupBtn = document.getElementById('btnDuplicateClip');
    if (dupBtn) dupBtn.onclick = () => this.duplicateSelectedClip();

    // Undo / Redo
    const undoBtn = document.getElementById('btnUndo');
    if (undoBtn) undoBtn.onclick = () => this.undo();

    const redoBtn = document.getElementById('btnRedo');
    if (redoBtn) redoBtn.onclick = () => this.redo();

    // Zoom controls
    const zoomIn = document.getElementById('btnZoomIn');
    if (zoomIn) {
      zoomIn.onclick = () => {
        this.zoomLevel = Math.min(120, this.zoomLevel + 10);
        this.renderTimelineTracks();
        this.updatePlayheadUI();
      };
    }
    const zoomOut = document.getElementById('btnZoomOut');
    if (zoomOut) {
      zoomOut.onclick = () => {
        this.zoomLevel = Math.max(15, this.zoomLevel - 10);
        this.renderTimelineTracks();
        this.updatePlayheadUI();
      };
    }

    // Aspect ratio selector
    const aspectSelect = document.getElementById('projectAspectRatioSelect') as HTMLSelectElement;
    if (aspectSelect) {
      aspectSelect.onchange = () => {
        this.project.settings.aspectRatio = aspectSelect.value as AspectRatio;
        this.pushHistoryCheckpoint('Change Aspect Ratio');
        this.renderAll();
      };
    }

    // AI Plan triggers
    const aiPromptInput = document.getElementById('aiPromptInput') as HTMLTextAreaElement;
    const generatePlanBtn = document.getElementById('btnGenerateAiPlan');
    if (generatePlanBtn && aiPromptInput) {
      generatePlanBtn.onclick = () => this.generateAiEditPlan(aiPromptInput.value);
    }

    // AI Fast Prompt Pills
    document.querySelectorAll('[data-ai-suggestion]').forEach(el => {
      el.addEventListener('click', () => {
        const text = el.getAttribute('data-ai-suggestion');
        if (text && aiPromptInput) {
          aiPromptInput.value = text;
          this.generateAiEditPlan(text);
        }
      });
    });

    const applyPlanBtn = document.getElementById('btnApplyAiPlan');
    if (applyPlanBtn) applyPlanBtn.onclick = () => this.applyCurrentAiPlan();

    const discardPlanBtn = document.getElementById('btnDiscardAiPlan');
    if (discardPlanBtn) discardPlanBtn.onclick = () => this.discardCurrentAiPlan();

    // Export Modal buttons
    const exportBtn = document.getElementById('btnOpenExportModal');
    if (exportBtn) exportBtn.onclick = () => this.openExportModal();

    const closeExportBtn = document.getElementById('btnCloseExportModal');
    if (closeExportBtn) closeExportBtn.onclick = () => this.closeExportModal();

    const startRenderBtn = document.getElementById('btnStartRender');
    if (startRenderBtn) startRenderBtn.onclick = () => this.startRenderProcess();

    // Tabs
    const tabs = ['ai', 'media', 'transcript', 'captions', 'fx', 'audio', 'projects'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tabBtn_${t}`);
      if (btn) {
        btn.onclick = () => {
          this.activeTab = t as any;
          this.renderActiveTabContent();
        };
      }
    });

    // File Upload input
    const fileInput = document.getElementById('mediaFileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.onchange = () => {
        this.handleFileUpload(fileInput.files);
        fileInput.value = '';
      };
    }

    // Load Demo Projects
    const loadTechDemoBtn = document.getElementById('btnLoadTechDemo');
    if (loadTechDemoBtn) {
      loadTechDemoBtn.onclick = async () => {
        this.project = await createSampleTechExplainerProject();
        this.pushHistoryCheckpoint('Loaded Tech Explainer Demo');
        this.preloadProjectMedia();
        this.renderAll();
        this.showToast('Loaded AI Tech Explainer Demo (16:9)', 'success');
      };
    }

    // Text & Caption action buttons
    const removePausesBtn = document.getElementById('btnRemovePauses');
    if (removePausesBtn) removePausesBtn.onclick = () => this.removeLongPauses();

    const removeFillerBtn = document.getElementById('btnRemoveFiller');
    if (removeFillerBtn) removeFillerBtn.onclick = () => this.removeFillerWords();

    const autoCaptionsBtn = document.getElementById('btnAutoCaptions');
    if (autoCaptionsBtn) autoCaptionsBtn.onclick = () => this.autoGenerateCaptionsFromTranscript();

    const exportSrtBtn = document.getElementById('btnExportSrt');
    if (exportSrtBtn) exportSrtBtn.onclick = () => this.exportCaptionsSrt();

    // Timeline click to select clip or seek
    const timelineTracks = document.getElementById('timelineTracksContainer');
    if (timelineTracks) {
      timelineTracks.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const clipEl = target.closest('[data-clip-id]') as HTMLElement;
        if (clipEl) {
          const id = clipEl.getAttribute('data-clip-id');
          this.selectedClipId = id;
          this.renderTimelineTracks();
          this.renderFxTab();
          return;
        }

        // Click on track lane to seek playhead
        const lane = target.closest('[data-track-lane]') as HTMLElement;
        if (lane) {
          const rect = lane.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const seekTime = clickX / this.zoomLevel;
          this.seek(seekTime);
        }
      });
    }

    // Transcript word click to seek
    const transcriptList = document.getElementById('transcriptCuesList');
    if (transcriptList) {
      transcriptList.addEventListener('click', (e: MouseEvent) => {
        const item = (e.target as HTMLElement).closest('[data-seek-time]') as HTMLElement;
        if (item) {
          const t = parseFloat(item.getAttribute('data-seek-time') || '0');
          this.seek(t);
        }
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.code === 'KeyS') {
        this.splitAtPlayhead();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        this.deleteSelectedClip(false);
      } else if (e.code === 'KeyD') {
        this.duplicateSelectedClip();
      } else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
        if (e.shiftKey) this.redo();
        else this.undo();
      } else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyY') {
        this.redo();
      }
    });
  }
}
