package network.icon.intent;

import java.math.BigInteger;

import network.icon.intent.constants.Constant;
import score.Address;
import score.BranchDB;
import score.Context;
import score.DictDB;
import score.VarDB;
import score.annotation.EventLog;
import score.annotation.External;

public class GeneralizedConnection {
    protected final BranchDB<String, DictDB<BigInteger, Boolean>> receipts = Context.newBranchDB(Constant.RECEIPTS,
            Boolean.class);
    protected final VarDB<Address> relayAddress = Context.newVarDB(Constant.RELAY_ADDRESS, Address.class);
    protected final VarDB<BigInteger> connSn = Context.newVarDB(Constant.CONN_SN, BigInteger.class);

    @EventLog(indexed = 2)
    public void Message(String targetNetwork, BigInteger connSn, byte[] msg) {
    }

    protected void _sendMessage(
            String to,
            byte[] _msg) {
        connSn.set(connSn.getOrDefault(BigInteger.ZERO).add(BigInteger.ONE));
        Message(to, connSn.get(), _msg);
    }

    protected void _recvMessage(String srcNetwork, BigInteger _connSn) {
        onlyRelay();
        Context.require(receipts.at(srcNetwork).getOrDefault(_connSn, false).equals(false), "Duplicate Message");
        receipts.at(srcNetwork).set(_connSn, true);
    }

    @External
    public void setAdmin(Address _address) {
        onlyRelay();
        relayAddress.set(_address);
    }

    @External(readonly = true)
    public boolean getReceipts(
            String srcNetwork,
            BigInteger _connSn) {
        return receipts.at(srcNetwork).getOrDefault(_connSn, false);
    }

    @External(readonly = true)
    public Address admin() {
        return relayAddress.get();
    }

    public BigInteger getConnSn() {
        return connSn.getOrDefault(BigInteger.ZERO);
    }

    void onlyRelay() {
        Context.require(Context.getCaller().equals(relayAddress.get()), "OnlyRelayer");
    }

}
