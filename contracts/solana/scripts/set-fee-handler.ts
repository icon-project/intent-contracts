import { PublicKey } from "@solana/web3.js";

import { TxnHelpers } from "./utils/transaction";
import { connection, wallet, intentProgram } from "./setup";
import { IntentPda } from "./setup";

let args = process.argv.slice(2);
if (args.length != 1) throw new Error("Invalid arguments");

const feeHandler = new PublicKey(args[0]);

let txnHelpers = new TxnHelpers(connection, wallet.payer);

const setProtocolFeeHandler = async () => {
  return await intentProgram.methods
    .setFeeHandler(feeHandler)
    .accountsStrict({
      admin: wallet.publicKey,
      config: IntentPda.config().pda,
    })
    .signers([wallet.payer])
    .rpc();
};

setProtocolFeeHandler()
  .then(async (sig) => {
    await txnHelpers.logParsedTx(sig);
  })
  .catch((err) => {
    console.log("Error while setting fee handler: ", err);
  });
