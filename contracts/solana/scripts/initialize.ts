import { PublicKey } from "@solana/web3.js";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

import { TxnHelpers } from "./utils/transaction";
import { IntentPda, intentProgram, wallet, connection } from "./setup";

const txnHelpers = new TxnHelpers(connection, wallet.payer);

const args = process.argv.slice(2);
if (args.length != 2) throw new Error("Invalid arguments");

const networkId = args[0];
const feeHandler = new PublicKey(args[1]);

const initializeContract = async () => {
  let config = await intentProgram.account.config.fetchNullable(
    IntentPda.config().pda
  );
  if (!config) {
    const initializeIx = await intentProgram.methods
      .initialize(networkId, feeHandler)
      .signers([wallet.payer])
      .accountsStrict({
        signer: wallet.publicKey,
        systemProgram: SYSTEM_PROGRAM_ID,
        config: IntentPda.config().pda,
        nativeVaultAccount: IntentPda.vaultNative().pda,
      })
      .instruction();

    const tx = await txnHelpers.buildV0Txn([initializeIx], [wallet.payer]);
    const txSig = await connection.sendTransaction(tx);
    return txSig;
  }
};

initializeContract()
  .then(async (res) => {
    console.log("Contract initializing");
    if (res) await txnHelpers.logParsedTx(res);
    console.log("Contract initialized successfully");
  })
  .catch((err) => {
    console.log(err);
  });