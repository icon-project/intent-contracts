package intent_contracts;

import com.iconloop.score.test.Account;
import com.iconloop.score.test.Score;
import com.iconloop.score.test.ServiceManager;
import com.iconloop.score.test.TestBase;

import intent_contracts.mocks.MockToken;
import network.icon.intent.Intent;
import network.icon.intent.constants.Constant.OrderAction;
import network.icon.intent.structs.OrderFill;
import network.icon.intent.structs.OrderMessage;
import network.icon.intent.structs.TokenFallbackData;
import network.icon.intent.db.SwapOrderDb;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import score.UserRevertedException;
import score.Context;

import java.math.BigInteger;
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
        public String toToken = "0x7891";
        public BigInteger toAmount = BigInteger.valueOf(500).multiply(TEN.pow(18));
        public byte[] data = "".getBytes();

        @BeforeEach
        void setup() throws Exception {
                // Deploy a mock token contract
                token = new MockToken(sm, deployer);

                // Deploy Intent contract with correct parameters
                intent = sm.deploy(deployer, Intent.class, "Network-1", protocolFee,
                                feeHandler.getAddress(),
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
                SwapOrderDb swapOrder = new SwapOrderDb(id, emitter, srcNID, dstNID, creator, destinationAddress,
                                swapToken, amount, toToken, toAmount, data);

                TokenFallbackData fallbackData = new TokenFallbackData(swapOrder.toBytes(), "swap", user1.getAddress());

                // Spy on the intent contract to verify event emissions
                Intent intentSpy = Mockito.spy((Intent) intent.getInstance());
                intent.setInstance(intentSpy);

                // Invoke the tokenFallback method
                intent.invoke(user1, "tokenFallback", user1.getAddress(), amount, fallbackData.toBytes());

                // Verify the event SwapIntent was emitted with the correct parameters
                Mockito.verify(intentSpy).SwapIntent(
                                Mockito.eq(id),
                                Mockito.eq(emitter),
                                Mockito.eq(srcNID),
                                Mockito.eq(dstNID),
                                Mockito.eq(creator),
                                Mockito.eq(destinationAddress),
                                Mockito.eq(swapToken),
                                Mockito.eq(amount),
                                Mockito.eq(toToken),
                                Mockito.eq(toAmount),
                                Mockito.eq(data));

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
                SwapOrderDb swapOrder = new SwapOrderDb(id, emitter, srcNID,
                                dstNID, creator, destinationAddress,
                                swapToken, amount, toToken, toAmount, data);

                TokenFallbackData fallbackData = new TokenFallbackData(swapOrder.toBytes(), "swap", user1.getAddress());

                UserRevertedException exception = assertThrows(UserRevertedException.class,
                                () -> {
                                        intent.invoke(user1, "tokenFallback", user1.getAddress(), amount,
                                                        fallbackData.toBytes()); // This should revert
                                });

                assertEquals("Reverted(0): Depositer must be creator",
                                exception.getMessage());
        }

        @Test
        void testSwapInvalidSrcNid() {

                when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply);

                creator = user1.getAddress().toString();
                swapToken = token.tokenContract.getAddress().toString();
                emitter = intent.getAddress().toString();
                destinationAddress = user2.getAddress().toString();
                srcNID = "dummy";
                SwapOrderDb swapOrder = new SwapOrderDb(id, emitter, srcNID,
                                dstNID, creator, destinationAddress,
                                swapToken, amount, toToken, toAmount, data);

                TokenFallbackData fallbackData = new TokenFallbackData(swapOrder.toBytes(), "swap", user1.getAddress());

                UserRevertedException exception = assertThrows(UserRevertedException.class,
                                () -> {
                                        intent.invoke(user1, "tokenFallback", user1.getAddress(), amount,
                                                        fallbackData.toBytes());
                                });

                assertEquals("Reverted(0): NID is misconfigured",
                                exception.getMessage());
        }

        @Test
        void testSwapInvalidEmitter() {
                when(token.tokenContract.mock.balanceOf(user1.getAddress())).thenReturn(totalSupply);

                creator = user1.getAddress().toString();
                swapToken = token.tokenContract.getAddress().toString();
                emitter = user1.getAddress().toString();
                destinationAddress = user2.getAddress().toString();
                SwapOrderDb swapOrder = new SwapOrderDb(id, emitter, srcNID,
                                dstNID, creator, destinationAddress,
                                swapToken, amount, toToken, toAmount, data);

                TokenFallbackData fallbackData = new TokenFallbackData(swapOrder.toBytes(), "swap", user1.getAddress());

                UserRevertedException exception = assertThrows(UserRevertedException.class,
                                () -> {
                                        intent.invoke(user1, "tokenFallback", user1.getAddress(), amount,
                                                        fallbackData.toBytes());
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
                SwapOrderDb swapOrder = new SwapOrderDb(id, emitter, srcNID,
                                dstNID, creator, destinationAddress,
                                swapToken, amount, toToken, toAmount, data);

                TokenFallbackData fallbackData = new TokenFallbackData(swapOrder.toBytes(), "fill", user1.getAddress());

                intent.invoke(user1, "tokenFallback", user1.getAddress(), amount,
                                fallbackData.toBytes());
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
                SwapOrderDb swapOrder = new SwapOrderDb(id, emitter, srcNID,
                                dstNID, creator, destinationAddress,
                                swapToken, amount, toToken, toAmount, data);

                TokenFallbackData fallbackData = new TokenFallbackData(swapOrder.toBytes(), "fill", user1.getAddress());
                intent.invoke(user1, "tokenFallback", user1.getAddress(), amount,
                                fallbackData.toBytes());

                UserRevertedException exception = assertThrows(UserRevertedException.class,
                                () -> {
                                        intent.invoke(user1, "tokenFallback", user1.getAddress(), amount,
                                                        fallbackData.toBytes());
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
                SwapOrderDb swapOrder = new SwapOrderDb(id, emitter, srcNID,
                                dstNID, creator, destinationAddress,
                                swapToken, amount, toToken, toAmount, data);

                TokenFallbackData fallbackData = new TokenFallbackData(swapOrder.toBytes(), "swap", user1.getAddress());
                intent.invoke(user1, "tokenFallback", user1.getAddress(), amount,
                                fallbackData.toBytes());

                when(token.tokenContract.mock.balanceOf(solver.getAddress())).thenReturn(totalSupply);

                token.tokenContract.mock.approve(intent.getAddress(), amount);

                when(token.tokenContract.mock.allowance(user1.getAddress(),
                                intent.getAddress())).thenReturn(amount);

                OrderFill orderFill = new OrderFill(swapOrder.id,
                                swapOrder.toBytes(),
                                solver.getAddress().toString());
                OrderMessage orderMessage = new OrderMessage(BigInteger.valueOf(1),
                                orderFill.toBytes());

                TokenFallbackData fallbackData2 = new TokenFallbackData(swapOrder.toBytes(), "fill",
                                solver.getAddress());
                intent.invoke(user1, "tokenFallback", user1.getAddress(), amount,
                                fallbackData2.toBytes());
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
                SwapOrderDb swapOrder = new SwapOrderDb(id, emitter, srcNID,
                                dstNID, creator, destinationAddress,
                                swapToken, amount, toToken, toAmount, data);

                TokenFallbackData fallbackData = new TokenFallbackData(swapOrder.toBytes(), "swap", user1.getAddress());
                intent.invoke(user1, "tokenFallback", user1.getAddress(), amount,
                                fallbackData.toBytes());

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
                SwapOrderDb swapOrder = new SwapOrderDb(id, emitter, srcNID,
                                dstNID, creator, destinationAddress,
                                swapToken, amount, toToken, toAmount, data);

                TokenFallbackData fallbackData = new TokenFallbackData(swapOrder.toBytes(), "swap", user1.getAddress());
                intent.invoke(user1, "tokenFallback", user1.getAddress(), amount,
                                fallbackData.toBytes());

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
                SwapOrderDb swapOrder = new SwapOrderDb(id, emitter, srcNID,
                                dstNID, creator, destinationAddress,
                                swapToken, amount, toToken, toAmount, data);

                TokenFallbackData fallbackData = new TokenFallbackData(swapOrder.toBytes(), "swap", user1.getAddress());
                intent.invoke(user1, "tokenFallback", user1.getAddress(), amount,
                                fallbackData.toBytes());

                when(token.tokenContract.mock.balanceOf(solver.getAddress())).thenReturn(totalSupply);

                token.tokenContract.mock.approve(intent.getAddress(), amount);

                when(token.tokenContract.mock.allowance(user1.getAddress(),
                                intent.getAddress())).thenReturn(amount);

                OrderFill orderFill = new OrderFill(swapOrder.id, swapOrder.toBytes(),
                                solver.getAddress().toString());
                OrderMessage orderMessage = new OrderMessage(BigInteger.valueOf(1),
                                orderFill.toBytes());

                TokenFallbackData fallbackData2 = new TokenFallbackData(swapOrder.toBytes(), "fill",
                                solver.getAddress());
                intent.invoke(user1, "tokenFallback", user1.getAddress(), amount,
                                fallbackData2.toBytes());

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
                SwapOrderDb swapOrder = new SwapOrderDb(id, emitter, srcNID,
                                dstNID, creator, destinationAddress,
                                swapToken, amount, toToken, toAmount, data);

                TokenFallbackData fallbackData = new TokenFallbackData(swapOrder.toBytes(), "swap", user1.getAddress());
                intent.invoke(user1, "tokenFallback", user1.getAddress(), amount,
                                fallbackData.toBytes());

                when(token.tokenContract.mock.balanceOf(solver.getAddress())).thenReturn(totalSupply);

                token.tokenContract.mock.approve(intent.getAddress(), amount);

                when(token.tokenContract.mock.allowance(user1.getAddress(),
                                intent.getAddress())).thenReturn(amount);

                OrderFill orderFill = new OrderFill(swapOrder.id, swapOrder.toBytes(),
                                solver.getAddress().toString());
                OrderMessage orderMessage = new OrderMessage(BigInteger.valueOf(1),
                                orderFill.toBytes());

                TokenFallbackData fallbackData2 = new TokenFallbackData(swapOrder.toBytes(), "fill",
                                solver.getAddress());
                intent.invoke(user1, "tokenFallback", user1.getAddress(), amount,
                                fallbackData2.toBytes());

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
                SwapOrderDb swapOrder = new SwapOrderDb(id, emitter, srcNID,
                                dstNID, creator, destinationAddress,
                                swapToken, amount, toToken, toAmount, data);

                TokenFallbackData fallbackData = new TokenFallbackData(swapOrder.toBytes(), "swap", user1.getAddress());
                intent.invoke(user1, "tokenFallback", user1.getAddress(), amount,
                                fallbackData.toBytes());

                when(token.tokenContract.mock.balanceOf(solver.getAddress())).thenReturn(totalSupply);

                token.tokenContract.mock.approve(intent.getAddress(), amount);

                when(token.tokenContract.mock.allowance(user1.getAddress(),
                                intent.getAddress())).thenReturn(amount);

                OrderMessage orderMessage = new OrderMessage(OrderAction.CANCEL.getValue(),
                                swapOrder.toBytes());

                OrderFill orderFill = new OrderFill(swapOrder.id,
                                swapOrder.toBytes(),
                                swapOrder.creator);

                OrderMessage fillMessage = new OrderMessage(OrderAction.FILL.getValue(),
                                orderFill.toBytes());

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
}
