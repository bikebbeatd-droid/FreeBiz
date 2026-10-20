/**
 * CineAI Studio — Automated Unit & Integration Test Suite
 * Tests timecode math, timeline operations (split, trim, ripple delete),
 * AI operation schema validation, plan execution, audio ducking, and render verification.
 */

import assert from 'node:assert';
import {
  formatTimecode,
  parseTimecode,
  computeProjectDuration,
  splitClip,
  trimClip,
  moveClip,
  deleteClip,
  duplicateClip,
  createDefaultProject
} from '../src/video-editor/timeline-engine.js';
import {
  validateOperation,
  validateEditPlan,
  applyEditPlan,
  generateLocalRuleBasedPlan
} from '../src/video-editor/ai-planner.js';
import { calculateMusicDuckingGain } from '../src/video-editor/render-engine.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✕ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n=== CineAI Studio Automated Test Suite ===\n');

// 1. Timecode Math
test('formatTimecode formats zero seconds correctly', () => {
  assert.strictEqual(formatTimecode(0, 30), '00:00:00.00');
});

test('formatTimecode formats minutes, seconds, and frames accurately', () => {
  assert.strictEqual(formatTimecode(65.5, 30), '00:01:05.15');
});

test('parseTimecode correctly parses timecode back to seconds', () => {
  const parsed = parseTimecode('00:01:05.15', 30);
  assert.strictEqual(parsed, 65.5);
});

// 2. Timeline Math
test('computeProjectDuration computes max end of all clips', () => {
  const clips = [
    { id: 'c1', start: 0, end: 5 },
    { id: 'c2', start: 3, end: 12.5 },
    { id: 'c3', start: 8, end: 10 }
  ];
  assert.strictEqual(computeProjectDuration(clips), 12.5);
});

test('computeProjectDuration handles empty clips gracefully', () => {
  assert.strictEqual(computeProjectDuration([]), 0);
});

// 3. Split Clip Operations
test('splitClip divides clip into two parts with preserved source offsets', () => {
  const original = [
    {
      id: 'clip_1',
      trackId: 'track_v1',
      assetId: 'a1',
      name: 'Scene 1',
      type: 'video',
      start: 0,
      end: 10,
      sourceStart: 0,
      sourceEnd: 10,
      volume: 1,
      speed: 1,
      muted: false
    }
  ];

  const res = splitClip(original, 'clip_1', 4.0);
  assert.strictEqual(res.error, undefined);
  assert.strictEqual(res.newClips.length, 2);

  const left = res.newClips.find(c => c.id === 'clip_1');
  assert.strictEqual(left.end, 4.0);
  assert.strictEqual(left.sourceEnd, 4.0);

  const right = res.newClips.find(c => c.id === res.createdClipId);
  assert.ok(right);
  assert.strictEqual(right.start, 4.0);
  assert.strictEqual(right.end, 10.0);
  assert.strictEqual(right.sourceStart, 4.0);
});

test('splitClip rejects split times outside clip boundaries', () => {
  const original = [
    { id: 'clip_1', start: 2, end: 8, sourceStart: 0, sourceEnd: 6, speed: 1 }
  ];
  const res = splitClip(original, 'clip_1', 1.0);
  assert.ok(res.error);
  assert.strictEqual(res.newClips.length, 1);
});

// 4. Trim Operations
test('trimClip updates start and sourceStart when trimming head', () => {
  const original = [
    { id: 'clip_1', start: 0, end: 10, sourceStart: 0, sourceEnd: 10, speed: 1 }
  ];
  const res = trimClip(original, 'clip_1', 2.5, undefined);
  assert.strictEqual(res.error, undefined);
  const trimmed = res.newClips[0];
  assert.strictEqual(trimmed.start, 2.5);
  assert.strictEqual(trimmed.sourceStart, 2.5);
});

test('trimClip rejects trimming end to before start', () => {
  const original = [
    { id: 'clip_1', start: 5, end: 10, sourceStart: 0, sourceEnd: 5, speed: 1 }
  ];
  const res = trimClip(original, 'clip_1', undefined, 4.0);
  assert.ok(res.error);
});

// 5. Delete & Ripple Delete Operations
test('deleteClip removes clip without ripple', () => {
  const clips = [
    { id: 'c1', trackId: 't1', start: 0, end: 5 },
    { id: 'c2', trackId: 't1', start: 5, end: 10 }
  ];
  const res = deleteClip(clips, 'c1', false);
  assert.strictEqual(res.newClips.length, 1);
  assert.strictEqual(res.newClips[0].id, 'c2');
  assert.strictEqual(res.newClips[0].start, 5); // position unchanged
});

test('deleteClip with ripple=true shifts subsequent clips left to close gap', () => {
  const clips = [
    { id: 'c1', trackId: 't1', start: 0, end: 4 },
    { id: 'c2', trackId: 't1', start: 4, end: 10 }
  ];
  const res = deleteClip(clips, 'c1', true);
  assert.strictEqual(res.newClips.length, 1);
  assert.strictEqual(res.newClips[0].id, 'c2');
  assert.strictEqual(res.newClips[0].start, 0); // shifted by 4s
  assert.strictEqual(res.newClips[0].end, 6);
});

// 6. Duplicate Operations
test('duplicateClip appends adjacent copy', () => {
  const clips = [
    { id: 'c1', trackId: 't1', start: 0, end: 5, sourceStart: 0, sourceEnd: 5 }
  ];
  const res = duplicateClip(clips, 'c1');
  assert.strictEqual(res.newClips.length, 2);
  const copy = res.newClips.find(c => c.id === res.createdClipId);
  assert.strictEqual(copy.start, 5);
  assert.strictEqual(copy.end, 10);
});

// 7. AI Operation & Plan Validation
test('validateOperation detects non-existent clip ID', () => {
  const proj = createDefaultProject('Test');
  const op = { type: 'trim', clipId: 'ghost_clip', start: 0, end: 5, description: 'test' };
  const res = validateOperation(op, proj);
  assert.strictEqual(res.isValid, false);
});

test('validateEditPlan rejects plan with invalid operations', () => {
  const proj = createDefaultProject('Test');
  const plan = {
    id: 'p1',
    prompt: 'trim ghost',
    summary: 'test',
    operations: [
      { type: 'trim', clipId: 'missing_clip_123', start: 0, end: 5, description: 'bad' }
    ],
    estimatedDurationDelta: 0,
    createdAt: Date.now(),
    isValidated: false,
    validationErrors: []
  };
  const val = validateEditPlan(plan, proj);
  assert.strictEqual(val.isValid, false);
  assert.ok(val.errors.length > 0);
});

test('applyEditPlan applies valid operations and increments project version', () => {
  const proj = createDefaultProject('Test');
  proj.clips = [
    { id: 'c1', trackId: 'track_video_1', assetId: 'a1', name: 'Intro', type: 'video', start: 0, end: 10, sourceStart: 0, sourceEnd: 10, volume: 1, speed: 1, muted: false }
  ];
  proj.duration = 10;

  const plan = {
    id: 'p1',
    prompt: 'Trim to 6s and add caption',
    summary: 'Apply edits',
    operations: [
      { type: 'trim', clipId: 'c1', start: 0, end: 6, description: 'Trim to 6s' },
      { type: 'caption', start: 1, end: 4, value: 'Hello CineAI', description: 'Add subtitle' }
    ],
    estimatedDurationDelta: -4,
    createdAt: Date.now(),
    isValidated: true,
    validationErrors: []
  };

  const res = applyEditPlan(proj, plan);
  assert.strictEqual(res.updatedProject.clips[0].end, 6);
  assert.strictEqual(res.updatedProject.captions.length, 1);
  assert.strictEqual(res.updatedProject.captions[0].text, 'Hello CineAI');
  assert.strictEqual(res.updatedProject.version, proj.version + 1);
  assert.strictEqual(res.appliedOperations.length, 2);
});

// 8. Audio Ducking Math
test('calculateMusicDuckingGain ducks music when voice track is active', () => {
  const proj = createDefaultProject('Test');
  proj.clips = [
    { id: 'v1', trackId: 'track_voice_1', type: 'audio', start: 2.0, end: 6.0 }
  ];
  proj.audioSettings.autoDucking = true;
  proj.audioSettings.duckingAmountDb = -12;

  // At time 1.0s (no voice) => 1.0 (no ducking)
  assert.strictEqual(calculateMusicDuckingGain(proj, 1.0), 1.0);

  // At time 3.0s (voice speaking) => ~0.25 (-12dB)
  const ducked = calculateMusicDuckingGain(proj, 3.0);
  assert.ok(ducked < 0.3 && ducked > 0.2);
});

// 9. Local Rule-Based NLP Planner
test('generateLocalRuleBasedPlan responds to pause removal prompt', () => {
  const proj = createDefaultProject('Test');
  proj.clips = [
    { id: 'c1', trackId: 'track_video_1', assetId: 'a1', name: 'Main', type: 'video', start: 0, end: 8, sourceStart: 0, sourceEnd: 8, speed: 1 }
  ];
  proj.assets = [
    {
      id: 'a1',
      name: 'clip.mp4',
      type: 'video',
      url: 'blob:test',
      duration: 8,
      mimeType: 'video/mp4',
      transcript: [
        { id: 't1', start: 0, end: 2, text: 'Hello' },
        { id: 't2', start: 2.1, end: 3.5, text: '[Pause]', isPause: true }
      ]
    }
  ];

  const plan = generateLocalRuleBasedPlan('Please remove pauses from my video', proj);
  assert.ok(plan.operations.length > 0);
  assert.ok(plan.operations.some(op => op.type === 'split' || op.type === 'trim'));
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All CineAI Studio tests passed!\n');
}
