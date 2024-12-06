package network.icon.intent.constants;

import java.math.BigInteger;

public class Constant {
    public static final BigInteger FILL = new BigInteger("1");
    public static final BigInteger CANCEL = new BigInteger("2");

    // Generalized Connection Variables
    public final static String RECEIPTS = "receipts";
    public final static String RELAY_ADDRESS = "relayAddress";
    public final static String CONN_SN = "connSn";

    // Intent Variables
    public final static String DEPOSIT_ID = "depositId";
    public final static String NETWORK_ID = "networkId";
    public final static String PROTOCOL_FEE = "protocolFee";
    public final static String FEE_HANDLER = "feeHandler";
    public final static String OWNER = "owner";
    public final static String NATIVE_ADDRESS = "nativeAddress";
    public final static String DEPOSIT = "deposit";
    public final static String ORDERS = "orders";
    public final static String FINISHED_ORDERS = "finishedOrders";
    public final static String PERMIT = "permit";
}
