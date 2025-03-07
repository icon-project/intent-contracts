package intent_contracts;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.HexFormat;

import org.junit.jupiter.api.Test;

import com.iconloop.score.test.TestBase;
import score.Context;

import network.icon.intent.constants.Constant.OrderAction;
import network.icon.intent.db.SwapOrderDb;
import network.icon.intent.structs.Cancel;
import network.icon.intent.structs.OrderFill;
import network.icon.intent.structs.OrderMessage;
import score.ByteArrayObjectWriter;

import static org.junit.jupiter.api.Assertions.*;

public class EncodingsTest extends TestBase {

        @Test
        void testSwapOrder() {

                BigInteger id = BigInteger.valueOf(1);
                String emitter = "0xbe6452d4d6c61cee97d3";
                String srcNID = "Ethereum";
                String dstNID = "Polygon";
                String creator = "0x3e36eddd65e239222e7e67";
                String destinationAddress = "0xd2c6218b875457a41b6fb7964e";
                String token = "0x14355340e857912188b7f202d550222487";
                BigInteger amount = BigInteger.valueOf(1000);
                String toToken = "0x91a4728b517484f0f610de7b";
                BigInteger toAmount = BigInteger.valueOf(900);
                byte[] data = "".getBytes();

                SwapOrderDb swapOrder1 = new SwapOrderDb(id, emitter, srcNID, dstNID, creator, destinationAddress,
                                token,
                                amount,
                                toToken, toAmount, data);

                byte[] expectedBytes = HexFormat.of().parseHex("f8a601963078626536343532643464366336316365653937643388457468657265756d87506f6c79676f6e983078336533366564646436356532333932323265376536379c30786432633632313862383735343537613431623666623739363465a43078313433353533343065383537393132313838623766323032643535303232323438378203e89a307839316134373238623531373438346630663631306465376282038480");

                assertTrue(Arrays.equals(expectedBytes, swapOrder1.toBytes()));

                SwapOrderDb order2 = new SwapOrderDb(
                                BigInteger.valueOf(1),
                                "0xbe6452d4d6c61cee97d3",
                                "Ethereum",
                                "Polygon",
                                "0x3e36eddd65e239222e7e67",
                                "0xd2c6218b875457a41b6fb7964e",
                                "0x14355340e857912188b7f202d550222487",
                                BigInteger.valueOf(100000).multiply(BigInteger.valueOf(10).pow(22)),
                                "0x91a4728b517484f0f610de7b",
                                BigInteger.valueOf(900).multiply(BigInteger.valueOf(10).pow(7)),
                                HexFormat.of().parseHex("6c449988e2f33302803c93f8287dc1d8cb33848a"));
                String expectedBytes2 = "f8c701963078626536343532643464366336316365653937643388457468657265756d87506f6c79676f6e983078336533366564646436356532333932323265376536379c30786432633632313862383735343537613431623666623739363465a43078313433353533343065383537393132313838623766323032643535303232323438378c033b2e3c9fd0803ce80000009a3078393161343732386235313734383466306636313064653762850218711a00946c449988e2f33302803c93f8287dc1d8cb33848a";
                assertEquals(expectedBytes2, HexFormat.of().formatHex(order2.toBytes()));
        }

        @Test
        void testOrderMessage() {
                OrderMessage orderMessage = new OrderMessage(OrderAction.FILL.getValue(),
                                HexFormat.of().parseHex("6c449988e2f33302803c93f8287dc1d8cb33848a"));

                byte[] expectedBytes = HexFormat.of().parseHex("d601946c449988e2f33302803c93f8287dc1d8cb33848a");
                assertArrayEquals(expectedBytes, orderMessage.toBytes());

                OrderMessage cancelMessage = new OrderMessage(OrderAction.CANCEL.getValue(),
                                HexFormat.of().parseHex("6c449988e2f33302803c93f8287dc1d8cb33848a"));

                expectedBytes = HexFormat.of().parseHex("d602946c449988e2f33302803c93f8287dc1d8cb33848a");
                assertTrue(Arrays.equals(expectedBytes, cancelMessage.toBytes()));
        }

        @Test
        void testOrderFill() {
                OrderFill orderFill = new OrderFill(BigInteger.valueOf(1),
                                HexFormat.of().parseHex("6c449988e2f33302803c93f8287dc1d8cb33848a"),
                                "0xcb0a6bbccfccde6be9f10ae781b9d9b00d6e63");

                byte[] expectedBytes = HexFormat.of().parseHex(
                                "f83f01946c449988e2f33302803c93f8287dc1d8cb33848aa830786362306136626263636663636465366265396631306165373831623964396230306436653633");
                assertTrue(Arrays.equals(expectedBytes, orderFill.toBytes()));

                OrderFill orderFill2 = new OrderFill(BigInteger.valueOf(2),
                                HexFormat.of().parseHex("cb0a6bbccfccde6be9f10ae781b9d9b00d6e63"),
                                "0x6c449988e2f33302803c93f8287dc1d8cb33848a");

                expectedBytes = HexFormat.of().parseHex(
                                "f8400293cb0a6bbccfccde6be9f10ae781b9d9b00d6e63aa307836633434393938386532663333333032383033633933663832383764633164386362333338343861");
                assertTrue(Arrays.equals(expectedBytes, orderFill2.toBytes()));
        }

        @Test
        void testOrderCancel() {
                byte[] orderBytes = HexFormat.of().parseHex("6c449988e2f33302803c93f8287dc1d8cb33848a");
                byte[] expectedBytes = HexFormat.of().parseHex("d5946c449988e2f33302803c93f8287dc1d8cb33848a");
                ByteArrayObjectWriter writer = Context.newByteArrayObjectWriter("RLPn");
                writer.beginList(1);
                writer.write(orderBytes);
                writer.end();
                byte[] serializedBytes = writer.toByteArray();
                assertTrue(Arrays.equals(expectedBytes, serializedBytes));
        }


        public static String byteArrayToHex(byte[] byteArray) {
                StringBuilder hexString = new StringBuilder();
                for (byte b : byteArray) {
                        hexString.append(String.format("%02X", b));
                }
                return hexString.toString();
        }
}
