// Schedule-a-demo page entry: shared nav + reveal, the flanking dot
// fields, and the demo-request form — validation, chip radiogroup,
// submit states, and the backend seam.
// Module imports carry the same version as the entry script in
// demo/index.html — bump them together.
import { initNav } from './nav.js?v=31';
import { initReveal } from './reveal.js?v=31';
import { clamp, rng, fitCanvas, whileVisible, reducedMotion } from './util.js?v=31';

/* ============================================================
   Backend seam
   ============================================================ */

const DEMO_ENDPOINT = '/api/demo-request'; // BACKEND: point this at your handler

// Payload shape:
//   {
//     name: string,
//     email: string,
//     company: string,
//     role: "security_leader" | "investor" | "other" | null
//   }
// The hidden honeypot field (`website`) is dropped client-side when
// filled, but check it server-side too and reject any payload carrying it.
//
// Response contract: any 2xx → success (the page shows the success
// state). Anything else, or a network error → error state: the button
// re-enables, a form-level failure line shows, and the entered values
// are NOT lost.
async function submitDemoRequest(payload) {
  const res = await fetch(DEMO_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

/* ============================================================
   The form
   ============================================================ */

function initForm() {
  const form = document.getElementById('demo-form');
  if (!form) return;
  const fieldset = document.getElementById('demo-fieldset');
  const submit = document.getElementById('demo-submit');
  const fail = document.getElementById('demo-fail');
  const success = document.getElementById('demo-success');

  // --- role chips: a keyboard-operable radio group, optional ---
  const chips = [...document.querySelectorAll('.demo-chip')];
  let role = null;

  function selectChip(chip) {
    // clicking the selected chip clears it — the group is optional
    const next = chip.getAttribute('aria-checked') === 'true' ? null : chip;
    chips.forEach((c) => {
      c.setAttribute('aria-checked', String(c === next));
      c.tabIndex = next ? (c === next ? 0 : -1) : 0;
    });
    role = next ? next.dataset.role : null;
  }

  chips.forEach((chip, i) => {
    chip.addEventListener('click', () => selectChip(chip));
    chip.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const next = chips[(i + dir + chips.length) % chips.length];
      next.focus();
      selectChip(next);
    });
  });

  // --- per-field validation, an accent not a flood ---
  const FIELDS = [
    { key: 'name', input: document.getElementById('f-name'), error: document.getElementById('err-name'),
      check: (v) => (v ? '' : 'add your name') },
    { key: 'email', input: document.getElementById('f-email'), error: document.getElementById('err-email'),
      check: (v) => (!v ? 'add your work email'
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'that email doesn’t look right' : '') },
    { key: 'company', input: document.getElementById('f-company'), error: document.getElementById('err-company'),
      check: (v) => (v ? '' : 'add your company') },
  ];

  function setFieldError(field, message) {
    const wrap = field.input.closest('.demo-field');
    wrap.classList.toggle('is-error', Boolean(message));
    field.error.textContent = message || field.error.textContent;
    field.error.hidden = !message;
    field.input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  // an invalid field clears its error as soon as it's corrected
  FIELDS.forEach((field) => {
    field.input.addEventListener('input', () => {
      if (field.input.closest('.demo-field').classList.contains('is-error')) {
        setFieldError(field, field.check(field.input.value.trim()));
      }
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    fail.hidden = true;

    let firstInvalid = null;
    for (const field of FIELDS) {
      const message = field.check(field.input.value.trim());
      setFieldError(field, message);
      if (message && !firstInvalid) firstInvalid = field.input;
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    // honeypot filled → a bot; silently drop (pretend success)
    if (document.getElementById('f-website').value) {
      form.hidden = true;
      success.hidden = false;
      return;
    }

    // submitting: lock the form, dim affordance, in-progress label
    fieldset.disabled = true;
    submit.textContent = 'Sending…';

    let ok = false;
    try {
      ok = await submitDemoRequest({
        name: FIELDS[0].input.value.trim(),
        email: FIELDS[1].input.value.trim(),
        company: FIELDS[2].input.value.trim(),
        role,
      });
    } catch {
      ok = false;
    }

    if (ok) {
      form.hidden = true;
      success.hidden = false;
    } else {
      // error: re-enable, keep every entered value
      fieldset.disabled = false;
      submit.replaceChildren('Schedule a demo');
      const glyph = document.createElement('span');
      glyph.className = 'btn__glyph';
      glyph.textContent = '→';
      submit.appendChild(glyph);
      fail.hidden = false;
    }
  });
}

/* ============================================================
   Flanking dot fields — coded-environment depth, greys only.
   Denser at the page edges, scattering out toward the content.
   Gentle twinkle while on screen; static under reduced motion.
   ============================================================ */

function tone(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function buildField(canvas, edge, seed) {
  const { ctx, w, h } = fitCanvas(canvas);
  const rand = rng(seed);
  const tones = [tone('--dot-faint'), tone('--dot-mid'), tone('--dot-dark')];
  const gap = 14;
  const dots = [];
  for (let x = gap / 2; x < w; x += gap) {
    for (let y = gap / 2; y < h; y += gap) {
      // density falls from the outer edge toward the content column
      const toEdge = edge === 'left' ? x / w : 1 - x / w;
      const p = clamp(1 - toEdge * 1.25, 0, 1);
      if (rand() > p * 0.8) continue;
      dots.push({
        x: x + (rand() - 0.5) * gap * 0.9,
        y: y + (rand() - 0.5) * gap * 0.9,
        tone: tones[rand() < 0.75 ? 0 : rand() < 0.7 ? 1 : 2],
        alpha: 0.25 + rand() * 0.6,
        phase: rand() * Math.PI * 2,   // twinkle offset
        rate: 0.3 + rand() * 0.5,      // twinkle speed
      });
    }
  }
  return { ctx, w, h, dots };
}

function drawField(field, t) {
  const { ctx, w, h, dots } = field;
  ctx.clearRect(0, 0, w, h);
  for (const d of dots) {
    const tw = t < 0 ? 1 : 0.75 + 0.25 * Math.sin(d.phase + t * d.rate);
    ctx.globalAlpha = d.alpha * tw;
    ctx.fillStyle = d.tone;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 1.3, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function initDotFields() {
  const left = document.querySelector('.demo-dots--left');
  const right = document.querySelector('.demo-dots--right');
  if (!left || !right) return;
  const still = reducedMotion();

  let fields = [];
  function build() {
    fields = [buildField(left, 'left', 3), buildField(right, 'right', 17)];
    fields.forEach((f) => drawField(f, -1));
  }
  build();
  window.addEventListener('resize', build);

  if (still) return; // static depth

  let visible = false;
  let rafId = 0;
  function frame(now) {
    rafId = 0;
    if (!visible) return;
    fields.forEach((f) => drawField(f, now / 1000));
    rafId = requestAnimationFrame(frame);
  }
  whileVisible(left, (v) => {
    visible = v;
    if (v && !rafId) rafId = requestAnimationFrame(frame);
  });
}

initNav();
initReveal();
initForm();
initDotFields();
