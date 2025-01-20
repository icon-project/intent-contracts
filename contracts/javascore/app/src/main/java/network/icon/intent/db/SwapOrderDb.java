package network.icon.intent.db;

import java.math.BigInteger;
import score.ByteArrayObjectWriter;
import score.Context;
import score.ObjectReader;
import score.ObjectWriter;

public class SwapOrderDb {
    public BigInteger id; // unique ID
    public String emitter;// Address of emitter contract
    public String srcNID; // Source Network ID
    public String dstNID; // Destination Network ID
    public String creator; // The user who created the order
    public String destinationAddress; // Destination address on the destination network
    public String token; // Token to be swapped
    public BigInteger amount; // Amount of the token to be swapped
    public String toToken; // Token to receive on the destination network
    public BigInteger toAmount; // Minimum amount of the toToken to receive
    public byte[] data; // Additional data (if any) for future use (is this the right type?)

    public SwapOrderDb(BigInteger id, String emitter, String srcNID, String dstNID, String creator,
            String destinationAddress, String token, BigInteger amount, String toToken, BigInteger toAmount,
            byte[] data) {
        this.id = id;
        this.emitter = emitter;
        this.srcNID = srcNID;
        this.dstNID = dstNID;
        this.creator = creator;
        this.destinationAddress = destinationAddress;
        this.token = token;
        this.amount = amount;
        this.toToken = toToken;
        this.toAmount = toAmount;
        this.data = data;
    }

    private SwapOrderDb() {
    }

    public static void writeObject(ObjectWriter writer, SwapOrderDb obj) {
        obj.writeObject(writer);
    }

    public static SwapOrderDb readObject(ObjectReader reader) {
        SwapOrderDb obj = new SwapOrderDb();
        reader.beginList();
        obj.id = reader.readBigInteger();
        obj.emitter = reader.readString();
        obj.srcNID = reader.readString();
        obj.dstNID = reader.readString();
        obj.creator = reader.readString();
        obj.destinationAddress = reader.readString();
        obj.token = reader.readString();
        obj.amount = reader.readBigInteger();
        obj.toToken = reader.readString();
        obj.toAmount = reader.readBigInteger();
        obj.data = reader.readByteArray();
        reader.end();
        return obj;
    }

    public void writeObject(ObjectWriter writer) {
        writer.beginList(11);
        writer.write(this.id);
        writer.write(this.emitter);
        writer.write(this.srcNID);
        writer.write(this.dstNID);
        writer.write(this.creator);
        writer.write(this.destinationAddress);
        writer.write(this.token);
        writer.write(this.amount);
        writer.write(this.toToken);
        writer.write(this.toAmount);
        writer.write(this.data);
        writer.end();
    }

    public byte[] toBytes() {
        ByteArrayObjectWriter writer = Context.newByteArrayObjectWriter("RLPn");
        SwapOrderDb.writeObject(writer, this);
        return writer.toByteArray();
    }

    public static SwapOrderDb fromBytes(byte[] bytes) {
        ObjectReader reader = Context.newByteArrayObjectReader("RLPn", bytes);
        return readObject(reader);
    }

    public SwapOrderDb fromBytesAndProperties(byte[] bytes, String token, BigInteger amount) {
        ObjectReader reader = Context.newByteArrayObjectReader("RLPn", bytes);
        this.token = token;
        this.amount = amount;
        this.emitter = Context.getAddress().toString();
        this.creator = Context.getCaller().toString();
        return readObject(reader);
    }

    public BigInteger getId() {
        return id;
    }

    public void setId(BigInteger id) {
        this.id = id;
    }

    public String getEmitter() {
        return emitter;
    }

    public void setEmitter(String emitter) {
        this.emitter = emitter;
    }

    public String getSrcNID() {
        return srcNID;
    }

    public void setSrcNID(String srcNID) {
        this.srcNID = srcNID;
    }

    public String getDstNID() {
        return dstNID;
    }

    public void setDstNID(String dstNID) {
        this.dstNID = dstNID;
    }

    public String getCreator() {
        return creator;
    }

    public void setCreator(String creator) {
        this.creator = creator;
    }

    public String getDestinationAddress() {
        return destinationAddress;
    }

    public void setDestinationAddress(String destinationAddress) {
        this.destinationAddress = destinationAddress;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public BigInteger getAmount() {
        return amount;
    }

    public void setAmount(BigInteger amount) {
        this.amount = amount;
    }

    public String getToToken() {
        return toToken;
    }

    public void setToToken(String toToken) {
        this.toToken = toToken;
    }

    public BigInteger getToAmount() {
        return toAmount;
    }

    public void setToAmount(BigInteger toAmount) {
        this.toAmount = toAmount;
    }

    public byte[] getData() {
        return data;
    }

    public void setData(byte[] data) {
        this.data = data;
    }
}
