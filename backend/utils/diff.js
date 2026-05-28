function tokenize(text) {
  return text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildLcsMatrix(sourceTokens, targetTokens) {
  const rows = sourceTokens.length + 1;
  const cols = targetTokens.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = sourceTokens.length - 1; i >= 0; i -= 1) {
    for (let j = targetTokens.length - 1; j >= 0; j -= 1) {
      if (sourceTokens[i] === targetTokens[j]) {
        matrix[i][j] = matrix[i + 1][j + 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i + 1][j], matrix[i][j + 1]);
      }
    }
  }

  return matrix;
}

export function diffText(sourceText, targetText) {
  const sourceTokens = tokenize(sourceText);
  const targetTokens = tokenize(targetText);

  if (sourceTokens.length === 0 && targetTokens.length === 0) {
    return { added: [], removed: [] };
  }

  const lcsMatrix = buildLcsMatrix(sourceTokens, targetTokens);

  const added = [];
  const removed = [];
  let pendingAdded = [];
  let pendingRemoved = [];

  function flushPending() {
    if (pendingAdded.length > 0) {
      added.push(pendingAdded.join(" "));
      pendingAdded = [];
    }

    if (pendingRemoved.length > 0) {
      removed.push(pendingRemoved.join(" "));
      pendingRemoved = [];
    }
  }

  let i = 0;
  let j = 0;

  while (i < sourceTokens.length && j < targetTokens.length) {
    if (sourceTokens[i] === targetTokens[j]) {
      flushPending();
      i += 1;
      j += 1;
      continue;
    }

    const skipSourceScore = lcsMatrix[i + 1][j];
    const skipTargetScore = lcsMatrix[i][j + 1];

    if (skipSourceScore >= skipTargetScore) {
      pendingRemoved.push(sourceTokens[i]);
      i += 1;
    } else {
      pendingAdded.push(targetTokens[j]);
      j += 1;
    }
  }

  while (i < sourceTokens.length) {
    pendingRemoved.push(sourceTokens[i]);
    i += 1;
  }

  while (j < targetTokens.length) {
    pendingAdded.push(targetTokens[j]);
    j += 1;
  }

  flushPending();

  return { added, removed };
}
