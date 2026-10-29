'use strict';
(function (exports) {
  const WIDTH = 190, HEIGHT = 110, GAP_X = 400, GAP_Y = 250;
  function route(a, b, obstacles = []) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) >= WIDTH + 32) {
      const x1 = a.x + (dx > 0 ? WIDTH : 0), x2 = b.x + (dx > 0 ? 0 : WIDTH);
      const y1 = a.y + HEIGHT / 2, y2 = b.y + HEIGHT / 2, mid = (x1 + x2) / 2;
      return `M${x1},${y1} H${mid} V${y2} H${x2}`;
    }
    if (Math.abs(dy) >= HEIGHT + 32) {
      const y1 = a.y + (dy > 0 ? HEIGHT : 0), y2 = b.y + (dy > 0 ? 0 : HEIGHT);
      const x1 = a.x + WIDTH / 2, x2 = b.x + WIDTH / 2, mid = (y1 + y2) / 2;
      const blocked = obstacles.some(p => p !== a && p !== b && p.x < Math.max(x1, x2) && p.x + WIDTH > Math.min(x1, x2) && p.y < Math.max(y1, y2) && p.y + HEIGHT > Math.min(y1, y2));
      if (blocked) {
        const outer = Math.max(a.x, b.x) + WIDTH + 70;
        return `M${a.x + WIDTH},${a.y + HEIGHT / 2} H${outer} V${b.y + HEIGHT / 2} H${b.x + WIDTH}`;
      }
      return `M${x1},${y1} V${mid} H${x2} V${y2}`;
    }
    const x1 = a.x + WIDTH, x2 = b.x + WIDTH, outer = Math.max(x1, x2) + 40;
    return `M${x1},${a.y + HEIGHT / 2} H${outer} V${b.y + HEIGHT / 2} H${x2}`;
  }
  Object.assign(exports, { WIDTH, HEIGHT, GAP_X, GAP_Y, route });
})(typeof module === 'object' ? module.exports : (window.FlowGeometry = {}));
