
const canvas = document.querySelector(".water");
const ctx = canvas.getContext("2d");

let tile = 14;        // bigger = chunkier voxels, fewer tiles
const damp = matchMedia("(prefers-reduced-motion: reduce)").matches ? .97 : .996;
const push = .01;     // cursor movement strength
const splash = .7;    // click strength
const fade = .5;      // how bright tiles get
const rest = .006; 

let cols, rows, prev, cur, running, lastX, lastY, last, pageWidth, pageHeight, resizeTimer;

const build = () => {
    const width = document.documentElement.clientWidth + 40;
    const height = document.documentElement.scrollHeight;
    pageWidth = width;
    pageHeight = height;
    // tile size follows the width only, so a long comments list
    // doesn't turn the voxels into bricks
    tile = Math.max(14, Math.ceil(width / 140));
    if (damp < .98) tile = Math.max(tile, 24);

    let dpr = Math.min(2, devicePixelRatio || 1);
    if (width * height * dpr * dpr > 12e6) dpr = 1;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cols = Math.ceil(width / tile);
    rows = Math.ceil(height / tile);
    prev = new Float32Array(cols * rows);
    cur = new Float32Array(cols * rows);
    running = false;
    ctx.clearRect(0, 0, width, height);
};

const step = (now) => {
    if (now - last < 16) {
        requestAnimationFrame(step);
        return;
    }
    last = now;

    let loudest = 0;
    ctx.clearRect(0, 0, pageWidth, pageHeight);
    for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
            const i = y * cols + x;
            cur[i] = (prev[i - 1] + prev[i + 1] + prev[i - cols] + prev[i + cols]) / 2 - cur[i];
            cur[i] *= damp;
            loudest = Math.max(loudest, Math.abs(cur[i]));
            const v = cur[i];
            if (Math.abs(v) < rest) continue;
            ctx.globalAlpha = Math.min(Math.abs(v) * fade, .4);
            ctx.fillStyle = v > 0 ? "rgb(212, 176, 240)" : "rgb(122, 82, 182)";
            ctx.fillRect(x * tile + 1, y * tile + 1 - v * 34, tile - 2, tile - 2);
        }
    }
    for (let y = 1; y < rows - 1; y++) {
        cur[y * cols] = cur[y * cols + 1];
        cur[y * cols + cols - 1] = cur[y * cols + cols - 2];
    }
    for (let x = 1; x < cols - 1; x++) {
        cur[x] = cur[cols + x];
        cur[(rows - 1) * cols + x] = cur[(rows - 2) * cols + x];
    }
    [prev, cur] = [cur, prev];
    if (loudest < rest) running = false;
    else requestAnimationFrame(step);
};

const wake = () => {
    if (running) return;
    running = true;
    requestAnimationFrame(step);
};

const poke = (x, y, power) => {
    if (x < 1 || y < 1 || x >= cols - 1 || y >= rows - 1) return;
    const i = y * cols + x;
    prev[i] += power;
    prev[i - 1] += power * .4;
    prev[i + 1] += power * .4;
    prev[i - cols] += power * .4;
    prev[i + cols] += power * .4;
    wake();
};

addEventListener("pointermove", (e) => {
    for (const ev of e.getCoalescedEvents?.() ?? [e]) {
        const x = ev.clientX + scrollX;
        const y = ev.clientY + scrollY;
        const d = lastX === undefined ? 0 : Math.hypot(x - lastX, y - lastY);
        lastX = x;
        lastY = y;
        if (d < 1) continue;
        poke(Math.floor(x / tile), Math.floor(y / tile), Math.min(d, 40) * .01 + push);
    }
});

addEventListener("pointerdown", (e) => {
    const x = Math.floor((e.clientX + scrollX) / tile);
    const y = Math.floor((e.clientY + scrollY) / tile);
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            const r = Math.hypot(dx, dy);
            if (r <= 2) poke(x + dx, y + dy, splash * (1 - r / 3));
        }
    }
});

addEventListener("pointerleave", () => {
    lastX = undefined;
    lastY = undefined;
});

const queueResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 150);
};

addEventListener("resize", queueResize);
addEventListener("load", queueResize);
new ResizeObserver(queueResize).observe(document.body);

build();