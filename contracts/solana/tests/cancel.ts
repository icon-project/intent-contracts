import * as anchor from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

import { TxnHelpers } from "../scripts/utils/transaction";
import {
  IntentPda,
  intentProgram,
  wallet,
  connection,
  getSwapIx,
  getCancelIx,
} from "../scripts/setup";
import { SwapOrder } from "../scripts/types";
import { sleep } from "../scripts/utils";
import { TestContext } from "./setup";

describe("Cancel", async () => {
  let srcNid = "solana";
  let dstNid = "icon";

  const ctx = new TestContext(srcNid, dstNid);
  const txnHelpers = new TxnHelpers(connection, wallet.payer);

  it("should cancel the order", async () => {
    let creator = Keypair.generate();
    await txnHelpers.airdrop(creator.publicKey, LAMPORTS_PER_SOL * 10);

    let destination = Keypair.generate();
    let amount = new anchor.BN(1000000000);
    let toAmount = new anchor.BN(1000000000);

    let swap = {
      id: new anchor.BN(1),
      emitter: intentProgram.programId.toString(),
      srcNid,
      dstNid,
      creator: creator.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: SYSTEM_PROGRAM_ID.toString(),
      amount,
      toToken: SYSTEM_PROGRAM_ID.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };

    const swapIx = await getSwapIx(swap);
    const swapTx = await txnHelpers.buildV0Txn([swapIx], [creator]);
    await connection.sendTransaction(swapTx);
    await sleep(2);

    const config = await ctx.getConfig();
    swap.id = config.depositId;

    const cancelIx = await getCancelIx(swap);
    const cancelTx = await txnHelpers.buildV0Txn([cancelIx], [creator]);
    await connection.sendTransaction(cancelTx);
    await sleep(2);

    // conn_sn should be increased by one
    const afterConfig = await ctx.getConfig();
    assert.equal(afterConfig.connSn.toNumber(), config.connSn.toNumber() + 1);
  });

  it("should cancel the order and resolve", async () => {
    let creator = Keypair.generate();
    await txnHelpers.airdrop(creator.publicKey, LAMPORTS_PER_SOL * 10);

    let destination = Keypair.generate();
    let amount = new anchor.BN(1000000000);
    let toAmount = new anchor.BN(1000000000);

    let swap = {
      id: new anchor.BN(1),
      emitter: intentProgram.programId.toString(),
      srcNid,
      dstNid: srcNid,
      creator: creator.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: SYSTEM_PROGRAM_ID.toString(),
      amount,
      toToken: SYSTEM_PROGRAM_ID.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };

    const swapIx = await getSwapIx(swap);
    const swapTx = await txnHelpers.buildV0Txn([swapIx], [creator]);
    await connection.sendTransaction(swapTx);
    await sleep(2);

    const config = await ctx.getConfig();
    swap.id = config.depositId;
    const swapOrder = SwapOrder.from(swap);

    const cancelIx = await getCancelIx(swap);
    const cancelTx = await txnHelpers.buildV0Txn([cancelIx], [creator]);
    await connection.sendTransaction(cancelTx);
    await sleep(2);

    // order finished account should be created
    const orderFinished = await ctx.getOrderFinishedAccount(swapOrder);
    assert.equal(orderFinished.finished, true);

    // conn_sn should be increased by one
    const afterConfig = await ctx.getConfig();
    assert.equal(afterConfig.connSn.toNumber(), config.connSn.toNumber() + 1);
  });

  it("should fail if the creator is not signer", async () => {
    let creator = Keypair.generate();
    await txnHelpers.airdrop(creator.publicKey, LAMPORTS_PER_SOL * 10);

    let destination = Keypair.generate();
    let amount = new anchor.BN(1000000000);
    let toAmount = new anchor.BN(1000000000);

    let swap = {
      id: new anchor.BN(1),
      emitter: intentProgram.programId.toString(),
      srcNid,
      dstNid,
      creator: creator.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: SYSTEM_PROGRAM_ID.toString(),
      amount,
      toToken: SYSTEM_PROGRAM_ID.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };

    const swapIx = await getSwapIx(swap);
    const swapTx = await txnHelpers.buildV0Txn([swapIx], [creator]);
    await connection.sendTransaction(swapTx);
    await sleep(2);

    const config = await ctx.getConfig();
    swap.id = config.depositId;
    const swapOrder = SwapOrder.from(swap);

    let anotherSigner = Keypair.generate();
    await txnHelpers.airdrop(anotherSigner.publicKey, LAMPORTS_PER_SOL * 10);

    const cancelIx = await intentProgram.methods
      .cancel(swap)
      .accountsStrict({
        systemProgram: SYSTEM_PROGRAM_ID,
        signer: anotherSigner.publicKey,
        config: IntentPda.config().pda,
        orderAccount: IntentPda.order(
          creator.publicKey,
          swapOrder.dstNID,
          swapOrder.amount,
          swapOrder.toAmount
        ).pda,
        orderFinished: IntentPda.orderFinished(swapOrder).pda,
      })
      .instruction();
    const cancelTx = await txnHelpers.buildV0Txn([cancelIx], [anotherSigner]);
    try {
      await connection.sendTransaction(cancelTx);
    } catch (err) {
      expect(err.message).to.includes("Signer must be a swap creator");
    }
  });
});
