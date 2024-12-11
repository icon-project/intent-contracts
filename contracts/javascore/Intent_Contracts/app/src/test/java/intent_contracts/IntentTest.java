package intent_contracts;

import com.iconloop.score.test.Account;
import com.iconloop.score.test.Score;
import com.iconloop.score.test.ServiceManager;
import com.iconloop.score.test.TestBase;

import intent_contracts.mocks.MockToken;
import network.icon.intent.Intent;
import network.icon.intent.constants.Constant;
import network.icon.intent.structs.Cancel;
import network.icon.intent.structs.OrderFill;
import network.icon.intent.structs.OrderMessage;
import network.icon.intent.structs.SwapOrder;
import network.icon.intent.utils.SwapOrderData;
import score.Context;

import org.json.JSONObject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import score.UserRevertedException;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;

import static java.math.BigInteger.TEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

public class IntentTest extends TestBase {
    private static final ServiceManager sm = getServiceManager();
    private static final Account deployer = sm.createAccount();
    private static final Account feeHandler = sm.createAccount();
    private static final Account relayAddress = sm.createAccount();
    private static final Account user1 = sm.createAccount();
    private static final Account user2 = sm.createAccount();
    private static final Account solver = sm.createAccount();

    private static Score intent;
    private MockToken token;

    private final BigInteger protocolFee = BigInteger.valueOf(50);
    private static final BigInteger initialSupply = BigInteger.valueOf(1000);
    private static final BigInteger totalSupply = initialSupply.multiply(TEN.pow(18));

    // swapOrderData
    public final BigInteger id = BigInteger.ONE;
    public String emitter;
    public String srcNID = "Network-1";
    public String dstNID = "Network-2";
    public String creator;
    public String destinationAddress;
    public String swapToken;
    public BigInteger amount = BigInteger.valueOf(500).multiply(TEN.pow(18));
    public String toToken = "0x7891"; // Token to receive on the destination network
    public BigInteger toAmount = BigInteger.valueOf(400).multiply(TEN.pow(18));
    public String data = "";

    @BeforeEach
    void setup() throws Exception {
        // Deploy a mock token contract
        token = new MockToken(sm, deployer);

        // Deploy Intent contract with correct parameters
        intent = sm.deploy(deployer, Intent.class, "Network-1", protocolFee, feeHandler.getAddress(),
                relayAddress.getAddress());
    }

    @Test
    void testSwap() {
        // Set mock behavior for the initial balances
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(totalSupply);
        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(BigInteger.ZERO);
        when(token.tokenContract.mock.balanceOf(user2.getAddress())).thenReturn(BigInteger.ZERO);

        // Assert deployer has total supply initially
        assertEquals(totalSupply, token.tokenContract.mock.balanceOf(deployer.getAddress()));

        // Simulate transfer from deployer to user1
        boolean success = token.tokenContract.mock.transfer(user1.getAddress(), totalSupply);
        assertTrue(success);

        // Assert user1 now has the total supply
        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply);
        assertEquals(totalSupply, token.tokenContract.mock.balanceOf(user1.getAddress()));
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(BigInteger.ZERO);
        assertEquals(BigInteger.ZERO, token.tokenContract.mock.balanceOf(deployer.getAddress()));

        // Create SwapOrderData and set the required parameters
        creator = user1.getAddress().toString();
        swapToken = token.tokenContract.getAddress().toString();
        emitter = intent.getAddress().toString();
        destinationAddress = user2.getAddress().toString();
        SwapOrder swapOrder = new SwapOrder(id, emitter, srcNID,
                dstNID, creator, destinationAddress,
                swapToken, amount, toToken, toAmount, data);

        String depositor = user1.getAddress().toString();
        byte[] swapOrderDataBytes = swapOrder.toBytes();

        JSONObject jsonObject = new JSONObject();
        jsonObject.put("depositor", depositor);
        jsonObject.put("token", token.tokenContract.getAddress().toString());
        jsonObject.put("amount", amount);
        jsonObject.put("swapOrderDataBytes", bytesToHex(swapOrderDataBytes).toString());

        byte[] finalData = jsonObjectToByteArray(jsonObject);

        intent.invoke(user1, "tokenFallback", user1.getAddress(), amount, finalData);

        // Simulate token balance changes post-swap
        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply.subtract(amount));
        when(token.tokenContract.mock.balanceOf(intent.getAddress())).thenReturn(amount);

        // Assert the balances after the swap
        assertEquals(totalSupply.subtract(amount), token.tokenContract.mock.balanceOf(user1.getAddress()));
        assertEquals(amount, token.tokenContract.mock.balanceOf(intent.getAddress()));
    }

    @Test
    void testSwapInvalidCreator() {
        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply);

        creator = intent.getAddress().toString();
        swapToken = token.tokenContract.getAddress().toString();
        emitter = intent.getAddress().toString();
        destinationAddress = user2.getAddress().toString();
        SwapOrder swapOrder = new SwapOrder(id, emitter, srcNID,
                dstNID, creator, destinationAddress,
                swapToken, amount, toToken, toAmount, data);

        String depositor = user1.getAddress().toString();
        byte[] swapOrderDataBytes = swapOrder.toBytes();

        JSONObject jsonObject = new JSONObject();
        jsonObject.put("depositor", depositor);
        jsonObject.put("token", token.tokenContract.getAddress().toString());
        jsonObject.put("amount", amount);
        jsonObject.put("swapOrderDataBytes",
                bytesToHex(swapOrderDataBytes).toString());

        byte[] finalData = jsonObjectToByteArray(jsonObject);

        UserRevertedException exception = assertThrows(UserRevertedException.class,
                () -> {
                    intent.invoke(user1, "tokenFallback", user1.getAddress(), amount, finalData); // This should revert
                });

        assertEquals("Reverted(0): Creator must be sender", exception.getMessage());
    }

    @Test
    void testSwapInvalidSrcNid() {
        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply);

        creator = user1.getAddress().toString();
        swapToken = token.tokenContract.getAddress().toString();
        emitter = intent.getAddress().toString();
        destinationAddress = user2.getAddress().toString();
        srcNID = "dummy";
        SwapOrder swapOrder = new SwapOrder(id, emitter, srcNID,
                dstNID, creator, destinationAddress,
                swapToken, amount, toToken, toAmount, data);

        String depositor = user1.getAddress().toString();
        byte[] swapOrderDataBytes = swapOrder.toBytes();

        JSONObject jsonObject = new JSONObject();
        jsonObject.put("depositor", depositor);
        jsonObject.put("token", token.tokenContract.getAddress().toString());
        jsonObject.put("amount", amount);
        jsonObject.put("swapOrderDataBytes",
                bytesToHex(swapOrderDataBytes).toString());

        byte[] finalData = jsonObjectToByteArray(jsonObject);

        UserRevertedException exception = assertThrows(UserRevertedException.class,
                () -> {
                    intent.invoke(user1, "tokenFallback", user1.getAddress(), amount, finalData);
                });

        assertEquals("Reverted(0): NID is misconfigured", exception.getMessage());
    }

    @Test
    void testSwapInvalidEmitter() {
        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply);

        creator = user1.getAddress().toString();
        swapToken = token.tokenContract.getAddress().toString();
        emitter = user1.getAddress().toString();
        destinationAddress = user2.getAddress().toString();
        SwapOrder swapOrder = new SwapOrder(id, emitter, srcNID,
                dstNID, creator, destinationAddress,
                swapToken, amount, toToken, toAmount, data);

        String depositor = user1.getAddress().toString();
        byte[] swapOrderDataBytes = swapOrder.toBytes();

        JSONObject jsonObject = new JSONObject();
        jsonObject.put("depositor", depositor);
        jsonObject.put("token", token.tokenContract.getAddress().toString());
        jsonObject.put("amount", amount);
        jsonObject.put("swapOrderDataBytes",
                bytesToHex(swapOrderDataBytes).toString());

        byte[] finalData = jsonObjectToByteArray(jsonObject);

        UserRevertedException exception = assertThrows(UserRevertedException.class,
                () -> {
                    intent.invoke(user1, "tokenFallback", user1.getAddress(), amount, finalData);
                });

        assertEquals("Reverted(0): Emitter specified is not this",
                exception.getMessage());
    }

    @Test
    void testFillOrder() {

        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(totalSupply);
        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(BigInteger.ZERO);
        when(token.tokenContract.mock.balanceOf(user2.getAddress())).thenReturn(BigInteger.ZERO);

        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        boolean success = token.tokenContract.mock.transfer(user1.getAddress(),
                totalSupply);
        assertTrue(success);

        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply);
        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(user1.getAddress()));
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(BigInteger.ZERO);
        assertEquals(BigInteger.ZERO,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        creator = user1.getAddress().toString();
        swapToken = token.tokenContract.getAddress().toString();
        emitter = intent.getAddress().toString();
        destinationAddress = user2.getAddress().toString();
        toToken = swapToken;
        SwapOrder swapOrder = new SwapOrder(id, emitter, srcNID,
                dstNID, creator, destinationAddress,
                swapToken, amount, toToken, toAmount, data);

        String depositor = user1.getAddress().toString();
        byte[] swapOrderDataBytes = swapOrder.toBytes();

        JSONObject jsonObject = new JSONObject();
        jsonObject.put("depositor", depositor);
        jsonObject.put("token", token.tokenContract.getAddress().toString());
        jsonObject.put("amount", amount);
        jsonObject.put("swapOrderDataBytes", bytesToHex(swapOrderDataBytes).toString());

        byte[] finalData = jsonObjectToByteArray(jsonObject);

        intent.invoke(user1, "tokenFallback", user1.getAddress(), amount, finalData);

        when(token.tokenContract.mock.balanceOf(solver.getAddress())).thenReturn(totalSupply);

        token.tokenContract.mock.approve(intent.getAddress(), amount);

        when(token.tokenContract.mock.allowance(user1.getAddress(),
                intent.getAddress())).thenReturn(amount);

        // Create SwapOrderData and set the required parameters
        SwapOrderData swapOrderData = new SwapOrderData();
        swapOrderData.id = swapOrder.id;
        swapOrderData.emitter = swapOrder.emitter;
        swapOrderData.srcNID = swapOrder.srcNID;
        swapOrderData.dstNID = swapOrder.dstNID;
        swapOrderData.creator = swapOrder.creator;
        swapOrderData.destinationAddress = swapOrder.destinationAddress;
        swapOrderData.token = swapOrder.token;
        swapOrderData.amount = swapOrder.amount;
        swapOrderData.toToken = swapOrder.toToken;
        swapOrderData.toAmount = swapOrder.toAmount;
        swapOrderData.data = swapOrder.data;

        // OrderFill orderFill = new OrderFill(swapOrder.id, swapOrder.toBytes(),
        // solver.getAddress().toString());
        // OrderMessage orderMessage = new OrderMessage(BigInteger.valueOf(1),
        // orderFill.toBytes());

        intent.invoke(user1, "fill", swapOrderData, solver.getAddress().toString());
    }

    @Test
    void testFillOrderAlreadyFilled() {

        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(totalSupply);
        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(BigInteger.ZERO);
        when(token.tokenContract.mock.balanceOf(user2.getAddress())).thenReturn(BigInteger.ZERO);

        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        boolean success = token.tokenContract.mock.transfer(user1.getAddress(),
                totalSupply);
        assertTrue(success);

        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply);
        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(user1.getAddress()));
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(BigInteger.ZERO);
        assertEquals(BigInteger.ZERO,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        creator = user1.getAddress().toString();
        swapToken = token.tokenContract.getAddress().toString();
        emitter = intent.getAddress().toString();
        destinationAddress = user2.getAddress().toString();
        toToken = swapToken;
        SwapOrder swapOrder = new SwapOrder(id, emitter, srcNID,
                dstNID, creator, destinationAddress,
                swapToken, amount, toToken, toAmount, data);

        String depositor = user1.getAddress().toString();
        byte[] swapOrderDataBytes = swapOrder.toBytes();

        JSONObject jsonObject = new JSONObject();
        jsonObject.put("depositor", depositor);
        jsonObject.put("token", token.tokenContract.getAddress().toString());
        jsonObject.put("amount", amount);
        jsonObject.put("swapOrderDataBytes", bytesToHex(swapOrderDataBytes).toString());

        byte[] finalData = jsonObjectToByteArray(jsonObject);

        intent.invoke(user1, "tokenFallback", user1.getAddress(), amount, finalData);

        when(token.tokenContract.mock.balanceOf(solver.getAddress())).thenReturn(totalSupply);

        token.tokenContract.mock.approve(intent.getAddress(), amount);

        when(token.tokenContract.mock.allowance(user1.getAddress(),
                intent.getAddress())).thenReturn(amount);

        // SwapOrder swapOrder = new SwapOrder(
        // swapOrderData.id, swapOrderData.emitter, swapOrderData.srcNID,
        // swapOrderData.dstNID, swapOrderData.creator,
        // swapOrderData.destinationAddress,
        // swapOrderData.token, swapOrderData.amount, swapOrderData.toToken,
        // swapOrderData.toAmount, swapOrderData.data);

        // OrderFill orderFill = new OrderFill(swapOrder.id, swapOrder.toBytes(),
        // solver.getAddress().toString());
        // OrderMessage orderMessage = new OrderMessage(BigInteger.valueOf(1),
        // orderFill.toBytes());

        // Create SwapOrderData and set the required parameters
        SwapOrderData swapOrderData = new SwapOrderData();
        swapOrderData.id = swapOrder.id;
        swapOrderData.emitter = swapOrder.emitter;
        swapOrderData.srcNID = swapOrder.srcNID;
        swapOrderData.dstNID = swapOrder.dstNID;
        swapOrderData.creator = swapOrder.creator;
        swapOrderData.destinationAddress = swapOrder.destinationAddress;
        swapOrderData.token = swapOrder.token;
        swapOrderData.amount = swapOrder.amount;
        swapOrderData.toToken = swapOrder.toToken;
        swapOrderData.toAmount = swapOrder.toAmount;
        swapOrderData.data = swapOrder.data;

        intent.invoke(user1, "fill", swapOrderData, solver.getAddress().toString());

        UserRevertedException exception = assertThrows(UserRevertedException.class,
                () -> {
                    intent.invoke(user1, "fill", swapOrderData, solver.getAddress().toString());
                });

        assertEquals("Reverted(0): Order has already been filled",
                exception.getMessage());
    }

    @Test
    void testFillOrderSameChain() {
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(totalSupply);
        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(BigInteger.ZERO);
        when(token.tokenContract.mock.balanceOf(user2.getAddress())).thenReturn(BigInteger.ZERO);

        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        boolean success = token.tokenContract.mock.transfer(user1.getAddress(),
                totalSupply);
        assertTrue(success);

        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply);
        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(user1.getAddress()));
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(BigInteger.ZERO);
        assertEquals(BigInteger.ZERO,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        creator = user1.getAddress().toString();
        swapToken = token.tokenContract.getAddress().toString();
        emitter = intent.getAddress().toString();
        destinationAddress = user2.getAddress().toString();
        dstNID = srcNID;
        toToken = swapToken;
        SwapOrder swapOrder = new SwapOrder(id, emitter, srcNID,
                dstNID, creator, destinationAddress,
                swapToken, amount, toToken, toAmount, data);

        String depositor = user1.getAddress().toString();
        byte[] swapOrderDataBytes = swapOrder.toBytes();

        JSONObject jsonObject = new JSONObject();
        jsonObject.put("depositor", depositor);
        jsonObject.put("token", token.tokenContract.getAddress().toString());
        jsonObject.put("amount", amount);
        jsonObject.put("swapOrderDataBytes", bytesToHex(swapOrderDataBytes).toString());

        byte[] finalData = jsonObjectToByteArray(jsonObject);

        intent.invoke(user1, "tokenFallback", user1.getAddress(), amount, finalData);

        when(token.tokenContract.mock.balanceOf(solver.getAddress())).thenReturn(totalSupply);

        token.tokenContract.mock.approve(intent.getAddress(), amount);

        when(token.tokenContract.mock.allowance(user1.getAddress(),
                intent.getAddress())).thenReturn(amount);

        // SwapOrder swapOrder = new SwapOrder(
        // swapOrderData.id, swapOrderData.emitter, swapOrderData.srcNID,
        // swapOrderData.dstNID, swapOrderData.creator,
        // swapOrderData.destinationAddress,
        // swapOrderData.token, swapOrderData.amount, swapOrderData.toToken,
        // swapOrderData.toAmount, swapOrderData.data);

        // OrderFill orderFill = new OrderFill(swapOrder.id, swapOrder.toBytes(),
        // solver.getAddress().toString());
        // OrderMessage orderMessage = new OrderMessage(BigInteger.valueOf(1),
        // orderFill.toBytes());

        // Create SwapOrderData and set the required parameters
        SwapOrderData swapOrderData = new SwapOrderData();
        swapOrderData.id = swapOrder.id;
        swapOrderData.emitter = swapOrder.emitter;
        swapOrderData.srcNID = swapOrder.srcNID;
        swapOrderData.dstNID = swapOrder.dstNID;
        swapOrderData.creator = swapOrder.creator;
        swapOrderData.destinationAddress = swapOrder.destinationAddress;
        swapOrderData.token = swapOrder.token;
        swapOrderData.amount = swapOrder.amount;
        swapOrderData.toToken = swapOrder.toToken;
        swapOrderData.toAmount = swapOrder.toAmount;
        swapOrderData.data = swapOrder.data;

        intent.invoke(user1, "fill", swapOrderData, solver.getAddress().toString());
    }

    @Test
    void testCancelOrder() {
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(totalSupply);
        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(BigInteger.ZERO);
        when(token.tokenContract.mock.balanceOf(user2.getAddress())).thenReturn(BigInteger.ZERO);

        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        boolean success = token.tokenContract.mock.transfer(user1.getAddress(),
                totalSupply);
        assertTrue(success);

        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply);
        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(user1.getAddress()));
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(BigInteger.ZERO);
        assertEquals(BigInteger.ZERO,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        creator = user1.getAddress().toString();
        swapToken = token.tokenContract.getAddress().toString();
        emitter = intent.getAddress().toString();
        destinationAddress = user2.getAddress().toString();
        toToken = swapToken;
        SwapOrder swapOrder = new SwapOrder(id, emitter, srcNID,
                dstNID, creator, destinationAddress,
                swapToken, amount, toToken, toAmount, data);

        String depositor = user1.getAddress().toString();
        byte[] swapOrderDataBytes = swapOrder.toBytes();

        JSONObject jsonObject = new JSONObject();
        jsonObject.put("depositor", depositor);
        jsonObject.put("token", token.tokenContract.getAddress().toString());
        jsonObject.put("amount", amount);
        jsonObject.put("swapOrderDataBytes", bytesToHex(swapOrderDataBytes).toString());

        byte[] finalData = jsonObjectToByteArray(jsonObject);

        intent.invoke(user1, "tokenFallback", user1.getAddress(), amount, finalData);

        BigInteger beforeCancelConn = (BigInteger) intent.call("getConnSn");

        intent.invoke(user1, "cancel", swapOrder.id);

        BigInteger afterCancelConn = (BigInteger) intent.call("getConnSn");

        assertEquals(beforeCancelConn,
                afterCancelConn.subtract(BigInteger.valueOf(1)));
    }

    @Test
    void testCancelOrderOnlyCreator() {
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(totalSupply);
        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(BigInteger.ZERO);
        when(token.tokenContract.mock.balanceOf(user2.getAddress())).thenReturn(BigInteger.ZERO);

        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        boolean success = token.tokenContract.mock.transfer(user1.getAddress(),
                totalSupply);
        assertTrue(success);

        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply);
        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(user1.getAddress()));
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(BigInteger.ZERO);
        assertEquals(BigInteger.ZERO,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        creator = user1.getAddress().toString();
        swapToken = token.tokenContract.getAddress().toString();
        emitter = intent.getAddress().toString();
        destinationAddress = user2.getAddress().toString();
        toToken = swapToken;
        SwapOrder swapOrder = new SwapOrder(id, emitter, srcNID,
                dstNID, creator, destinationAddress,
                swapToken, amount, toToken, toAmount, data);

        String depositor = user1.getAddress().toString();
        byte[] swapOrderDataBytes = swapOrder.toBytes();

        JSONObject jsonObject = new JSONObject();
        jsonObject.put("depositor", depositor);
        jsonObject.put("token", token.tokenContract.getAddress().toString());
        jsonObject.put("amount", amount);
        jsonObject.put("swapOrderDataBytes", bytesToHex(swapOrderDataBytes).toString());

        byte[] finalData = jsonObjectToByteArray(jsonObject);

        intent.invoke(user1, "tokenFallback", user1.getAddress(), amount, finalData);

        UserRevertedException exception = assertThrows(UserRevertedException.class,
                () -> {
                    intent.invoke(deployer, "cancel", swapOrder.id);
                });

        assertEquals("Reverted(0): Only creator can cancel this order",
                exception.getMessage());
    }

    @Test
    void testResolveOrder() {
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(totalSupply);
        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(BigInteger.ZERO);
        when(token.tokenContract.mock.balanceOf(user2.getAddress())).thenReturn(BigInteger.ZERO);

        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        boolean success = token.tokenContract.mock.transfer(user1.getAddress(),
                totalSupply);
        assertTrue(success);

        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply);
        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(user1.getAddress()));
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(BigInteger.ZERO);
        assertEquals(BigInteger.ZERO,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        creator = user1.getAddress().toString();
        swapToken = token.tokenContract.getAddress().toString();
        emitter = intent.getAddress().toString();
        destinationAddress = user2.getAddress().toString();
        toToken = swapToken;
        SwapOrder swapOrder = new SwapOrder(id, emitter, srcNID,
                dstNID, creator, destinationAddress,
                swapToken, amount, toToken, toAmount, data);

        String depositor = user1.getAddress().toString();
        byte[] swapOrderDataBytes = swapOrder.toBytes();

        JSONObject jsonObject = new JSONObject();
        jsonObject.put("depositor", depositor);
        jsonObject.put("token", token.tokenContract.getAddress().toString());
        jsonObject.put("amount", amount);
        jsonObject.put("swapOrderDataBytes", bytesToHex(swapOrderDataBytes).toString());

        byte[] finalData = jsonObjectToByteArray(jsonObject);

        intent.invoke(user1, "tokenFallback", user1.getAddress(), amount, finalData);

        when(token.tokenContract.mock.balanceOf(solver.getAddress())).thenReturn(totalSupply);

        token.tokenContract.mock.approve(intent.getAddress(), amount);

        when(token.tokenContract.mock.allowance(user1.getAddress(),
                intent.getAddress())).thenReturn(amount);

        SwapOrderData swapOrderData = new SwapOrderData();
        swapOrderData.id = swapOrder.id;
        swapOrderData.emitter = swapOrder.emitter;
        swapOrderData.srcNID = swapOrder.srcNID;
        swapOrderData.dstNID = swapOrder.dstNID;
        swapOrderData.creator = swapOrder.creator;
        swapOrderData.destinationAddress = swapOrder.destinationAddress;
        swapOrderData.token = swapOrder.token;
        swapOrderData.amount = swapOrder.amount;
        swapOrderData.toToken = swapOrder.toToken;
        swapOrderData.toAmount = swapOrder.toAmount;
        swapOrderData.data = swapOrder.data;

        OrderFill orderFill = new OrderFill(swapOrder.id, swapOrder.toBytes(),
                solver.getAddress().toString());
        OrderMessage orderMessage = new OrderMessage(BigInteger.valueOf(1),
                orderFill.toBytes());

        intent.invoke(user1, "fill", swapOrderData, solver.getAddress().toString());

        intent.invoke(relayAddress, "recvMessage", dstNID, 1,
                orderMessage.toBytes());

        BigInteger conn = (BigInteger) intent.call("getConnSn");

        assertEquals(intent.call("getReceipt", dstNID, conn), true);
    }

    @Test
    void testResolveOrderMisMatch() {
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(totalSupply);
        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(BigInteger.ZERO);
        when(token.tokenContract.mock.balanceOf(user2.getAddress())).thenReturn(BigInteger.ZERO);

        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        boolean success = token.tokenContract.mock.transfer(user1.getAddress(),
                totalSupply);
        assertTrue(success);

        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply);
        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(user1.getAddress()));
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(BigInteger.ZERO);
        assertEquals(BigInteger.ZERO,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        creator = user1.getAddress().toString();
        swapToken = token.tokenContract.getAddress().toString();
        emitter = intent.getAddress().toString();
        destinationAddress = user2.getAddress().toString();
        toToken = swapToken;
        SwapOrder swapOrder = new SwapOrder(id, emitter, srcNID,
                dstNID, creator, destinationAddress,
                swapToken, amount, toToken, toAmount, data);

        String depositor = user1.getAddress().toString();
        byte[] swapOrderDataBytes = swapOrder.toBytes();

        JSONObject jsonObject = new JSONObject();
        jsonObject.put("depositor", depositor);
        jsonObject.put("token", token.tokenContract.getAddress().toString());
        jsonObject.put("amount", amount);
        jsonObject.put("swapOrderDataBytes", bytesToHex(swapOrderDataBytes).toString());

        byte[] finalData = jsonObjectToByteArray(jsonObject);

        intent.invoke(user1, "tokenFallback", user1.getAddress(), amount, finalData);

        when(token.tokenContract.mock.balanceOf(solver.getAddress())).thenReturn(totalSupply);

        token.tokenContract.mock.approve(intent.getAddress(), amount);

        when(token.tokenContract.mock.allowance(user1.getAddress(),
                intent.getAddress())).thenReturn(amount);

        SwapOrderData swapOrderData = new SwapOrderData();
        swapOrderData.id = swapOrder.id;
        swapOrderData.emitter = swapOrder.emitter;
        swapOrderData.srcNID = swapOrder.srcNID;
        swapOrderData.dstNID = swapOrder.dstNID;
        swapOrderData.creator = swapOrder.creator;
        swapOrderData.destinationAddress = swapOrder.destinationAddress;
        swapOrderData.token = swapOrder.token;
        swapOrderData.amount = swapOrder.amount;
        swapOrderData.toToken = swapOrder.toToken;
        swapOrderData.toAmount = swapOrder.toAmount;
        swapOrderData.data = swapOrder.data;

        OrderFill orderFill = new OrderFill(swapOrder.id, swapOrder.toBytes(),
                solver.getAddress().toString());
        OrderMessage orderMessage = new OrderMessage(BigInteger.valueOf(1),
                orderFill.toBytes());

        intent.invoke(user1, "fill", swapOrderData, solver.getAddress().toString());

        UserRevertedException exception = assertThrows(UserRevertedException.class,
                () -> {
                    intent.invoke(relayAddress, "recvMessage", "dummy", 1,
                            orderMessage.toBytes());
                });

        assertEquals("Reverted(0): Invalid Network", exception.getMessage());

    }

    @Test
    void testResolveCancel() {
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(totalSupply);
        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(BigInteger.ZERO);
        when(token.tokenContract.mock.balanceOf(user2.getAddress())).thenReturn(BigInteger.ZERO);

        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        boolean success = token.tokenContract.mock.transfer(user1.getAddress(),
                totalSupply);
        assertTrue(success);

        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply);
        assertEquals(totalSupply,
                token.tokenContract.mock.balanceOf(user1.getAddress()));
        when(token.tokenContract.mock.balanceOf(deployer.getAddress())).thenReturn(BigInteger.ZERO);
        assertEquals(BigInteger.ZERO,
                token.tokenContract.mock.balanceOf(deployer.getAddress()));

        creator = user1.getAddress().toString();
        swapToken = token.tokenContract.getAddress().toString();
        emitter = intent.getAddress().toString();
        destinationAddress = user2.getAddress().toString();
        toToken = swapToken;
        SwapOrder swapOrder = new SwapOrder(id, emitter, srcNID,
                dstNID, creator, destinationAddress,
                swapToken, amount, toToken, toAmount, data);

        String depositor = user1.getAddress().toString();
        byte[] swapOrderDataBytes = swapOrder.toBytes();

        JSONObject jsonObject = new JSONObject();
        jsonObject.put("depositor", depositor);
        jsonObject.put("token", token.tokenContract.getAddress().toString());
        jsonObject.put("amount", amount);
        jsonObject.put("swapOrderDataBytes", bytesToHex(swapOrderDataBytes).toString());

        byte[] finalData = jsonObjectToByteArray(jsonObject);

        intent.invoke(user1, "tokenFallback", user1.getAddress(), amount, finalData);

        when(token.tokenContract.mock.balanceOf(solver.getAddress())).thenReturn(totalSupply);

        token.tokenContract.mock.approve(intent.getAddress(), amount);

        when(token.tokenContract.mock.allowance(user1.getAddress(),
                intent.getAddress())).thenReturn(amount);

        SwapOrderData swapOrderData = new SwapOrderData();
        swapOrderData.id = swapOrder.id;
        swapOrderData.emitter = swapOrder.emitter;
        swapOrderData.srcNID = swapOrder.srcNID;
        swapOrderData.dstNID = swapOrder.dstNID;
        swapOrderData.creator = swapOrder.creator;
        swapOrderData.destinationAddress = swapOrder.destinationAddress;
        swapOrderData.token = swapOrder.token;
        swapOrderData.amount = swapOrder.amount;
        swapOrderData.toToken = swapOrder.toToken;
        swapOrderData.toAmount = swapOrder.toAmount;
        swapOrderData.data = swapOrder.data;

        Cancel cancel = new Cancel();
        cancel.orderBytes = swapOrder.toBytes();

        OrderMessage orderMessage = new OrderMessage(Constant.CANCEL,
                cancel.toBytes());

        // OrderFill orderFill = new OrderFill(swapOrder.id, swapOrder.toBytes(),
        // swapOrder.creator);

        // OrderMessage fillMessage = new OrderMessage(Constant.FILL,
        // orderFill.toBytes());

        intent.invoke(relayAddress, "recvMessage", srcNID, 1,
                orderMessage.toBytes());

        boolean isFinished = (boolean) intent.call("getFinishedorders",
                Context.hash("keccak-256", swapOrder.toBytes()));
        assertTrue(isFinished);
    }

    @Test
    void testSetFeeHandler() {
        Account feeHandler = sm.createAccount();
        intent.invoke(deployer, "setFeeHandler", feeHandler.getAddress());

        assertEquals(feeHandler.getAddress(), intent.call("getFeeHandler"));
    }

    @Test
    void testSetFeeHandlerNonAdmin() {
        Account feeHandler = sm.createAccount();

        UserRevertedException exception = assertThrows(UserRevertedException.class,
                () -> {
                    intent.invoke(user1, "setFeeHandler", feeHandler.getAddress());
                });

        assertEquals("Reverted(0): Not Owner", exception.getMessage());
    }

    @Test
    void testSetProtocol() {
        intent.invoke(deployer, "setProtocolFee", TEN);

        assertEquals(TEN, intent.call("getProtocolFee"));
    }

    @Test
    void testSetProtocolFeeNonAdmin() {

        UserRevertedException exception = assertThrows(UserRevertedException.class,
                () -> {
                    intent.invoke(user1, "setProtocolFee", TEN);
                });

        assertEquals("Reverted(0): Not Owner", exception.getMessage());
    }

    @Test
    public void testTokenFallback() {
        when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply);

        BigInteger depositedAmount0 = (BigInteger) intent.call("getDepositAmount",
                user1.getAddress().toString(),
                token.tokenContract.getAddress().toString());
        assertEquals(BigInteger.ZERO, depositedAmount0);

        creator = user1.getAddress().toString();
        swapToken = token.tokenContract.getAddress().toString();
        emitter = intent.getAddress().toString();
        destinationAddress = user2.getAddress().toString();
        toToken = swapToken;
        SwapOrder swapOrder = new SwapOrder(id, emitter, srcNID,
                dstNID, creator, destinationAddress,
                swapToken, amount, toToken, toAmount, data);

        String depositor = user1.getAddress().toString();
        byte[] swapOrderDataBytes = swapOrder.toBytes();

        JSONObject jsonObject = new JSONObject();
        jsonObject.put("depositor", depositor);
        jsonObject.put("token", token.tokenContract.getAddress().toString());
        jsonObject.put("amount", amount);
        jsonObject.put("swapOrderDataBytes", bytesToHex(swapOrderDataBytes).toString());

        byte[] finalData = jsonObjectToByteArray(jsonObject);

        intent.invoke(user1, "tokenFallback", user1.getAddress(), amount, finalData);

        BigInteger depositedAmount = (BigInteger) intent.call("getDepositAmount",
                user1.getAddress().toString(),
                token.tokenContract.getAddress().toString());
        assertEquals(amount, depositedAmount);
    }

    public static String bytesToHex(byte[] bytes) {
        StringBuilder hexString = new StringBuilder(2 * bytes.length);
        for (byte b : bytes) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) {
                hexString.append('0');
            }
            hexString.append(hex);
        }
        return hexString.toString();
    }

    public static byte[] jsonObjectToByteArray(JSONObject jsonObject) {
        String jsonString = jsonObject.toString();
        return jsonString.getBytes(StandardCharsets.UTF_8);
    }
}
