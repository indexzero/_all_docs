const fs = require('fs');
const path = require('path');

function compactCache({ cacheDir, ideal, maxFiles }) {
  let comparator = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  let files = fs.readdirSync(cacheDir)
    .filter(f => f.endsWith('.json'))
    .sort(comparator);

  let groups = [];
  let currGroup = [];
  let currSum = 0;

  for (let file of files) {
    let fullPath = path.join(cacheDir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    let data;
    try { data = JSON.parse(content); }
    catch (err) { console.error(`Error parsing ${file}: ${err}`); continue; }

    let count = Array.isArray(data.rows) ? data.rows.length : 0;
    if (count > ideal) {
      if (currGroup.length) { 
        groups.push(currGroup); 
        currGroup = []; 
        currSum = 0;
      }
      groups.push([file]);
    } else {
      if (currSum + count > ideal) {
        groups.push(currGroup);
        currGroup = [file];
        currSum = count;
      } else {
        currGroup.push(file);
        currSum += count;
      }
    }
  }

  if (currGroup.length) groups.push(currGroup);
  if (groups.length > maxFiles) {
    console.warn(`Warning: cannot compact to fewer than ${groups.length} files without exceeding the ideal row count.`);
  }

  groups = groups
    .map(g => g.sort(comparator))
    .sort((a, b) => comparator(a[0], b[0]));

  return groups;
}

function runCompaction({ cacheDir, compactDir, operations }) {
  if (!fs.existsSync(compactDir)) fs.mkdirSync(compactDir, { recursive: true });
  let mergedFiles = [];
  for (let group of operations) {
    let firstFile = group[0];
    let lastFile = group[group.length - 1];
    let startKey = firstFile.split('__')[0];
    let lastPart = lastFile.split('__')[1] || '';
    let endKey = lastPart.endsWith('.json') ? lastPart.slice(0, -5) : lastPart;
    let mergedFilename = `${startKey}__${endKey}.json`;
    let mergedRows = [];
    for (let file of group) {
      let fullPath = path.join(cacheDir, file);
      let content = fs.readFileSync(fullPath, 'utf8');
      let data;
      try { data = JSON.parse(content); }
      catch (err) { console.error(`Error parsing ${file}: ${err}`); continue; }
      if (Array.isArray(data.rows)) mergedRows = mergedRows.concat(data.rows);
    }
    let mergedData = {
      rows: mergedRows,
      total_rows: mergedRows.length,
      offset: 0
    };

    let mergedPath = path.join(compactDir, mergedFilename);
    fs.writeFileSync(mergedPath, JSON.stringify(mergedData));
    mergedFiles.push(mergedFilename);
  }
  mergedFiles.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  return mergedFiles;
}

function verifyCompaction({ cacheDir, compactDir, operations, merged }) {
  let results = [];
  if (operations.length !== merged.length) {
    console.warn(
      `Mismatch: operations has ${operations.length} groups but merged has ${merged.length} files.`
    );
  }

  for (let i = 0; i < operations.length; i++) {
    let group = operations[i];
    // Compute expected merged filename using the same convention as runCompaction.
    let firstFile = group[0];
    let lastFile = group[group.length - 1];
    let startKey = firstFile.split('__')[0];
    let lastPart = lastFile.split('__')[1] || '';
    let endKey = lastPart.endsWith('.json') ? lastPart.slice(0, -5) : lastPart;
    let expectedMergedName = `${startKey}__${endKey}.json`;
    let mergedFileName = merged[i];
    if (expectedMergedName !== mergedFileName) {
      console.error(
        `Group ${JSON.stringify(group)}: Expected merged filename ${expectedMergedName}, got ${mergedFileName}`
      );
    }
    // Build the expected rows array from the original files.
    let expectedRows = [];
    group.forEach((file) => {
      let filePath = path.join(cacheDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      let data = JSON.parse(content);
      if (Array.isArray(data.rows)) {
        expectedRows = expectedRows.concat(data.rows);
      }
    });
    // Read the compacted file.
    let mergedPath = path.join(compactDir, mergedFileName);
    let mergedData = JSON.parse(fs.readFileSync(mergedPath, 'utf8'));
    let mergedRows = Array.isArray(mergedData.rows) ? mergedData.rows : [];
    let ok = expectedRows.length === mergedRows.length;
    results.push({
      source: group,
      compact: mergedFileName,
      ok,
      length: mergedRows.length,
    });
  }
  return results;
}

module.exports = {
  compactCache,
  runCompaction,
  verifyCompaction
}
