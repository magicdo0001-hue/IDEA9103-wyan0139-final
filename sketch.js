// ======================================================
// Pacita Abad 'Wheels of Fortune' — ANIMATED (Perlin noise + randomness)
// - Wheels scale and rotate slowly based on Perlin noise.
// - Background dots drift slightly based on Perlin noise.
// - Whole scene scrolls slowly to the left; a second copy
//   is drawn to the right to create an endless loop.
// Controls: R = regenerate (new random seed)
//           Shift+R = regenerate (same seed)
//           S = save image
// ======================================================

let SEED = 0;
let wheels = [];
let beadArcs = [];
let backgroundDots = [];

// Horizontal scroll speed (pixels per second)
const SCROLL_SPEED = 30; // fairly slow

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100);
  noStroke();
  regenerate(false);

  // Keep animation loop
  frameRate(60);
}

function draw() {
  // Real time in seconds
  const timeSec = millis() * 0.001;

  // Slower animation time (10% of original speed)
  const animTime = timeSec * 0.1;

  // Horizontal scroll offset
  const scroll = (timeSec * SCROLL_SPEED) % width;

  background(200, 40, 20); // Deep teal background

  push();
  // Draw first scene shifted left
  translate(-scroll, 0);
  drawScene(animTime);

  // Draw second copy to the right, to create endless scrolling
  translate(width, 0);
  drawScene(animTime);
  pop();
}

// Draw one full scene at the current origin
function drawScene(animTime) {
  // Background dots (with noise-based drifting)
  DotSystem.drawBackgroundDots(backgroundDots, animTime);

  // Static bead arcs
  for (const arc of beadArcs) arc.display();

  // Animated wheels (scale + rotation)
  for (const w of wheels) w.display(animTime);
}

function keyPressed() {
  if (key === 'R' || key === 'r') {
    const same = keyIsDown(SHIFT);
    regenerate(same);  // R = new seed, Shift+R = reuse seed
  }
  if (key === 'S' || key === 's') {
    saveCanvas('wheels_of_fortune_anim', 'png'); // Save screenshot
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  regenerate(true);  // Regenerate layout with the same seed
}

function newSeed() {
  // Generate a sufficiently random new seed
  SEED = (Date.now() ^ Math.floor(performance.now() * 1000) ^ Math.floor(Math.random() * 1e9)) >>> 0;
}

function regenerate(keepSameSeed = false) {
  if (!keepSameSeed) newSeed();
  randomSeed(SEED);
  noiseSeed(SEED);

  wheels = LayoutSystem.generateWheels();
  beadArcs = LayoutSystem.generateBeadArcs(wheels, 2);
  backgroundDots = LayoutSystem.generateBackgroundDots(wheels);
}


// ======================================================
// Part 1. PaletteSystem — Color control
// ======================================================

const PaletteSystem = {
  basePalette: [
    [340, 90, 100], // Magenta
    [25,  95, 100], // Orange
    [55,  90, 100], // Yellow
    [200, 60,  90], // Cyan-blue
    [120, 70,  90], // Green
    [0,   0, 100],  // White
    [0,   0,  15]   // Black
  ],

  pick() {
    // Select a base color and add small random variations
    const p = this.basePalette[int(random(this.basePalette.length))];
    let h = (p[0] + random(-8, 8) + 360) % 360;
    let s = constrain(p[1] + random(-6, 6), 50, 100);
    let b = constrain(p[2] + random(-6, 6), 40, 100);
    return color(h, s, b);
  }
};


// ======================================================
// Part 2. DotSystem — Dot generation (background & ring dots)
//      + Perlin-noise-based drifting for background dots
// ======================================================

const DotSystem = {
  // Generate dots for wheel rings
  makeRingDots(rad) {
    const count = int(map(rad, 20, 220, 16, 32)); // Reduced density
    const dotR  = rad * 0.10;
    const dots = [];
    for (let k = 0; k < count; k++) {
      const a = (TWO_PI * k) / count;
      const rr = rad * random(0.8, 0.95);
      dots.push({ x: cos(a) * rr, y: sin(a) * rr, r: dotR });
    }
    return dots;
  },

  // Generate background scattered dots (outside wheels only)
  generateBackgroundDots(wheels) {
    const dots = [];
    const step = min(width, height) / 28; // Fewer sample points

    const paletteBG = [
      color(0, 0, 100),   // White
      color(0, 0, 15),    // Black
      color(25, 95, 100), // Orange
      color(340, 90, 100) // Magenta
    ];

    for (let y = step * 0.5; y < height; y += step) {
      for (let x = step * 0.5; x < width; x += step) {
        if (random() >= 0.6) continue; // Lower density
        const px = x + random(-step * 0.3, step * 0.3);
        const py = y + random(-step * 0.3, step * 0.3);

        // Skip if point is inside a wheel
        let insideWheel = false;
        for (const w of wheels) {
          if (dist(px, py, w.x, w.y) < w.baseR * 0.9) {
            insideWheel = true;
            break;
          }
        }
        if (insideWheel) continue;

        dots.push({
          x: px,
          y: py,
          r: random(step * 0.06, step * 0.12),
          c: random(paletteBG),
          // Perlin noise seeds for drifting
          nx: random(1000),
          ny: random(1000),
          moveAmp: random(2, 5) // max drifting distance in pixels
        });
      }
    }
    return dots;
  },

  // Draw scattered background dots with noise-based drifting
  drawBackgroundDots(dots, animTime) {
    const freq = 0.2; // drift frequency (cycles per second, quite slow)

    for (const d of dots) {
      const dx = map(noise(d.nx, animTime * freq), 0, 1, -d.moveAmp, d.moveAmp);
      const dy = map(noise(d.ny, animTime * freq), 0, 1, -d.moveAmp, d.moveAmp);

      fill(d.c);
      ellipse(d.x + dx, d.y + dy, d.r * 2);
    }
  }
};


// ======================================================
// Part 3. WheelSystem — Wheel visuals & bead arcs
//    + Perlin-noise-driven scale & rotation per wheel
// ======================================================

class Wheel {
  constructor(x, y, baseR) {
    this.x = x;
    this.y = y;
    this.baseR = baseR;

    // Core & bead colors
    this.coreCol = PaletteSystem.pick();
    this.beadColor = PaletteSystem.pick();

    // Layered structure
    this.layers = [];
    const nLayers = int(random(3, 5));
    for (let i = 0; i < nLayers; i++) {
      const ratio = map(i, 0, nLayers - 1, 0.25, 1.0);
      const style = random(["solid", "dots", "sunburst", "stripes"]);
      const col   = PaletteSystem.pick();

      const layer = { ratio, style, col };
      if (style === "dots") {
        const rad = this.baseR * ratio * 0.9;
        layer.dots = DotSystem.makeRingDots(rad); // Ring dot generation
      }

      this.layers.push(layer);
    }

    // Outer bead ring
    const ringR = this.baseR * 0.88;
    const beadSize = this.baseR * 0.09;
    const circumference = TWO_PI * ringR;
    const count = max(10, int(circumference / (beadSize * 1.2))); // Reduced count
    this.beadRing = { r: ringR, size: beadSize, count };

    // ---------------------------------------------
    // Animation parameters (Perlin noise + randomness)
    // ---------------------------------------------
    // Scale: each wheel has its own noise seed, frequency and range.
    // Range: roughly between ~0.3x and up to ~2x or more,
    // changing slowly because animTime is already slowed down.
    this.scaleNoiseSeed = random(1000);
    this.scaleFreq      = random(0.005, 0.015);   // cycles per second (on animTime)

    this.minScale       = random(0.3, 0.7);
    this.maxScale       = this.minScale + random(0.8, 1.2); // large possible difference

    // Rotation: each wheel has its own noise seed, frequency and angle range.
    // animTime is 0.1x of real time, so the effective angular speed is well under 10 deg/s.
    this.rotNoiseSeed   = random(2000, 3000);
    this.rotFreq        = random(0.005, 0.015);  // cycles per second (on animTime)
    this.rotRangeDeg    = random(20, 60);        // max +/- degrees from center
  }

  // Compute current scale factor from Perlin noise
  getScale(animTime) {
    const n = noise(this.scaleNoiseSeed, animTime * this.scaleFreq); // 0..1
    return map(n, 0, 1, this.minScale, this.maxScale);
  }

  // Compute current rotation angle from Perlin noise (degrees)
  getRotationDeg(animTime) {
    const n = noise(this.rotNoiseSeed, animTime * this.rotFreq); // 0..1
    return map(n, 0, 1, -this.rotRangeDeg, this.rotRangeDeg);
  }

  display(animTime) {
    push();
    translate(this.x, this.y);

    const s = this.getScale(animTime);
    const rotDeg = this.getRotationDeg(animTime);

    // Apply rotation then uniform scaling around the wheel center
    rotate(radians(rotDeg));
    scale(s);

    // 1. Outer bead ring
    for (let i = 0; i < this.beadRing.count; i++) {
      const a = (TWO_PI * i) / this.beadRing.count;
      const bx = cos(a) * (this.baseR * 0.88);
      const by = sin(a) * (this.baseR * 0.88);

      fill(0, 0, 15);
      ellipse(bx, by, this.beadRing.size * 1.4);

      fill(this.beadColor);
      ellipse(bx, by, this.beadRing.size);
    }

    // 2. Internal layers
    for (const L of this.layers) {
      const rad = this.baseR * L.ratio * 0.9;

      switch (L.style) {
        case "solid":
          fill(L.col);
          ellipse(0, 0, rad * 2);
          break;

        case "dots":
          fill(L.col);
          for (const d of L.dots) ellipse(d.x, d.y, d.r * 2);
          break;

        case "sunburst":
          WheelSystem.drawSunburst(rad, L.col);
          break;

        case "stripes":
          WheelSystem.drawStripes(rad, L.col);
          break;
      }
    }

    // 3. Core circle
    fill(this.coreCol);
    ellipse(0, 0, this.baseR * 0.18);

    pop();
  }
}

const WheelSystem = {
  // Radial "sunburst" pattern
  drawSunburst(rad, col) {
    const rays = int(map(rad, 20, 220, 20, 40)); // Reduced ray count
    for (let i = 0; i < rays; i++) {
      const a0 = (TWO_PI * i) / rays;
      const a1 = (TWO_PI * (i + 0.5)) / rays;

      fill(i % 2 ? col : color(0, 0, 15));
      beginShape();
      vertex(0, 0);
      vertex(cos(a0) * rad, sin(a0) * rad);
      vertex(cos(a1) * rad, sin(a1) * rad);
      endShape(CLOSE);
    }
  },

  // Circular stripe pattern
  drawStripes(rad, col) {
    const bands = int(random(4, 6)); // Fewer bands
    const thick = (rad * 0.9) / bands;

    for (let b = 0; b < bands; b++) {
      const rr = rad * 0.1 + b * thick;
      const segs = int(map(rad, 20, 220, 12, 24)); // Reduced segmentation

      for (let i = 0; i < segs; i++) {
        const a0 = (TWO_PI * i) / segs;
        const a1 = (TWO_PI * (i + 0.6)) / segs;

        fill(
          (hue(col) + b * 8 + i * 3) % 360,
          saturation(col),
          brightness(col)
        );
        arc(0, 0, rr * 2, rr * 2, a0, a1, PIE);
      }
    }
  }
};


// ======================================================
// BeadArc — Curved bead connection between wheels (static)
// ======================================================

class BeadArc {
  constructor(wA, wB) {
    // Compute endpoints at the edge of wheels
    const a = createVector(wA.x, wA.y);
    const b = createVector(wB.x, wB.y);
    const dir = p5.Vector.sub(b, a).normalize();

    this.A = p5.Vector.add(a, p5.Vector.mult(dir, wA.baseR * 0.95));
    this.B = p5.Vector.sub(b, p5.Vector.mult(dir, wB.baseR * 0.95));

    // Quadratic Bézier control point with normal offset
    const chord = p5.Vector.sub(this.B, this.A);
    const mid = p5.Vector.add(this.A, p5.Vector.mult(chord, 0.5));
    const normal = createVector(-chord.y, chord.x).normalize();
    const curvature = chord.mag() * (0.25 + random(-0.08, 0.08));
    this.C = p5.Vector.add(mid, p5.Vector.mult(normal, curvature));

    // Bead styling
    this.col = wA.beadColor;
    const beadSize = min(wA.baseR, wB.baseR) * 0.06;
    const spacing = beadSize * 1.4;
    const approxLen = chord.mag() * 1.1;
    this.n = max(4, int(approxLen / spacing));
    this.beadSize = beadSize;
  }

  _pointAt(t) {
    // Quadratic Bézier interpolation
    const x = (1 - t) * (1 - t) * this.A.x + 2 * (1 - t) * t * this.C.x + t * t * this.B.x;
    const y = (1 - t) * (1 - t) * this.A.y + 2 * (1 - t) * t * this.C.y + t * t * this.B.y;
    return createVector(x, y);
  }

  display() {
    for (let i = 0; i <= this.n; i++) {
      const t = i / this.n;
      const p = this._pointAt(t);

      fill(0, 0, 15);
      ellipse(p.x, p.y, this.beadSize * 1.45);

      fill(this.col);
      ellipse(p.x, p.y, this.beadSize);
    }
  }
};


// ======================================================
// Part 4. LayoutSystem — Controls wheel placement, arcs, and background dots
// ======================================================

const LayoutSystem = {
  // Place wheels on a jittered grid, avoiding overlaps
  generateWheels() {
    const wheelsOut = [];
    const unit = min(width, height) / 9;
    const cols = int(width / unit) + 1;
    const rows = int(height / unit) + 1;

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (random() < 0.8) {
          const cx = (i + 0.5) * unit + random(-unit * 0.25, unit * 0.25);
          const cy = (j + 0.5) * unit + random(-unit * 0.25, unit * 0.25);
          const r  = unit * random(0.55, 1.05);

          let ok = true;
          for (const w of wheelsOut) {
            if (dist(cx, cy, w.x, w.y) < (r + w.baseR) * 0.85) {
              ok = false;
              break;
            }
          }
          if (ok) wheelsOut.push(new Wheel(cx, cy, r));
        }
      }
    }
    return wheelsOut;
  },

  // Attach bead arcs between nearest neighbors
  generateBeadArcs(wheelsIn, neighborsPerWheel = 2) {
    const arcs = [];

    for (let i = 0; i < wheelsIn.length; i++) {
      const w1 = wheelsIn[i];

      // Sort neighbors by distance
      const candidates = [];
      for (let j = 0; j < wheelsIn.length; j++) {
        if (i === j) continue;
        const d = dist(w1.x, w1.y, wheelsIn[j].x, wheelsIn[j].y);
        candidates.push({ j, d });
      }
      candidates.sort((a, b) => a.d - b.d);

      let added = 0;
      for (const c of candidates) {
        if (added >= neighborsPerWheel) break;
        const j = c.j;
        if (j < i) continue;

        const w2 = wheelsIn[j];
        const d = c.d;

        if (d < (w1.baseR + w2.baseR) * 0.95) continue;
        if (d > min(width, height) / 2) continue;

        const arc = new BeadArc(w1, w2);
        const mid = arc._pointAt(0.5);

        // Avoid arcs that pass through a third wheel
        let blocked = false;
        for (let k = 0; k < wheelsIn.length; k++) {
          if (k === i || k === j) continue;
          if (dist(mid.x, mid.y, wheelsIn[k].x, wheelsIn[k].y) < wheelsIn[k].baseR * 0.9) {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          arcs.push(arc);
          added++;
        }
      }
    }
    return arcs;
  },

  generateBackgroundDots(wheelsIn) {
    return DotSystem.generateBackgroundDots(wheelsIn);
  }
};
