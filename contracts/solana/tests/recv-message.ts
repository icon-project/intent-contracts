import * as anchor from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

import { TxnHelpers } from "../scripts/utils/transaction";
import {
  intentProgram,
  wallet,
  connection,
  getSwapIx,
  getRecvMessageIx,
} from "../scripts/setup";
import {
  MessageType,
  OrderCancel,
  OrderFill,
  OrderMessage,
  SwapOrder,
} from "../scripts/types";
import { sleep } from "../scripts/utils";
import { TestContext } from "./setup";

describe("Receive Message", async () => {
  let srcNid = "solana";
  let dstNid = "icon";

  const ctx = new TestContext(srcNid, dstNid);
  const txnHelpers = new TxnHelpers(connection, wallet.payer);

  it("should receive and resolve cancel", async () => {
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

    const cancelMessage = new OrderCancel(swapOrder.encode());
    const orderMessage = new OrderMessage(
      MessageType.CANCEL,
      cancelMessage.encode()
    );

    const connSn = 1;
    const recvMessageIx = await getRecvMessageIx(
      srcNid,
      connSn,
      swapOrder,
      Buffer.from(orderMessage.encode()),
      MessageType.CANCEL,
      ctx.admin.publicKey,
      ""
    );
    const recvMessageTx = await txnHelpers.buildV0Txn(
      [recvMessageIx],
      [ctx.admin]
    );
    await connection.sendTransaction(recvMessageTx);
    await sleep(2);

    const configAfter = await ctx.getConfig();
    assert.equal(configAfter.connSn.toNumber(), config.connSn.toNumber() + 1);
  });

  it("should fail for duplicate message", async () => {
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
    const swapOrder = SwapOrder.from(swap);

    const cancelMessage = new OrderCancel(swapOrder.encode());
    const orderMessage = new OrderMessage(
      MessageType.CANCEL,
      cancelMessage.encode()
    );

    const connSn = 1;
    const recvMessageIx = await getRecvMessageIx(
      srcNid,
      connSn,
      swapOrder,
      Buffer.from(orderMessage.encode()),
      MessageType.CANCEL,
      ctx.admin.publicKey,
      ""
    );
    const recvMessageTx = await txnHelpers.buildV0Txn(
      [recvMessageIx],
      [ctx.admin]
    );
    try {
      await connection.sendTransaction(recvMessageTx);
    } catch (err) {
      expect(err.message).to.includes("Duplicate message");
    }
  });

  it("should fail when signer is not an admin", async () => {
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
    const swapOrder = SwapOrder.from(swap);

    const cancelMessage = new OrderCancel(swapOrder.encode());
    const orderMessage = new OrderMessage(
      MessageType.CANCEL,
      cancelMessage.encode()
    );

    const connSn = 1;
    const recvMessageIx = await getRecvMessageIx(
      srcNid,
      connSn,
      swapOrder,
      Buffer.from(orderMessage.encode()),
      MessageType.CANCEL,
      creator.publicKey,
      ""
    );
    const recvMessageTx = await txnHelpers.buildV0Txn(
      [recvMessageIx],
      [creator]
    );
    try {
      await connection.sendTransaction(recvMessageTx);
    } catch (err) {
      expect(err.message).to.includes("Only Relayer");
    }
  });

  it("should receive and resolve fill", async () => {
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
    const vaultBalanceBeforeResolve = (await ctx.getVaultAccount()).lamports;

    const fillMessage = new OrderFill(
      swapOrder.id,
      swapOrder.encode(),
      creator.publicKey.toString()
    );
    const orderMessage = new OrderMessage(
      MessageType.FILL,
      fillMessage.encode()
    );

    const connSn = 2;
    const recvMessageIx = await getRecvMessageIx(
      dstNid,
      connSn,
      swapOrder,
      Buffer.from(orderMessage.encode()),
      MessageType.FILL,
      ctx.admin.publicKey,
      creator.publicKey.toString()
    );
    const recvMessageTx = await txnHelpers.buildV0Txn(
      [recvMessageIx],
      [ctx.admin]
    );
    await connection.sendTransaction(recvMessageTx);
    await sleep(2);

    const vaultBalanceAfterResolve = (await ctx.getVaultAccount()).lamports;
    assert.equal(
      vaultBalanceAfterResolve,
      vaultBalanceBeforeResolve - swapOrder.amount
    );
  });
});
