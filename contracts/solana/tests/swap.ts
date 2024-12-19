import * as anchor from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { TxnHelpers } from "../scripts/utils/transaction";
import {
  IntentPda,
  intentProgram,
  wallet,
  connection,
  getSwapIx,
} from "../scripts/setup";
import { SwapOrder } from "../scripts/types";
import { sleep } from "../scripts/utils";
import { TestContext } from "./setup";

describe("Swap", async () => {
  let srcNid = "solana";
  let dstNid = "icon";
  let mintKey: PublicKey;

  const ctx = new TestContext(srcNid, dstNid);
  const txnHelpers = new TxnHelpers(connection, wallet.payer);

  before(async () => {
    mintKey = await ctx.createMint();
  });

  it("swap token", async () => {
    let signer = Keypair.generate();
    await txnHelpers.airdrop(signer.publicKey, LAMPORTS_PER_SOL * 10);

    const destination = Keypair.generate();
    let signerTokenBalance = 1000000000 * 100;
    let amount = new anchor.BN(1000000000);
    let toAmount = new anchor.BN(1000000000);
    const configBefore = await ctx.getConfig();

    const signerTokenAccount = await ctx.mintToken(signer.publicKey, 100);

    let swap = {
      id: new anchor.BN(1),
      emitter: intentProgram.programId.toString(),
      srcNid,
      dstNid,
      creator: signer.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: mintKey.toString(),
      amount,
      toToken: mintKey.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };

    let swapIx = await getSwapIx(swap);
    let swapTx = await txnHelpers.buildV0Txn([swapIx], [signer]);
    await connection.sendTransaction(swapTx);
    await sleep(2);

    // check signer token balance
    let expectedBalance = signerTokenBalance - amount.toNumber();
    let signerAccount = await getAccount(
      connection,
      signerTokenAccount.address
    );
    assert.equal(signerAccount.amount.toString(), expectedBalance.toString());

    // check vault token balance
    const vaultTokenAccount = await ctx.getVaultTokenAccount();
    assert.equal(vaultTokenAccount.amount.toString(), amount.toString());

    // deposit id should be increased
    let config = await ctx.getConfig();
    assert.equal(
      config.depositId.toNumber(),
      configBefore.depositId.toNumber() + 1
    );
  });

  it("swap native token", async () => {
    let signer = Keypair.generate();
    await txnHelpers.airdrop(signer.publicKey, LAMPORTS_PER_SOL * 10);

    const destination = Keypair.generate();
    let signerPrevBalance = LAMPORTS_PER_SOL * 10;
    let amount = new anchor.BN(8000000000);
    let toAmount = new anchor.BN(1000000000);
    const configBefore = await ctx.getConfig();
    const vaultAccountBefore = await ctx.getVaultAccount();
    const vaultBalanceBefore =
      vaultAccountBefore.lamports - ctx.vaultNativeAccountRent;

    let swap = {
      id: new anchor.BN(1),
      emitter: intentProgram.programId.toString(),
      srcNid,
      dstNid,
      creator: signer.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: SYSTEM_PROGRAM_ID.toString(),
      amount,
      toToken: mintKey.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };

    let swapIx = await getSwapIx(swap);
    let swapTx = await txnHelpers.buildV0Txn([swapIx], [signer]);
    await connection.sendTransaction(swapTx);
    await sleep(2);

    // check signer SOL balance
    let expectedBalance =
      signerPrevBalance - (amount.toNumber() + ctx.orderAccountRent + 5000);
    let signerBalance = await connection.getBalance(signer.publicKey);
    assert.equal(signerBalance.toString(), expectedBalance.toString());

    // check vault SOL balance
    const vaultNative = await ctx.getVaultAccount();
    assert.equal(
      vaultNative.lamports.toString(),
      (
        amount.toNumber() +
        ctx.vaultNativeAccountRent +
        vaultBalanceBefore
      ).toString()
    );

    // deposit id should be increased
    let config = await ctx.getConfig();
    assert.equal(
      config.depositId.toNumber(),
      configBefore.depositId.toNumber() + 1
    );
  });

  it("should fail when source network id is invalid", async () => {
    let signer = Keypair.generate();
    await txnHelpers.airdrop(signer.publicKey, LAMPORTS_PER_SOL * 10);

    const destination = Keypair.generate();
    let amount = new anchor.BN(1000000000);
    let toAmount = new anchor.BN(1000000000);

    let swap = {
      id: new anchor.BN(1),
      emitter: intentProgram.programId.toString(),
      srcNid: "invalid",
      dstNid,
      creator: signer.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: SYSTEM_PROGRAM_ID.toString(),
      amount,
      toToken: mintKey.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };

    let swapIx = await getSwapIx(swap);
    let swapTx = await txnHelpers.buildV0Txn([swapIx], [signer]);
    try {
      await connection.sendTransaction(swapTx);
    } catch (err) {
      expect(err.message).to.includes("Network ID is misconfigured");
    }
  });

  it("should fail when creator address doesn't match with signer", async () => {
    let signer = Keypair.generate();
    await txnHelpers.airdrop(signer.publicKey, LAMPORTS_PER_SOL * 10);

    const destination = Keypair.generate();
    let amount = new anchor.BN(1000000000);
    let toAmount = new anchor.BN(1000000000);

    let swap = {
      id: new anchor.BN(1),
      emitter: intentProgram.programId.toString(),
      srcNid,
      dstNid,
      creator: wallet.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: SYSTEM_PROGRAM_ID.toString(),
      amount,
      toToken: mintKey.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };
    let swapOrder = SwapOrder.from(swap);

    let swapIx = await intentProgram.methods
      .swap(swap)
      .accountsStrict({
        systemProgram: SYSTEM_PROGRAM_ID,
        signer: signer.publicKey,
        config: IntentPda.config().pda,
        orderAccount: IntentPda.order(
          signer.publicKey,
          swapOrder.dstNID,
          amount.toNumber(),
          toAmount.toNumber()
        ).pda,
        vaultNativeAccount: IntentPda.vaultNative().pda,
        vaultTokenAccount: null,
        signerTokenAccount: null,
        mint: null,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([signer])
      .instruction();

    let swapTx = await txnHelpers.buildV0Txn([swapIx], [signer]);
    try {
      await connection.sendTransaction(swapTx);
    } catch (err) {
      expect(err.message).to.includes("Signer must be a swap creator");
    }
  });

  it("should fail when emitter address doesn't match with program ID", async () => {
    let signer = Keypair.generate();
    await txnHelpers.airdrop(signer.publicKey, LAMPORTS_PER_SOL * 10);

    const randomEmitter = Keypair.generate();
    const destination = Keypair.generate();
    let amount = new anchor.BN(1000000000);
    let toAmount = new anchor.BN(1000000000);

    let swap = {
      id: new anchor.BN(1),
      emitter: randomEmitter.publicKey.toString(),
      srcNid,
      dstNid,
      creator: signer.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: SYSTEM_PROGRAM_ID.toString(),
      amount,
      toToken: mintKey.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };

    let swapIx = await getSwapIx(swap);
    let swapTx = await txnHelpers.buildV0Txn([swapIx], [signer]);
    try {
      await connection.sendTransaction(swapTx);
    } catch (err) {
      expect(err.message).to.includes("Emitter program ID is not valid");
    }
  });

  it("should fail when different mint account is passed than the specified one in SwapOrder", async () => {
    let signer = Keypair.generate();
    await txnHelpers.airdrop(signer.publicKey, LAMPORTS_PER_SOL * 10);

    const destination = Keypair.generate();
    let signerTokenBalance = 1000000000 * 100;
    let amount = new anchor.BN(1000000000);
    let toAmount = new anchor.BN(1000000000);

    await ctx.mintToken(signer.publicKey, signerTokenBalance);

    let swap = {
      id: new anchor.BN(1),
      emitter: intentProgram.programId.toString(),
      srcNid,
      dstNid,
      creator: signer.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: mintKey.toString(),
      amount,
      toToken: mintKey.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };

    let swapIx = await getSwapIx(swap);
    let swapTx = await txnHelpers.buildV0Txn([swapIx], [signer]);
    try {
      await connection.sendTransaction(swapTx);
    } catch (err) {
      expect(err.message).to.includes("A token mint constraint was violated");
    }
  });
});
