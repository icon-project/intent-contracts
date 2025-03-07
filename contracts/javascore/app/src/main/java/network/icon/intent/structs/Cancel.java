package network.icon.intent.structs;

import network.icon.intent.db.SwapOrderDb;
import score.ByteArrayObjectWriter;
import score.Context;
import score.ObjectReader;
import score.ObjectWriter;

public class Cancel {
    public byte[] orderBytes;

    public Cancel(byte[] orderBytes) {
        this.orderBytes = orderBytes;
    }


    public static void writeObject(ObjectWriter writer, Cancel obj) {
        obj.writeObject(writer);
    }

    public void writeObject(ObjectWriter writer) {
        writer.beginList(1);
        writer.write(this.orderBytes);
        writer.end();
    }

    public static Cancel readObject(ObjectReader reader) {
        reader.beginList();
        Cancel obj = new Cancel(reader.readByteArray());
        reader.end();
        return obj;
    }

    public byte[] toBytes() {
        ByteArrayObjectWriter writer = Context.newByteArrayObjectWriter("RLPn");
        Cancel.writeObject(writer, this);
        return writer.toByteArray();
    }

    public static Cancel fromBytes(byte[] bytes) {
        ObjectReader reader = Context.newByteArrayObjectReader("RLPn", bytes);
        return readObject(reader);
    }

}
