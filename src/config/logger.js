const levels = ["debug", "info", "warn", "error"];

function levelEnabled(current, target) {
  return levels.indexOf(target) >= levels.indexOf(current);
}

export function createLogger({ level = "info" } = {}) {
  return {
    debug: (...args) => levelEnabled(level, "debug") && console.log("[debug]", ...args),
    info: (...args) => levelEnabled(level, "info") && console.log("[info]", ...args),
    warn: (...args) => levelEnabled(level, "warn") && console.warn("[warn]", ...args),
    error: (...args) => levelEnabled(level, "error") && console.error("[error]", ...args),
  };
}

