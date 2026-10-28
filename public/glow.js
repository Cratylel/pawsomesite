const cards = document.querySelectorAll(".main, .comment, .special, .comments textarea");

addEventListener("pointermove", (e) => {
    const rects = [...cards].map((card) => [card, card.getBoundingClientRect()]);
    for (const [card, r] of rects) {
        card.style.setProperty("--glow-x", e.clientX - r.left + "px");
        card.style.setProperty("--glow-y", e.clientY - r.top + "px");
        const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
        const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
        const far = Math.hypot(dx, dy);
        card.style.setProperty("--glow-a", Math.max(0, .2 * (1 - far / 400)).toFixed(3));
    }
});

addEventListener("pointerleave", () => {
    for (const card of cards) card.style.setProperty("--glow-a", 0);
});
