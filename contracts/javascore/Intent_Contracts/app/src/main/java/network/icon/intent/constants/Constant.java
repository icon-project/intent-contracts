package network.icon.intent.constants;

import java.math.BigInteger;

public class Constant {
    public enum OrderAction {
        FILL(BigInteger.ONE),
        CANCEL(BigInteger.TWO);

        private final BigInteger value;

        OrderAction(BigInteger value) {
            this.value = value;
        }

        public BigInteger getValue() {
            return value;
        }
    }

    // Generalized Connection Variables
    public final static String RECEIPTS = "receipts";
    public final static String RELAY_ADDRESS = "relayAddress";
    public final static String CONN_SN = "connSn";

    // Intent Variables
    public final static String DEPOSIT_ID = "depositId";
    public final static String NETWORK_ID = "networkId";
    public final static String PROTOCOL_FEE = "protocolFee";
    public final static String FEE_HANDLER = "feeHandler";
    public final static String ORDERS = "orders";
    public final static String FINISHED_ORDERS = "finishedOrders";

}
