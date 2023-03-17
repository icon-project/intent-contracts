package ibc.icon.structs.proto.core.connection;

import score.ByteArrayObjectWriter;
import score.Context;
import score.ObjectReader;
import score.ObjectWriter;
import scorex.util.ArrayList;

import java.math.BigInteger;
import java.util.List;

// ConnectionEnd defines a stateful object on a chain connected to another
// separate one.
// NOTE: there must only be 2 defined ConnectionEnds to establish
// a connection between two chains.
public class ConnectionEnd {
    // State defines if a connection is in one of the following states:
    // INIT, TRYOPEN, OPEN or UNINITIALIZED.
    public enum State {
        STATE_UNINITIALIZED_UNSPECIFIED,
        // A connection end has just started the opening handshake.
        STATE_INIT,
        // A connection end has acknowledged the handshake step on the counterparty
        // chain.
        STATE_TRYOPEN,
        // A connection end has completed the handshake.
        STATE_OPEN
    }

    // client associated with this connection.
    private String clientId;

    // IBC version which can be utilised to determine encodings or protocols for
    // channels or packets utilising this connection.
    private Version[] versions;

    // current state of the connection end.
    private String state;

    // counterparty chain associated with this connection.
    private Counterparty counterparty;

    // delay period that must pass before a consensus state can be used for
    // packet-verification NOTE: delay period logic is only implemented by some
    // clients.
    private BigInteger delayPeriod;

    public static void writeObject(ObjectWriter writer, ConnectionEnd obj) {
        obj.writeObject(writer);
    }

    public static ConnectionEnd readObject(ObjectReader reader) {
        ConnectionEnd obj = new ConnectionEnd();
        reader.beginList();
        obj.clientId = reader.readString();

        reader.beginList();
        Version[] versions = null;
        List<Version> versionsList = new ArrayList<>();
        while (reader.hasNext()) {
            byte[] versionElementBytes = reader.readNullable(byte[].class);
            if (versionElementBytes != null) {
                ObjectReader versionElementReader = Context.newByteArrayObjectReader("RLPn", versionElementBytes);
                versionsList.add(versionElementReader.read(Version.class));
            }
        }

        versions = new Version[versionsList.size()];
        for (int i = 0; i < versionsList.size(); i++) {
            versions[i] = (Version) versionsList.get(i);
        }
        obj.versions = versions;
        reader.end();

        obj.state = reader.readString();
        obj.counterparty = reader.read(Counterparty.class);
        obj.delayPeriod = reader.readBigInteger();
        reader.end();
        return obj;
    }

    public void writeObject(ObjectWriter writer) {
        writer.beginList(5);
        writer.write(this.clientId);

        Version[] versions = this.getVersions();
        if (versions != null) {
            writer.beginNullableList(versions.length);
            for (Version v : versions) {
                ByteArrayObjectWriter vWriter = Context.newByteArrayObjectWriter("RLPn");
                vWriter.write(v);
                writer.write(vWriter.toByteArray());
            }
            writer.end();
        } else {
            writer.writeNull();
        }

        writer.write(this.state);
        writer.write(this.counterparty);
        writer.write(this.delayPeriod);

        writer.end();
    }

    public static ConnectionEnd fromBytes(byte[] bytes) {
        ObjectReader reader = Context.newByteArrayObjectReader("RLPn", bytes);
        return ConnectionEnd.readObject(reader);
    }

    public byte[] toBytes() {
        ByteArrayObjectWriter writer = Context.newByteArrayObjectWriter("RLPn");
        ConnectionEnd.writeObject(writer, this);
        return writer.toByteArray();
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public Version[] getVersions() {
        return versions;
    }

    public void setVersions(Version[] versions) {
        this.versions = versions;
    }

    public State connectionState() {
        return State.valueOf(state);
    }

    public void setState(State state) {
        this.state = state.toString();
    }

    public void setState(String state) {
        this.state = state;
    }

    public String getState() {
        return state;
    }

    public Counterparty getCounterparty() {
        return counterparty;
    }

    public void setCounterparty(Counterparty counterparty) {
        this.counterparty = counterparty;
    }

    public BigInteger getDelayPeriod() {
        return delayPeriod;
    }

    public void setDelayPeriod(BigInteger delayPeriod) {
        this.delayPeriod = delayPeriod;
    }
}