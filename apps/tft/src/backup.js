'use strict';

const createModel = require('./model');
const {validAcademy} = require('./snapshots');

const maxBackupBytes = 5_000_000;

function exportBackup(model, state, shortcuts) {
  return JSON.stringify({
    app: 'carousel-offline', version: 1, exportedAt: new Date().toISOString(), state, shortcuts,
    academy: model.Academy.cleanSnapshot(model.Academy.snapshot)
  });
}

function reviewBackup(model, text) {
  if (new TextEncoder().encode(text).byteLength > maxBackupBytes) {
    throw new Error('Choose a backup smaller than 5 MB.');
  }
  const raw = JSON.parse(text);
  if (!raw || raw.app && raw.app !== 'carousel-offline' || raw.version && raw.version !== 1) {
    throw new Error('This is not a supported Carousel backup.');
  }
  const academy = validAcademy(raw.academy) ? model.Academy.cleanSnapshot(raw.academy) : null;
  // A review validates newer item IDs without registering them in the active game.
  const tracker = academy ? createModel({core: model.DATA, academy, meta: {units: []}}).OfflineTracker
    : model.OfflineTracker;
  return {state: tracker.cleanState(raw.state || raw), shortcuts: raw.shortcuts, academy};
}

module.exports = {exportBackup, reviewBackup, maxBackupBytes};
