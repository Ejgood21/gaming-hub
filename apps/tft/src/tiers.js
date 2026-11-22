'use strict';

const tiers = {
  S: {rank: 0, score: 12, label: 'S'},
  A: {rank: 1, score: 10, label: 'A'},
  B: {rank: 2, score: 8, label: 'B'},
  C: {rank: 4, score: 6, label: 'C'},
  D: {rank: 5, score: 4, label: 'D'},
  X: {rank: 3, score: 0, label: 'Situational', conditional: true}
};

module.exports = function academyTier(tier) {
  return tiers[tier] || {rank: 6, score: 0, label: tier};
};
