/**
 * EduNex Interesting Random Nickname Generator
 * Generates creative, unique, tech, cyber, and cosmic nicknames for students.
 */

export const CURATED_NICKNAMES = [
  "QuantumVelo",
  "NeuralNinja",
  "ByteVoyager",
  "MatrixRider",
  "CyberKnight",
  "VectorSpark",
  "CodeMaverick",
  "DataPhantom",
  "AlgoRhythm",
  "GlitchHunter",
  "AstroVelu",
  "SonicDev",
  "HyperPulse",
  "ZeroGravity",
  "PixelWizard",
  "NeonBlaze",
  "CipherMind",
  "CloudTitan",
  "TurboTensor",
  "CosmicForge",
  "PhantomCore",
  "ApexHacker",
  "DeltaVolt",
  "FlashByte",
  "EchoPulse",
  "SkylineDev",
  "CodeSamurai",
  "VortexVelu",
  "ShadowByte",
  "ZenithMind",
  "StarlightCoder",
  "NovaSpark",
  "PrismCoder",
  "TitanLogic",
  "KryptonDev",
  "BlazeRunner",
  "SynthWave",
  "CircuitBreaker",
  "AlphaByte",
  "NexusMind",
  "SolarFlare",
  "ByteBandit",
  "LogicWizard",
  "InfiniteLoop",
  "SiliconSage",
  "KernelMaster",
];

const ADJECTIVES = [
  "Quantum", "Hyper", "Cyber", "Neural", "Cosmic", "Turbo", "Astro",
  "Sonic", "Phantom", "Neon", "Delta", "Apex", "Shadow", "Vector",
  "Glitch", "Echo", "Prism", "Solar", "Alpha", "Zenith", "Infinite",
  "Vortex", "Titan", "Krypton", "Blaze", "Starlight", "Nexus",
];

const NOUNS = [
  "Ninja", "Voyager", "Rider", "Knight", "Spark", "Maverick", "Phantom",
  "Rhythm", "Hunter", "Wizard", "Blaze", "Mind", "Titan", "Tensor",
  "Forge", "Core", "Hacker", "Volt", "Byte", "Pulse", "Dev",
  "Samurai", "Wave", "Sage", "Master", "Breaker", "Loop", "Bandit",
];

/**
 * Returns a random interesting nickname from the curated list or dynamic generator.
 * @param {string} [excludeCurrent] - Nickname to avoid picking if shuffling
 * @returns {string} An interesting nickname
 */
export function getRandomInterestingNickname(excludeCurrent = "") {
  const pool = CURATED_NICKNAMES.filter((n) => n !== excludeCurrent);
  if (pool.length > 0 && Math.random() < 0.75) {
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
  }
  // Generate dynamically: Adjective + Noun
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const combo = `${adj}${noun}`;
  return combo !== excludeCurrent ? combo : CURATED_NICKNAMES[0];
}

/**
 * Generates a stable deterministic interesting nickname based on user seed (roll number or id).
 * @param {string} seed - e.g. "25ACSE001" or "velu"
 * @returns {string}
 */
export function getDeterministicNickname(seed = "velu") {
  if (!seed) return CURATED_NICKNAMES[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % CURATED_NICKNAMES.length;
  return CURATED_NICKNAMES[idx];
}
