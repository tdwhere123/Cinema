/** Independent scalar-field contour tracing. Each crossing is shared by adjacent cells. */
export function contourPath(width, height, sample, step = 16, minArea = 500) {
  const margin = step * 3,
    columns = Math.ceil((width + margin * 2) / step),
    rows = Math.ceil((height + margin * 2) / step),
    dx = (width + margin * 2) / columns,
    dy = (height + margin * 2) / rows;
  const values = Array.from({ length: rows + 1 }, (_, y) =>
    Array.from({ length: columns + 1 }, (_, x) =>
      x === 0 || y === 0 || x === columns || y === rows
        ? -1
        : sample(x * dx - margin, y * dy - margin),
    ),
  );
  const points = new Map(),
    edges = new Map();
  function crossing(ax, ay, bx, by) {
    const a = ay * (columns + 1) + ax,
      b = by * (columns + 1) + bx,
      key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (!points.has(key)) {
      const va = values[ay][ax],
        vb = values[by][bx],
        t = va / (va - vb);
      points.set(key, [
        (ax + (bx - ax) * t) * dx - margin,
        (ay + (by - ay) * t) * dy - margin,
      ]);
    }
    return key;
  }
  function join(a, b) {
    if (!edges.has(a)) edges.set(a, []);
    if (!edges.has(b)) edges.set(b, []);
    edges.get(a).push(b);
    edges.get(b).push(a);
  }
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < columns; x++) {
      const corners = [
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1],
        ],
        hits = [];
      for (let edge = 0; edge < 4; edge++) {
        const a = corners[edge],
          b = corners[(edge + 1) % 4];
        if (values[a[1]][a[0]] > 0 !== values[b[1]][b[0]] > 0)
          hits.push(crossing(...a, ...b));
      }
      if (hits.length === 2) join(hits[0], hits[1]);
      if (hits.length === 4) {
        const center = corners.reduce(
          (sum, [cx, cy]) => sum + values[cy][cx],
          0,
        );
        if (center > 0 === values[y][x] > 0) {
          join(hits[0], hits[1]);
          join(hits[2], hits[3]);
        } else {
          join(hits[0], hits[3]);
          join(hits[1], hits[2]);
        }
      }
    }
  const visited = new Set(),
    loops = [];
  for (const first of edges.keys()) {
    if (visited.has(first)) continue;
    const loop = [];
    let previous = null,
      key = first;
    while (key && !visited.has(key)) {
      visited.add(key);
      loop.push(points.get(key));
      const next = edges.get(key).find((k) => k !== previous);
      previous = key;
      key = next;
    }
    if (key === first && loop.length >= 3) {
      const area =
        Math.abs(
          loop.reduce((sum, p, i) => {
            const q = loop[(i + 1) % loop.length];
            return sum + p[0] * q[1] - q[0] * p[1];
          }, 0),
        ) / 2;
      if (area >= minArea) loops.push(loop);
    }
  }
  const n = (v) => Math.round(v * 10) / 10;
  let path = `M${-margin} ${-margin}H${n(width + margin)}V${n(height + margin)}H${-margin}Z`;
  for (const loop of loops) {
    // Rounded joins, not a different random polygon each frame.
    const last = loop.at(-1),
      first = loop[0];
    path += `M${n((last[0] + first[0]) / 2)} ${n((last[1] + first[1]) / 2)}`;
    loop.forEach((p, i) => {
      const q = loop[(i + 1) % loop.length];
      path += `Q${n(p[0])} ${n(p[1])} ${n((p[0] + q[0]) / 2)} ${n((p[1] + q[1]) / 2)}`;
    });
    path += 'Z';
  }
  return path;
}
