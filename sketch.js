// ─────────────────────────────────────────────
//  FFT Audiovisueel — minimale werkende versie
// ─────────────────────────────────────────────

// ── CONFIGURATIE ──────────────────────────────
const CONFIG = {
  audioFile: 'audio/feng.mp3',
  images: [
    'images/tapijt_rot.png',
    'images/texturen_rot.png',
    'images/texturen_opnieuw_rot.png',
  ],

  // Trigger-drempels per band (0–255, false = uitgeschakeld)
  triggerBass:   120,   // lage tonen
  triggerMid:    150,   // middentonen
  triggerTreble: 160,   // hoge tonen

  triggerCooldown: 500, // ms tussen twee triggers (voorkomt te snel wisselen)

  // Visueel
  fadeSpeed: 8,           // snelheid van de cross-fade (1 = traag, 255 = instant)
};

// ── STAAT ─────────────────────────────────────
let sound, fft;
let images = [];
let currentImg = null;
let nextImg = null;
let imgIndex = 0;

let audioStarted = false;
let audioPaused = false;
let soundLoaded = false;
let statusMsg = 'Klik ▶ om te starten';
let lastTriggerTime = 0;
let fadeAlpha = 255;

// ── PRELOAD ───────────────────────────────────
function preload() {
  for (let path of CONFIG.images) {
    images.push(loadImage(path,
      () => {},
      () => console.warn('Afbeelding niet gevonden:', path)
    ));
  }

  sound = loadSound(CONFIG.audioFile,
    () => { soundLoaded = true; console.log('Audio geladen:', CONFIG.audioFile); },
    (err) => { console.warn('Audio laadFout:', err); statusMsg = 'Audio niet gevonden'; }
  );
}

// ── SETUP ─────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  imageMode(CENTER);
  noStroke();

  // FFT initialiseren
  fft = new p5.FFT(0.8, 1024);
  if (sound) fft.setInput(sound);

  // Eerste afbeelding instellen
  if (images.length > 0) {
    currentImg = images[0];
    imgIndex = 0;
  }
}

// ── DRAW ──────────────────────────────────────
function draw() {
  background(0);

  // — Huidig beeld tekenen
  if (currentImg) {
    drawImageFitted(currentImg, 255);
  }

  // — Cross-fade naar volgend beeld
  if (nextImg) {
    drawImageFitted(nextImg, 255 - fadeAlpha);
    fadeAlpha -= CONFIG.fadeSpeed;
    if (fadeAlpha <= 0) {
      currentImg = nextImg;  // wissel voltooid
      nextImg = null;
      fadeAlpha = 255;
    }
  }

  // — FFT analyse & trigger (alleen als audio loopt en niet gepauzeerd)
  if (audioStarted && !audioPaused) {
    analyzeAndTrigger();
  }

  // — Discrete play/pauze-knop
  drawPlayButton();
  drawPauseButton();
}

// ── FFT ANALYSE & TRIGGER ─────────────────────
function analyzeAndTrigger() {
  fft.analyze();

  let bass   = fft.getEnergy('bass');
  let mid    = fft.getEnergy('mid');
  let treble = fft.getEnergy('treble');

  let now = millis();
  let cooldownOk = now - lastTriggerTime > CONFIG.triggerCooldown;

  if (cooldownOk) {
    if ((CONFIG.triggerBass   && bass   > CONFIG.triggerBass)   ||
        (CONFIG.triggerMid    && mid    > CONFIG.triggerMid)    ||
        (CONFIG.triggerTreble && treble > CONFIG.triggerTreble)) {
      lastTriggerTime = now;
      console.log(`PIEK  t=${nf(now/1000,1,2)}s  BASS:${nf(bass,3)}  MID:${nf(mid,3)}  TREBLE:${nf(treble,3)}`);
      switchToNextImage();
    }
  }

  // Debug: balkjes linksonder
  drawEnergyBars(bass, mid, treble);

  // Console log elke ~30 frames
  if (frameCount % 30 === 0) {
    console.log(`BASS: ${nf(bass,3)}  MID: ${nf(mid,3)}  TREBLE: ${nf(treble,3)}`);
  }
}

// ── BEELDWISSEL ───────────────────────────────
function switchToNextImage() {
  if (images.length < 2) return;
  imgIndex = (imgIndex + 1) % images.length;
  nextImg = images[imgIndex];
  fadeAlpha = 255;  // reset fade
}

// ── HULPFUNCTIES BEELD ────────────────────────

// Teken afbeelding schermvullend met behoud van verhouding
function drawImageFitted(img, alpha) {
  if (!img || !img.width) return;
  tint(255, alpha);
  let scale = max(width / img.width, height / img.height);
  image(img, width / 2, height / 2, img.width * scale, img.height * scale);
  noTint();
}

// Drie debug-balkjes linksonder: bass | mid | treble
function drawEnergyBars(bass, mid, treble) {
  let vals   = [bass, mid, treble];
  let thresholds = [CONFIG.triggerBass, CONFIG.triggerMid, CONFIG.triggerTreble];

  for (let i = 0; i < 3; i++) {
    let x  = 10 + i * 14;
    let bh = map(vals[i], 0, 255, 0, 80);
    let th = thresholds[i] ? map(thresholds[i], 0, 255, 0, 80) : -1;

    // Balk
    fill(vals[i] > (thresholds[i] || 999) ? color(255, 80, 80, 160) : color(255, 255, 255, 50));
    rect(x, height - 10 - bh, 8, bh);

    // Drempellijn
    if (th > 0) {
      stroke(255, 255, 255, 100);
      line(x, height - 10 - th, x + 8, height - 10 - th);
      noStroke();
    }
  }
}

// ── DISCRETE PLAY-KNOP ────────────────────────
function drawPlayButton() {
  if (audioStarted) return;

  let bx = 30, by = height - 30, br = 16;

  // Achtergrond cirkel
  fill(255, 255, 255, 40);
  noStroke();
  circle(bx, by, br * 2);

  // Play-driehoek
  fill(255, 255, 255, 200);
  triangle(
    bx - 5, by - 7,
    bx - 5, by + 7,
    bx + 8, by
  );

  // Statustekst naast knop
  if (statusMsg) {
    fill(255, 255, 255, 140);
    noStroke();
    textSize(11);
    textAlign(LEFT, CENTER);
    text(statusMsg, bx + br + 6, by);
  }
}

// ── DISCRETE PAUZE-KNOP ───────────────────────
function drawPauseButton() {
  if (!audioStarted) return;

  let bx = 30, by = height - 30, br = 16;

  // Achtergrond cirkel
  fill(255, 255, 255, 40);
  noStroke();
  circle(bx, by, br * 2);

  if (audioPaused) {
    // Play-driehoek (hervatten)
    fill(255, 255, 255, 200);
    triangle(
      bx - 5, by - 7,
      bx - 5, by + 7,
      bx + 8, by
    );
  } else {
    // Twee pauze-balkjes
    fill(255, 255, 255, 200);
    rect(bx - 6, by - 7, 4, 14);
    rect(bx + 2, by - 7, 4, 14);
  }
}

// ── INTERACTIE ────────────────────────────────
function mousePressed() {
  let bx = 30, by = height - 30, br = 18;

  if (!audioStarted) {
    if (dist(mouseX, mouseY, bx, by) < br) startAudio();
  } else {
    if (dist(mouseX, mouseY, bx, by) < br) togglePause();
  }
}

function keyPressed() {
  if (key === ' ') {
    if (!audioStarted) startAudio();
    else togglePause();
  }
}

function togglePause() {
  if (!sound) return;
  if (audioPaused) {
    sound.loop();
    audioPaused = false;
  } else {
    sound.pause();
    audioPaused = true;
  }
}

function startAudio() {
  statusMsg = 'Starten...';

  getAudioContext().resume().then(() => {
    if (soundLoaded && sound) {
      sound.loop();
      fft.setInput(sound);
      audioStarted = true;
      statusMsg = '';
      console.log('Audio speelt via bestand.');
    } else {
      // Fallback: microfoon
      console.log('Geen audiobestand — schakel over naar microfoon.');
      statusMsg = 'Microfoon actief';
      let mic = new p5.AudioIn();
      mic.start(() => {
        fft.setInput(mic);
        audioStarted = true;
        statusMsg = '';
      });
    }
  });
}

// ── VENSTERGROOTTE ────────────────────────────
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ─────────────────────────────────────────────
//  UITBREIDINGSPUNTEN (later toe te voegen):
//
//  • Meerdere visuele reacties per frequentieband
//    → voeg extra logica toe in analyzeAndTrigger()
//
//  • Kortstondige flash of glitch bij trigger
//    → voeg effect toe in switchToNextImage()
//
//  • Beat detection (i.p.v. drempelwaarde)
//    → vervang energy-check door p5.Amplitude + piekdetectie
//
//  • Tweede laag met particles of vormen op het ritme
//    → voeg apart drawReactiveLayer() toe in draw()
// ─────────────────────────────────────────────
