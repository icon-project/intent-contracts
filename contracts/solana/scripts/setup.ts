import * as anchor from "@coral-xyz/anchor";
import os from "os";
import { PublicKey, Connection } from "@solana/web3.js";

import { keccakHash, loadKeypairFromFile, uint128ToArray } from "./utils";
import { Intent } from "../target/types/intent";
import intentIdl from "../target/idl/intent.json";
import { SwapOrder } from "./types";

/** RPC PROVIDER */
export const RPC_URL = "http://127.0.0.1:8899";
export const connection = new Connection(RPC_URL, "confirmed");

/** WALLET KEYPAIR */
let keypairFilePath = os.homedir + "/.config/solana/id.json";
export const keypair = loadKeypairFromFile(keypairFilePath);
export const wallet = new anchor.Wallet(keypair);

/** PROVIDER FOR CLIENT */
export const provider = new anchor.AnchorProvider(connection, wallet);
anchor.setProvider(provider);

export const intentProgram: anchor.Program<Intent> = new anchor.Program(
  intentIdl as anchor.Idl,
  provider
) as unknown as anchor.Program<Intent>;

export class IntentPda {
  constructor() {}

  static config() {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      intentProgram.programId
    );

    return { bump, pda };
  }

  static order(
    creator: PublicKey,
    dstNID: string,
    amount: number,
    toAmount: number
  ) {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [
        creator.toBuffer(),
        Buffer.from(dstNID),
        uint128ToArray(amount),
        uint128ToArray(toAmount),
      ],
      intentProgram.programId
    );

    return { bump, pda };
  }

  static vaultToken(mint: PublicKey) {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_token"), mint.toBuffer()],
      intentProgram.programId
    );

    return { bump, pda };
  }

  static vaultNative() {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_native")],
      intentProgram.programId
    );

    return { bump, pda };
  }

  static orderFinished(order: SwapOrder) {
    let encoded = order.encode();
    let hash = keccakHash(Buffer.from(encoded));

    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from(hash, "hex")],
      intentProgram.programId
    );

    return { pda, bump };
  }

  static receipt(srcNID: string, connSn: number) {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), Buffer.from(srcNID), uint128ToArray(connSn)],
      intentProgram.programId
    );

    return { bump, pda };
  }
}

export const getSwapAccounts = async (order: any) => {
  return await intentProgram.methods
    .querySwapAccounts(order, 1, 30)
    .accountsStrict({
      config: IntentPda.config().pda,
    })
    .view({ commitment: "confirmed" });
};

export const getFillAccounts = async (
  order: any,
  signer: PublicKey,
  solverAddress: string
) => {
  return await intentProgram.methods
    .queryFillAccounts(order, signer, solverAddress, 1, 30)
    .accountsStrict({
      config: IntentPda.config().pda,
    })
    .view({ commitment: "confirmed" });
};

export const getCancelAccounts = async (order: any) => {
  return await intentProgram.methods
    .queryCancelAccounts(order, 1, 30)
    .accountsStrict({
      config: IntentPda.config().pda,
    })
    .view({ commitment: "confirmed" });
};

export const getRecvMessageAccounts = async (
  srcNetwork: string,
  connSn: number,
  msg: Buffer
) => {
  return await intentProgram.methods
    .queryRecvMessageAccounts(srcNetwork, new anchor.BN(connSn), msg, 1, 30)
    .accountsStrict({
      config: IntentPda.config().pda,
    })
    .view({ commitment: "confirmed" });
};

export const getSwapIx = async (swap: any) => {
  const accounts = (await getSwapAccounts(swap)).accounts;

  return await intentProgram.methods
    .swap(swap)
    .accountsStrict({
      signer: new PublicKey(swap.creator),
      systemProgram: accounts[0].pubkey,
      config: accounts[1].pubkey,
      orderAccount: accounts[2].pubkey,
      nativeVaultAccount: accounts[3].pubkey,
      tokenVaultAccount: accounts[4].pubkey,
      signerTokenAccount: accounts[5].pubkey,
      mint: accounts[6].pubkey,
      tokenProgram: accounts[7].pubkey,
    })
    .instruction();
};

export const getFillIx = async (
  swap: any,
  solverKey: PublicKey,
  solverAddress: string
) => {
  const accounts = (await getFillAccounts(swap, solverKey, solverAddress))
    .accounts;

  return await intentProgram.methods
    .fill(swap, solverAddress.toString())
    .accountsStrict({
      signer: solverKey,
      systemProgram: accounts[0].pubkey,
      config: accounts[1].pubkey,
      feeHandler: accounts[2].pubkey,
      destinationAddress: accounts[3].pubkey,
      orderFinished: accounts[4].pubkey,
      feeHandlerTokenAccount: accounts[5].pubkey,
      destinationTokenAccount: accounts[6].pubkey,
      signerTokenAccount: accounts[7].pubkey,
      mint: accounts[8].pubkey,
      tokenProgram: accounts[9].pubkey,
      associatedTokenProgram: accounts[10].pubkey,
    })
    .remainingAccounts(accounts.slice(11))
    .instruction();
};

export const getCancelIx = async (swap: any) => {
  const accounts = (await getCancelAccounts(swap)).accounts;

  return await intentProgram.methods
    .cancel(swap)
    .accountsStrict({
      signer: new PublicKey(swap.creator),
      systemProgram: accounts[0].pubkey,
      config: accounts[1].pubkey,
      orderAccount: accounts[2].pubkey,
      orderFinished: accounts[3].pubkey,
    })
    .instruction();
};

export const getRecvMessageIx = async (
  srcNetwork: string,
  connSn: number,
  message: Buffer,
  signer: PublicKey
) => {
  const accounts = (await getRecvMessageAccounts(srcNetwork, connSn, message))
    .accounts;

  return await intentProgram.methods
    .recvMessage(srcNetwork, new anchor.BN(connSn), message)
    .accountsStrict({
      signer: signer,
      systemProgram: accounts[0].pubkey,
      config: accounts[1].pubkey,
      receipt: accounts[2].pubkey,
    })
    .remainingAccounts(accounts.slice(3))
    .instruction();
};
