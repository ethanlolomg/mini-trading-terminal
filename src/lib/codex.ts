import { Codex } from "@codex-data/sdk";

export const getCodexClient = () => {
  const apiKey = import.meta.env.VITE_CODEX_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_CODEX_API_KEY is not set");
  }
  return new Codex(apiKey);
};
