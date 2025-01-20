package network.icon.intent;

import java.math.BigInteger;
import java.util.Arrays;

import static network.icon.intent.constants.Constant.*;
import network.icon.intent.constants.Constant.OrderAction;
import network.icon.intent.db.SwapOrderDb;
import network.icon.intent.structs.OrderFill;
import network.icon.intent.structs.OrderMessage;
import network.icon.intent.structs.TokenFallbackData;
import score.*;
import score.annotation.EventLog;
import score.annotation.External;

public class Intent extends GeneralizedConnection {

    public static final BigInteger POINTS = BigInteger.valueOf(10_000);
    public static final String SWAP = "swap";
    public static final String FILL = "fill";

    public final VarDB<BigInteger> depositId = Context.newVarDB(DEPOSIT_ID, BigInteger.class);
    public final VarDB<String> networkId = Context.newVarDB(NETWORK_ID, String.class);
    public final VarDB<BigInteger> protocolFee = Context.newVarDB(PROTOCOL_FEE, BigInteger.class);
    public static final VarDB<Address> feeHandler = Context.newVarDB(FEE_HANDLER, Address.class);
    
    private static final DictDB<BigInteger, SwapOrderDb> orders = Context.newDictDB(ORDERS, SwapOrderDb.class);
    private static final DictDB<byte[], Boolean> finishedOrders = Context.newDictDB(FINISHED_ORDERS, Boolean.class);

    @EventLog(indexed = 3)
    public void SwapIntent(
            BigInteger id,
            String emitter,
            String srcNID,
            String dstNID,
            String creator,
            String destinationAddress,
            String token,
            BigInteger amount,
            String toToken,
            BigInteger toAmount,
            byte[] data) {
    }

    @EventLog(indexed = 2)
    public void OrderFilled(BigInteger id, String srcNID) {
    }

    @EventLog(indexed = 2)
    public void OrderCancelled(BigInteger id, String srcNID) {
    }

    @EventLog(indexed = 1)
    public void OrderClosed(BigInteger id) {
    }

    public Intent(String _nid, BigInteger _protocolFee, Address _feeHandler, Address _relayer) {
        if (networkId.get() == null) {
            networkId.set(_nid);
            protocolFee.set(_protocolFee);
            feeHandler.set(_feeHandler);
            relayAddress.set(_relayer);
        }
    }
    
    @External
    public void tokenFallback(Address _from, BigInteger _value, byte[] _data) {
        TokenFallbackData fallbackData = TokenFallbackData.fromBytes(_data);
        SwapOrderDb swapOrder = SwapOrderDb.fromBytes(fallbackData.swapOrderData);
        String type = fallbackData.type;

        switch (type) {
            case SWAP:
                Context.require(_value.equals(swapOrder.amount), "Value and amount must be equal");
                Context.require(_from.toString().equals(swapOrder.creator), "Depositer must be creator");
                _swap(swapOrder);
                break;
            case FILL:
                _fill(swapOrder, fallbackData.solver);
                break;
            default:
                Context.revert("Message type mismatched(swap/fill)");
        }
    }

    void _swap(SwapOrderDb swapOrder) {
        BigInteger id = this.depositId.getOrDefault(BigInteger.ZERO).add(BigInteger.valueOf(1));
        swapOrder.id = id;
        Context.require(swapOrder.srcNID.equals(this.networkId.get()), "NID is misconfigured");
        Context.require(swapOrder.emitter.equals(Context.getAddress().toString()), "Emitter specified is not this");
        orders.set(id, swapOrder);
        SwapIntent(id, swapOrder.emitter, swapOrder.srcNID, swapOrder.dstNID,
                swapOrder.creator,
                swapOrder.destinationAddress, swapOrder.token, swapOrder.amount,
                swapOrder.toToken, swapOrder.toAmount,
                swapOrder.data);
    }

    void _fill(SwapOrderDb swapOrder, String solverAddress) {
        byte[] serializedOrder = swapOrder.toBytes();
        byte[] orderHash = Context.hash("keccak-256", serializedOrder);

        boolean isOrderFilled = finishedOrders.getOrDefault(orderHash, false);
        Context.require(!isOrderFilled, "Order has already been filled");
        finishedOrders.set(orderHash, true);

        BigInteger protocolFeeAmount = swapOrder.toAmount.multiply(protocolFee.get()).divide(POINTS);
        BigInteger finalAmount = swapOrder.toAmount.subtract(protocolFeeAmount);

        _transferResult(swapOrder.destinationAddress, swapOrder.toToken, finalAmount, protocolFeeAmount);
        OrderFill orderFill = new OrderFill(swapOrder.id, serializedOrder, solverAddress);

        if (swapOrder.srcNID.equals(swapOrder.dstNID)) {
            _resolveFill(networkId.get(), orderFill);
            return;
        }

        OrderMessage fillMessage = new OrderMessage(OrderAction.FILL.getValue(), orderFill.toBytes());
        _sendMessage(swapOrder.srcNID, fillMessage.toBytes());
        OrderFilled(swapOrder.id, swapOrder.srcNID);
    }

    void _transferResult(String _toAddress, String _toToken, BigInteger amount, BigInteger fee) {
        Address toAddress = Address.fromString(_toAddress);
        Address toTokenAddress = Address.fromString(_toToken);
        Context.call(toTokenAddress, "transfer", toAddress, amount);
        Context.call(toTokenAddress, "transfer", feeHandler.get(), fee);
    }

    @External
    public void cancel(BigInteger id) {
        SwapOrderDb order = orders.get(id);
        if (order == null) {
            Context.revert("Order already has been cancelled");
        }
        Context.require(Address.fromString(order.creator).equals(Context.getCaller()),
                "Only creator can cancel this order");

        if (order.srcNID.equals(order.dstNID)) {
            _resolveCancel(networkId.get(), order.toBytes());
            return;
        }

        OrderMessage _msg = new OrderMessage(OrderAction.CANCEL.getValue(), order.toBytes());

        _sendMessage(order.dstNID, _msg.toBytes());
    }

    @External
    public void recvMessage(String srcNetwork, BigInteger _connSn, byte[] msg) {
        _recvMessage(srcNetwork, _connSn);

        OrderMessage receivedMessage = OrderMessage.fromBytes(msg);

        if (receivedMessage.messageType.equals(OrderAction.FILL.getValue())) {
            OrderFill fillOrder = OrderFill.fromBytes(receivedMessage.message);
            _resolveFill(srcNetwork, fillOrder);
        } else if (receivedMessage.messageType.equals(OrderAction.CANCEL.getValue())) {
            _resolveCancel(srcNetwork, receivedMessage.message);
        }
    }

    void _resolveCancel(String srcNetwork, byte[] orderBytes) {
        byte[] orderHash = Context.hash("keccak-256", orderBytes);
        boolean isOrderFinished = finishedOrders.getOrDefault(orderHash, false);
        if (isOrderFinished) {
            return;
        }

        SwapOrderDb cancelledOrder = SwapOrderDb.fromBytes(orderBytes);
        Context.require(cancelledOrder.srcNID.equals(networkId.get()), "Invalid Network");

        finishedOrders.set(orderHash, true);

        OrderFill fillOrder = new OrderFill(cancelledOrder.id, orderBytes, cancelledOrder.creator);
        OrderMessage responseMessage = new OrderMessage(OrderAction.FILL.getValue(), fillOrder.toBytes());

        _sendMessage(cancelledOrder.srcNID, responseMessage.toBytes());
        OrderCancelled(cancelledOrder.id, cancelledOrder.srcNID);
    }

    void _resolveFill(String srcNetwork, OrderFill _fill) {
        SwapOrderDb existingOrder = orders.get(_fill.id);
        if (existingOrder == null) {
            Context.revert("There is no order to resolve");
        }

        Context.require(Arrays.equals(
            Context.hash("keccak-256", existingOrder.toBytes()),
            Context.hash("keccak-256", _fill.orderBytes)
        ), "Mismatched order");

        Context.require(existingOrder.dstNID.equals(srcNetwork), "Invalid Network");

        orders.set(_fill.id, null);
        OrderClosed(_fill.id);

        Address tokenAddress = Address.fromString(existingOrder.token);
        Context.call(tokenAddress, "transfer", Address.fromString(_fill.solver), existingOrder.amount);
    }

    @External(readonly = true)
    public BigInteger getProtocolFee() {
        return protocolFee.get();
    }

    @External
    public void setProtocolFee(BigInteger _protocolFee) {
        OnlyOwner();
        protocolFee.set(_protocolFee);
    }

    @External(readonly = true)
    public Address getFeeHandler() {
        return feeHandler.get();
    }

    public static void setFeeHandler(Address _feeHandler) {
        OnlyOwner();
        feeHandler.set(_feeHandler);
    }

    public static SwapOrderDb getOrders(BigInteger id) {
        return orders.get(id);
    }

    public static Boolean getFinishedorders(byte[] messageHash) {
        return finishedOrders.getOrDefault(messageHash, false);
    }

    static void OnlyOwner() {
        Context.require(Context.getOwner().equals(Context.getCaller()), "Not Owner");
    }

}