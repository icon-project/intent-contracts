import * as anchor from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert, expect } from "chai";

import { TxnHelpers } from "../scripts/utils/transaction";
import { IntentPda, intentProgram, wallet, connection } from "../scripts/setup";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { sleep } from "../scripts/utils";
import { TestContext } from "./setup";

describe("Initialize", () => {
  let srcNid = "solana";
  let dstNid = "icon";

  const ctx = new TestContext(srcNid, dstNid);
  const txnHelpers = new TxnHelpers(connection, wallet.payer);

  it("should initialize intent program", async () => {
    let feeHandler = Keypair.generate();
    let ix = await intentProgram.methods
      .initialize(srcNid, feeHandler.publicKey)
      .accountsStrict({
        signer: wallet.publicKey,
        systemProgram: SYSTEM_PROGRAM_ID,
        config: IntentPda.config().pda,
        nativeVaultAccount: IntentPda.vaultNative().pda,
      })
      .instruction();

    let tx = await txnHelpers.buildV0Txn([ix], [wallet.payer]);
    await connection.sendTransaction(tx);
    await sleep(2);

    let config = await ctx.getConfig();
    assert.equal(config.networkId, srcNid);
    assert.equal(config.connSn.toNumber(), 0);
    assert.equal(config.depositId.toNumber(), 0);
    assert.equal(config.protocolFee.toNumber(), 0);
    assert.equal(config.feeHandler.toString(), feeHandler.publicKey.toString());
    assert.equal(config.admin.toString(), wallet.publicKey.toString());
  });

  it("should fail when initializing intent program two times", async () => {
    try {
      let feeHandler = Keypair.generate();
      let ix = await intentProgram.methods
        .initialize("solana", feeHandler.publicKey)
        .accountsStrict({
          signer: wallet.publicKey,
          systemProgram: SYSTEM_PROGRAM_ID,
          config: IntentPda.config().pda,
          nativeVaultAccount: IntentPda.vaultNative().pda,
        })
        .instruction();

      let tx = await txnHelpers.buildV0Txn([ix], [wallet.payer]);
      await connection.sendTransaction(tx);
    } catch (err) {
      expect(err.message).to.includes(
        "Error processing Instruction 0: custom program error: 0x0"
      );
    }
  });

  it("should set protocol fee", async () => {
    let protocolFee = 100;
    let ix = await intentProgram.methods
      .setProtocolFee(new anchor.BN(protocolFee))
      .accountsStrict({
        admin: wallet.publicKey,
        config: IntentPda.config().pda,
      })
      .instruction();

    let tx = await txnHelpers.buildV0Txn([ix], [wallet.payer]);
    await connection.sendTransaction(tx);
    await sleep(2);

    let config = await ctx.getConfig();
    assert.equal(config.protocolFee.toNumber(), protocolFee);
  });

  it("should fail to set protocol fee", async () => {
    let protocolFee = 100;
    let newKeypair = Keypair.generate();
    await txnHelpers.airdrop(newKeypair.publicKey, LAMPORTS_PER_SOL);

    try {
      let ix = await intentProgram.methods
        .setProtocolFee(new anchor.BN(protocolFee))
        .accountsStrict({
          admin: newKeypair.publicKey,
          config: IntentPda.config().pda,
        })
        .instruction();

      let tx = await txnHelpers.buildV0Txn([ix], [newKeypair]);
      await connection.sendTransaction(tx);
    } catch (err) {
      expect(err.message).to.includes("Only Admin");
    }
  });

  it("should set fee handler", async () => {
    let newFeeHandler = Keypair.generate();
    let ix = await intentProgram.methods
      .setFeeHandler(newFeeHandler.publicKey)
      .accountsStrict({
        admin: wallet.publicKey,
        config: IntentPda.config().pda,
      })
      .instruction();

    let tx = await txnHelpers.buildV0Txn([ix], [wallet.payer]);
    await connection.sendTransaction(tx);
    await sleep(2);

    let config = await ctx.getConfig();
    assert.equal(
      config.feeHandler.toString(),
      newFeeHandler.publicKey.toString()
    );
  });

  it("should fail to set fee handler", async () => {
    let newFeeHandler = Keypair.generate();
    let newKeypair = Keypair.generate();
    await txnHelpers.airdrop(newKeypair.publicKey, LAMPORTS_PER_SOL);

    try {
      let ix = await intentProgram.methods
        .setFeeHandler(newFeeHandler.publicKey)
        .accountsStrict({
          admin: newKeypair.publicKey,
          config: IntentPda.config().pda,
        })
        .instruction();

      let tx = await txnHelpers.buildV0Txn([ix], [newKeypair]);
      await connection.sendTransaction(tx);
    } catch (err) {
      expect(err.message).to.includes("Only Admin");
    }
  });

  it("should fail to set admin", async () => {
    let newAdmin = Keypair.generate();
    let newKeypair = Keypair.generate();
    await txnHelpers.airdrop(newKeypair.publicKey, LAMPORTS_PER_SOL);

    try {
      let ix = await intentProgram.methods
        .setAdmin(newAdmin.publicKey)
        .accountsStrict({
          admin: newKeypair.publicKey,
          config: IntentPda.config().pda,
        })
        .instruction();

      let tx = await txnHelpers.buildV0Txn([ix], [newKeypair]);
      await connection.sendTransaction(tx);
    } catch (err) {
      expect(err.message).to.includes("Only Admin");
    }
  });

  it("should set admin", async () => {
    let newAdmin = Keypair.generate();
    await txnHelpers.airdrop(newAdmin.publicKey, LAMPORTS_PER_SOL);

    let ix = await intentProgram.methods
      .setAdmin(newAdmin.publicKey)
      .accountsStrict({
        admin: wallet.publicKey,
        config: IntentPda.config().pda,
      })
      .instruction();

    let tx = await txnHelpers.buildV0Txn([ix], [wallet.payer]);
    await connection.sendTransaction(tx);
    await sleep(2);

    let config = await ctx.getConfig();
    assert.equal(config.admin.toString(), newAdmin.publicKey.toString());

    let anotherIx = await intentProgram.methods
      .setAdmin(wallet.publicKey)
      .accountsStrict({
        admin: newAdmin.publicKey,
        config: IntentPda.config().pda,
      })
      .instruction();

    let anotherTx = await txnHelpers.buildV0Txn([anotherIx], [newAdmin]);
    await connection.sendTransaction(anotherTx);
    await sleep(2);

    let latestConfig = await ctx.getConfig();
    assert.equal(latestConfig.admin.toString(), wallet.publicKey.toString());
  });
});
