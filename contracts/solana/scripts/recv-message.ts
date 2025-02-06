import { TxnHelpers } from "./utils/transaction";
import { wallet, connection, getRecvMessageIx } from "./setup";

const txnHelpers = new TxnHelpers(connection, wallet.payer);

const args = process.argv.slice(2);
if (args.length != 3) throw new Error("Invalid arguments");

const srcNetwork = args[0];
const connSn = Number(args[1]);
const msg = Buffer.from(args[2], "hex");

const recvMessage = async () => {
  const recvMessageIx = await getRecvMessageIx(
    srcNetwork,
    connSn,
    msg,
    wallet.publicKey
  );
  const tx = await txnHelpers.buildV0Txn([recvMessageIx], [wallet.payer]);
  const txSig = await connection.sendTransaction(tx);
  return txSig;
};

recvMessage()
  .then(async (res) => {
    console.log("Receive Message");
    if (res) await txnHelpers.logParsedTx(res);
    console.log("Message received successfully");
  })
  .catch((err) => {
    console.log(err);
  });
