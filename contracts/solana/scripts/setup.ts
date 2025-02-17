import * as anchor from "@coral-xyz/anchor";
import os from "os";
import { PublicKey, Connection } from "@solana/web3.js";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { keccakHash, loadKeypairFromFile, uint128ToArray } from "./utils";
import { Intent } from "../target/types/intent";
import intentIdl from "../target/idl/intent.json";
import { MessageType, SwapOrder } from "./types";

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

export const getSwapIx = async (swap: any) => {
  const swapOrder = SwapOrder.from(swap);
  const creator = new PublicKey(swapOrder.creator);

  // Required token accounts to swap the order (for SPL token)
  let mint = null;
  let tokenVaultAccount = null;
  let signerTokenAccount = null;
  if (swapOrder.token != SYSTEM_PROGRAM_ID.toString()) {
    mint = new PublicKey(swapOrder.token);
    tokenVaultAccount = IntentPda.vaultToken(mint).pda;
    signerTokenAccount = await getAssociatedTokenAddress(mint, creator);
  }

  return await intentProgram.methods
    .swap(swap)
    .accountsStrict({
      systemProgram: SYSTEM_PROGRAM_ID,
      signer: creator,
      config: IntentPda.config().pda,
      orderAccount: IntentPda.order(
        creator,
        swapOrder.dstNID,
        Number(swapOrder.amount),
        Number(swapOrder.toAmount)
      ).pda,
      nativeVaultAccount: IntentPda.vaultNative().pda,
      tokenVaultAccount,
      signerTokenAccount,
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
};

export const getFillIx = async (
  swap: any,
  solverKey: PublicKey,
  solverAddress: string
) => {
  const swapOrder = SwapOrder.from(swap);
  const destinationAddress = new PublicKey(swapOrder.destinationAddress);

  let configPda = IntentPda.config().pda;
  const config = await intentProgram.account.config.fetch(configPda);

  // Required token accounts to fill the order (for SPL token)
  let mint = null;
  let feeHandlerTokenAddress = null;
  let destinationTokenAddress = null;
  let solverTokenAddress = null;
  if (swapOrder.toToken != SYSTEM_PROGRAM_ID.toString()) {
    mint = new PublicKey(swapOrder.toToken);
    feeHandlerTokenAddress = await getAssociatedTokenAddress(
      mint,
      config.feeHandler
    );
    destinationTokenAddress = await getAssociatedTokenAddress(
      mint,
      destinationAddress
    );
    solverTokenAddress = await getAssociatedTokenAddress(mint, solverKey);
  }

  // if `srcNID` and `dstNID` of order is same then We need to prepare the remaining accounts
  // because the order is resolved in same transaction and have to send the accounts required
  // to resolve the order
  let remainingAccounts = [];
  if (swapOrder.srcNID == swapOrder.dstNID) {
    remainingAccounts = await getResolveFillAccounts(swapOrder, solverAddress);
  }

  return await intentProgram.methods
    .fill(swap, solverAddress.toString())
    .accountsStrict({
      systemProgram: SYSTEM_PROGRAM_ID,
      signer: solverKey,
      config: IntentPda.config().pda,
      feeHandler: config.feeHandler,
      destinationAddress: destinationAddress,
      orderFinished: IntentPda.orderFinished(swapOrder).pda,
      feeHandlerTokenAccount: feeHandlerTokenAddress,
      destinationTokenAccount: destinationTokenAddress,
      signerTokenAccount: solverTokenAddress,
      mint: mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();
};

export const getCancelIx = async (swap: any) => {
  const swapOrder = SwapOrder.from(swap);
  const creatorKey = new PublicKey(swapOrder.creator);

  // Only send order_finished account if the swap is being done in same chain
  let order_finished = null;
  if (swapOrder.srcNID == swapOrder.dstNID) {
    order_finished = IntentPda.orderFinished(swapOrder).pda;
  }

  return await intentProgram.methods
    .cancel(swap)
    .accountsStrict({
      systemProgram: SYSTEM_PROGRAM_ID,
      signer: creatorKey,
      config: IntentPda.config().pda,
      orderAccount: IntentPda.order(
        creatorKey,
        swapOrder.dstNID,
        swapOrder.amount,
        swapOrder.toAmount
      ).pda,
      orderFinished: order_finished,
    })
    .instruction();
};

export const getRecvMessageIx = async (
  srcNetwork: string,
  connSn: number,
  swapOrder: SwapOrder,
  message: Buffer,
  messageType: MessageType,
  signer: PublicKey,
  solverAddress: string
) => {
  let remainingAccounts = [];
  if (messageType == MessageType.FILL) {
    remainingAccounts = await getResolveFillAccounts(swapOrder, solverAddress);
  } else {
    remainingAccounts = [
      {
        pubkey: IntentPda.config().pda,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: IntentPda.orderFinished(swapOrder).pda,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: intentProgram.programId,
        isWritable: true,
        isSigner: false,
      },
    ];
  }

  return await intentProgram.methods
    .recvMessage(srcNetwork, new anchor.BN(connSn), message)
    .accountsStrict({
      systemProgram: SYSTEM_PROGRAM_ID,
      signer: signer,
      config: IntentPda.config().pda,
      receipt: IntentPda.receipt(srcNetwork, connSn).pda,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();
};

export const getResolveFillAccounts = async (
  swapOrder: SwapOrder,
  solverAddress: string
) => {
  const orderCreator = new PublicKey(swapOrder.creator);
  const solverAddressKey = new PublicKey(solverAddress);

  let mint = intentProgram.programId;
  let solverTokenAddress = intentProgram.programId;
  let vaultTokenAddress = intentProgram.programId;

  if (swapOrder.token != SYSTEM_PROGRAM_ID.toString()) {
    mint = new PublicKey(swapOrder.token);
    vaultTokenAddress = IntentPda.vaultToken(mint).pda;
    solverTokenAddress = await getAssociatedTokenAddress(
      mint,
      solverAddressKey
    );
  }

  const remainingAccounts = [
    // Mutable config account
    {
      pubkey: IntentPda.config().pda,
      isWritable: true,
      isSigner: false,
    },
    // Order account
    {
      pubkey: IntentPda.order(
        orderCreator,
        swapOrder.dstNID,
        Number(swapOrder.amount),
        Number(swapOrder.toAmount)
      ).pda,
      isWritable: true,
      isSigner: false,
    },
    // Order creator account
    {
      pubkey: orderCreator,
      isWritable: true,
      isSigner: false,
    },
    // Solver account
    {
      pubkey: solverAddressKey,
      isWritable: true,
      isSigner: false,
    },
    // Solver token account (null for native transfer)
    {
      pubkey: solverTokenAddress,
      isWritable: true,
      isSigner: false,
    },
    // Vault native account
    {
      pubkey: IntentPda.vaultNative().pda,
      isWritable: true,
      isSigner: false,
    },
    // Vault token account (null for native transfer)
    {
      pubkey: vaultTokenAddress,
      isWritable: true,
      isSigner: false,
    },
    // Mint account (null for native transfer)
    {
      pubkey: mint,
      isWritable: true,
      isSigner: false,
    },
    // Token program
    {
      pubkey: TOKEN_PROGRAM_ID,
      isWritable: true,
      isSigner: false,
    },
    // Associated token program ID
    {
      pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
      isWritable: true,
      isSigner: false,
    },
  ];

  return remainingAccounts;
};
