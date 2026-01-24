/**
 * ZZFX - Zuper Zmall Zound Zynth
 * Micro-synthesizer for lightweight sound effects.
 * Based on ZzFX by Frank Force.
 */

// Internal ZzFX state
let audioCtx: AudioContext | null = null;

/**
 * The core ZzFX sound generator.
 * This is a highly compressed version of the ZzFX library.
 */
function zzfxP(...t: any[]) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const { sampleRate } = audioCtx;
    const [
        volume = 1,
        randomness = 0.05,
        frequency = 220,
        attack = 0,
        sustain = 0,
        release = 0.1,
        shape = 0,
        shapeCurve = 1,
        slide = 0,
        deltaSlide = 0,
        pitchJump = 0,
        pitchJumpTime = 0,
        repeatTime = 0,
        noise = 0,
        modulation = 0,
        bitCrush = 0,
        delay = 0,
        sustainVolume = 1,
        decay = 0,
        tremolo = 0
    ] = t;

    const b = sampleRate * volume;
    const c = Math.PI * 2;
    const d = b * (attack + sustain + decay + release);
    const e = sampleRate * attack;
    const f = sampleRate * decay;
    const g = sampleRate * sustain;
    const h = sampleRate * release;
    const j = b * sustainVolume;
    const k = sampleRate * repeatTime;
    const m = (Math.PI * 2 * frequency) / sampleRate;
    const n = modulation ? (Math.PI * 2 * modulation) / sampleRate : 0;
    const p = Math.PI * 2 * randomness;
    const q = (Math.PI * 2 * deltaSlide) / (sampleRate ** 2);
    const r = (Math.PI * 2 * slide) / sampleRate;
    const s = pitchJump ? Math.PI * 2 * pitchJump : 0;
    const v = sampleRate * pitchJumpTime;

    const samples = new Float32Array(d);
    let x = 0;
    let y = 0;
    let z = 0;
    let A = 0;
    let B = 0;

    for (let i = 0; i < d; ++i) {
        if (k && i % k === 0) {
            x = 0;
            y = 0;
            z = 0;
            A = 0;
            B = 0;
        }

        const env = i < e ? i / e :
            i < e + f ? 1 - ((i - e) / f) * (1 - sustainVolume) :
                i < e + f + g ? sustainVolume :
                    i < d ? (1 - (i - e - f - g) / h) * sustainVolume : 0;

        const mod = modulation ? Math.sin(n * i) * env : 0;
        const jump = (v && i > v) ? s : 0;

        z += m + mod + jump + r + q * i;
        y += Math.sin(z + B);
        B += (Math.random() - 0.5) * p;

        let sample = 0;
        if (shape === 0) sample = Math.sin(z + B); // sine
        else if (shape === 1) sample = Math.sign(Math.sin(z + B)); // square
        else if (shape === 2) sample = (z + B) % c / c - 0.5; // saw
        else if (shape === 3) sample = Math.random() - 0.5; // noise

        sample *= env;
        if (tremolo) sample *= 1 - tremolo + tremolo * Math.sin(tremolo * i * (c / sampleRate));

        if (bitCrush) {
            const bc = 10 ** bitCrush;
            sample = Math.round(sample * bc) / bc;
        }

        samples[i] = sample;
    }

    const buffer = audioCtx.createBuffer(1, d, sampleRate);
    buffer.getChannelData(0).set(samples);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
    return source;
}

// Sound definitions (ZzFX parameters)
export const SOUNDS = {
    // Card flip / play sound
    PLAY_CARD: [1.5, , 244, , .01, .15, 1, 1.81, , , , , , , , , , .71, .02],
    // Drawing a card
    DRAW_CARD: [1.2, , 664, .01, .01, .11, 1, 2.7, , , , , , , , , .07, .59, .03],
    // Your turn notification (cheerful ping)
    YOUR_TURN: [1, , 539, , .11, .19, 1, .41, 7, , , , , .1, , , , .74, .06],
    // "TRES!" call
    TRES_CALL: [1.5, , 138, .01, .18, .36, 1, .71, , , 53, .07, .01, , , , , .61, .11],
    // Success / Challenge success
    SUCCESS: [1, , 442, .01, .2, .2, 1, .4, , , 558, .05, , , , , , .7],
    // Error / Challenge failure
    ERROR: [1.5, , 101, , , .53, , 1.96, , , , , , 1, , , .14, .7, .17],
    // Game start
    GAME_START: [1, , 205, .05, .31, .35, 1, 1.62, , , 100, .08, , , , , , .65, .08],
    // Game over / Win
    GAME_OVER: [1, , 925, .04, .3, .6, 1, .3, , , 1, .1, , , , , , .7, .08],
    // Player joined
    PLAYER_JOIN: [0.8, , 300, .05, .1, .2, 1, 2, , , 400, .05, , , , , , .6],
};

let isMuted = false;

export function setMuted(mute: boolean) {
    isMuted = mute;
    if (typeof window !== 'undefined') {
        localStorage.setItem('tres_muted', mute ? 'true' : 'false');
    }
}

export function getMuted(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('tres_muted') === 'true';
}

export function playSound(params: any[]) {
    if (isMuted || typeof window === 'undefined') return;

    try {
        // Ensure AudioContext is resumed (browser policy)
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        zzfxP(...params);
    } catch (e) {
        console.error('Failed to play sound', e);
    }
}

// Initialize mute state from localStorage
if (typeof window !== 'undefined') {
    isMuted = getMuted();
}
