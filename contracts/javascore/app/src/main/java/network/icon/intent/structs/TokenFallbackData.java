package network.icon.intent.structs;

import score.Address;
import score.ByteArrayObjectWriter;
import score.Context;
import score.ObjectReader;
import score.ObjectWriter;

public class TokenFallbackData {
    public byte[] swapOrderData;
    public String type;
    public String solver;

    public TokenFallbackData(byte[] _swapOrderData, String _type, String _solver) {
        this.swapOrderData = _swapOrderData;
        this.type = _type;
        this.solver = _solver;
    }

    private TokenFallbackData() {
    }

    public static void writeObject(ObjectWriter writer, TokenFallbackData obj) {
        obj.writeObject(writer);
    }

    public void writeObject(ObjectWriter writer) {
        writer.beginList(3);
        writer.write(this.swapOrderData);
        writer.write(this.type);
        writer.write(this.solver);
        writer.end();
    }

    public static TokenFallbackData readObject(ObjectReader reader) {
        TokenFallbackData obj = new TokenFallbackData();
        reader.beginList();
        obj.swapOrderData = reader.readByteArray();
        obj.type = reader.readString();
        obj.solver = reader.readString();
        reader.end();
        return obj;
    }

    public byte[] toBytes() {
        ByteArrayObjectWriter writer = Context.newByteArrayObjectWriter("RLPn");
        TokenFallbackData.writeObject(writer, this);
        return writer.toByteArray();
    }

    public static TokenFallbackData fromBytes(byte[] bytes) {
        ObjectReader reader = Context.newByteArrayObjectReader("RLPn", bytes);
        return readObject(reader);
    }

    public byte[] getSwapOrder() {
        return swapOrderData;
    }

    public void setSwapOrder(byte[] _swapOrderData) {
        this.swapOrderData = _swapOrderData;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getSolver() {
        return solver;
    }

    public void setSolver(String solver) {
        this.solver = solver;
    }
}
