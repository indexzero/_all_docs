
function fromPivots(pivots) {
  return pivots.map((startKey, i) => {
    const endKey = pivots[i + 1];
    const id = `${startKey}__${endKey}`;
    return endKey && {
      startKey,
      endKey,
      id,
      filename: `${id}.json`
    };
  }).filter(Boolean);
}

module.exports = {
  fromPivots
};
