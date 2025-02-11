import fs from "fs";
import { createHash } from "crypto";
import createKeccakHash from "keccak";
import { Keypair, PublicKey } from "@solana/web3.js";

export function loadKeypairFromFile(path: string): Keypair {
  return Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(path, "utf-8")))
  );
}

export const sleep = (seconds: number) => {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

export const hash = (message: Uint8Array) => {
  return createHash("").update(message).digest("hex");
};

export const keccakHash = (message: Uint8Array) => {
  return createKeccakHash("keccak256").update(message).digest("hex");
};

export const uint128ToArray = (num: any) => {
  if (typeof num === "string" || typeof num === "number") {
    num = BigInt(num);
  } else if (!(num instanceof BigInt)) {
    throw new Error("Input must be a BigInt or convertible to a BigInt.");
  }

  let buffer = new ArrayBuffer(16);
  let view = new DataView(buffer);

  view.setBigUint64(0, num >> BigInt(64), false);
  view.setBigUint64(8, num & BigInt("0xFFFFFFFFFFFFFFFF"), false);

  return new Uint8Array(buffer);
};

export const SYSVAR_INSTRUCTIONS_ID = new PublicKey(
  "Sysvar1nstructions1111111111111111111111111"
);
