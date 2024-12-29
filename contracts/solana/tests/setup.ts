import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

import { IntentPda, intentProgram, wallet, connection } from "../scripts/setup";
import { SwapOrder } from "../scripts/types";

export class TestContext {
  srcNID: string;
  dstNID: string;
  admin: Keypair;
  mintKey: PublicKey;
  orderAccountRent: number;
  vaultNativeAccountRent: number;
  orderFinishedAccountRent: number;

  constructor(srcNID: string, dstNID: string) {
    this.srcNID = srcNID;
    this.dstNID = dstNID;
    this.admin = wallet.payer;

    this.setup()
      .then(() => {})
      .catch(() => console.log("setup error"));
  }

  async setup() {
    this.orderAccountRent = await connection.getMinimumBalanceForRentExemption(
      409
    );
    this.vaultNativeAccountRent =
      await connection.getMinimumBalanceForRentExemption(9);
    this.orderFinishedAccountRent =
      await connection.getMinimumBalanceForRentExemption(10);
  }

  async createMint() {
    const mintKey = await createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      wallet.publicKey,
      9
    );

    this.mintKey = mintKey;
    return mintKey;
  }

  async mintToken(toAddress: PublicKey, amount: number) {
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      this.mintKey,
      toAddress
    );
    await mintTo(
      connection,
      wallet.payer,
      this.mintKey,
      tokenAccount.address,
      wallet.publicKey,
      amount * LAMPORTS_PER_SOL
    );
    return tokenAccount;
  }

  async getConfig() {
    return await intentProgram.account.config.fetch(IntentPda.config().pda);
  }

  async getVaultAccount() {
    return await intentProgram.account.vaultNative.getAccountInfo(
      IntentPda.vaultNative().pda
    );
  }

  async getOrderFinishedAccount(swapOrder: SwapOrder) {
    return await intentProgram.account.orderFinished.fetch(
      IntentPda.orderFinished(swapOrder).pda
    );
  }

  async getVaultTokenAccount() {
    return await getAccount(connection, IntentPda.vaultToken(this.mintKey).pda);
  }

  calculateSwapFee(protocolFee: number, amount: number) {
    return (amount * protocolFee) / 10_000;
  }
}
