use super::*;
use common::rlp::{self, Decodable, DecoderError, Encodable, RlpStream};
use cosmwasm_std::Addr;
use cw_storage_plus::{Key, KeyDeserialize, PrimaryKey};
use serde::Serialize;

pub const ORDER_FILL: u8 = 1;
pub const ORDER_CANCEL: u8 = 2;

#[cw_serde]
pub enum StorageKey {
    DepositId,
    Nid,
    ProtocolFee,
    FeeHandler,
    Orders,
    PendingOrderAmount,
    PendingFills,
    FinishedOrders,
    ConnectionSN,
    Receipts,
    Relayer,
}

impl StorageKey {
    pub fn as_str(&self) -> &'static str {
        match self {
            StorageKey::DepositId => "deposit_id",
            StorageKey::Nid => "nid",
            StorageKey::ProtocolFee => "protocol_fee",
            StorageKey::FeeHandler => "fee_handler",
            StorageKey::Orders => "orders",
            StorageKey::PendingOrderAmount => "pending_order_amount",
            StorageKey::PendingFills => "pending_fills",
            StorageKey::FinishedOrders => "finished_orders",
            StorageKey::ConnectionSN => "conn_sn",
            StorageKey::Receipts => "receipts",
            StorageKey::Relayer => "relayer",
        }
    }
}

#[cw_serde]
pub struct SwapOrder {
    pub id: u128,
    pub emitter: String,
    pub src_nid: String,
    pub dst_nid: String,
    pub creator: String,
    pub destination_address: String,
    pub token: String,
    pub amount: u128,
    pub to_token: String,
    pub min_receive: u128,
    pub data: Vec<u8>,
}

impl SwapOrder {
    pub fn new(
        id: u128,
        emitter: String,
        src_nid: String,
        dst_nid: String,
        creator: String,
        destination_address: String,
        token: String,
        amount: u128,
        to_token: String,
        min_receive: u128,
        data: Vec<u8>,
    ) -> Self {
        Self {
            id,
            emitter,
            src_nid,
            dst_nid,
            creator,
            destination_address,
            token,
            amount,
            to_token,
            min_receive,
            data,
        }
    }
}

impl Encodable for SwapOrder {
    fn rlp_append(&self, s: &mut RlpStream) {
        s.begin_list(11);
        s.append(&self.id);
        s.append(&self.emitter);
        s.append(&self.src_nid);
        s.append(&self.dst_nid);
        s.append(&self.creator);
        s.append(&self.destination_address);
        s.append(&self.token);
        s.append(&self.amount);
        s.append(&self.to_token);
        s.append(&self.min_receive);
        s.append(&self.data);
    }
}

impl Decodable for SwapOrder {
    fn decode(rlp: &rlp::Rlp) -> Result<Self, DecoderError> {
        Ok(SwapOrder {
            id: rlp.val_at(0)?,
            emitter: rlp.val_at(1)?,
            src_nid: rlp.val_at(2)?,
            dst_nid: rlp.val_at(3)?,
            creator: rlp.val_at(4)?,
            destination_address: rlp.val_at(5)?,
            token: rlp.val_at(6)?,
            amount: rlp.val_at(7)?,
            to_token: rlp.val_at(8)?,
            min_receive: rlp.val_at(9)?,
            data: rlp.val_at(10)?,
        })
    }
}

pub struct OrderMsg {
    pub msg_type: u8,
    pub message: Vec<u8>,
}

impl Encodable for OrderMsg {
    fn rlp_append(&self, stream: &mut RlpStream) {
        stream.begin_list(2);
        stream.append(&Into::<u8>::into(self.msg_type));
        stream.append(&self.message);
    }
}

impl Decodable for OrderMsg {
    fn decode(rlp: &rlp::Rlp) -> Result<Self, DecoderError> {
        let msg_type: u8 = rlp.val_at(0)?;
        let message: Vec<u8> = rlp.val_at(1)?;
        Ok(OrderMsg { msg_type, message })
    }
}

pub struct OrderFill {
    pub id: u128,
    pub order_bytes: Vec<u8>,
    pub solver_address: String,
    pub amount: u128,
    pub closed: bool,
}

impl Encodable for OrderFill {
    fn rlp_append(&self, stream: &mut RlpStream) {
        stream.begin_list(5);
        stream.append(&self.id);
        stream.append(&self.order_bytes);
        stream.append(&self.solver_address);
        stream.append(&self.amount);
        stream.append(&self.closed);
    }
}

impl Decodable for OrderFill {
    fn decode(rlp: &rlp::Rlp) -> Result<Self, DecoderError> {
        Ok(OrderFill {
            id: rlp.val_at(0)?,
            order_bytes: rlp.val_at(1)?,
            solver_address: rlp.val_at(2)?,
            amount: rlp.val_at(3)?,
            closed: rlp.val_at(4)?,
        })
    }
}

pub struct OrderCancel {
    pub order_bytes: Vec<u8>,
}

impl Encodable for OrderCancel {
    fn rlp_append(&self, s: &mut RlpStream) {
        s.begin_list(1);
        s.append(&self.order_bytes);
    }
}

impl Decodable for OrderCancel {
    fn decode(rlp: &rlp::Rlp) -> Result<Self, DecoderError> {
        Ok(OrderCancel {
            order_bytes: rlp.val_at(0)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_order_msg_encoding_fill() {
        let msg = OrderMsg {
            msg_type: ORDER_FILL,
            message: hex::decode("6c449988e2f33302803c93f8287dc1d8cb33848a").unwrap(),
        };
        assert!(
            msg.rlp_bytes()
                == hex::decode("d601946c449988e2f33302803c93f8287dc1d8cb33848a").unwrap()
        )
    }

    #[test]
    fn test_order_msg_encoding_cancel() {
        let msg = OrderMsg {
            msg_type: ORDER_CANCEL,
            message: hex::decode("6c449988e2f33302803c93f8287dc1d8cb33848a").unwrap(),
        };
        assert!(
            msg.rlp_bytes()
                == hex::decode("d602946c449988e2f33302803c93f8287dc1d8cb33848a").unwrap()
        )
    }

    #[test]
    fn test_order_fill_encoding() {
        let fill = OrderFill {
            id: 1,
            order_bytes: hex::decode("6c449988e2f33302803c93f8287dc1d8cb33848a").unwrap(),
            solver_address: "0xcb0a6bbccfccde6be9f10ae781b9d9b00d6e63".to_string(),
            amount: 500,
            closed: true,
        };
        assert!(fill.rlp_bytes()==hex::decode("f84301946c449988e2f33302803c93f8287dc1d8cb33848aa8307863623061366262636366636364653662653966313061653738316239643962303064366536338201f401").unwrap());
    }

    #[test]
    fn test_order_fill_encoding2() {
        let fill = OrderFill {
            id: 2,
            order_bytes: hex::decode("cb0a6bbccfccde6be9f10ae781b9d9b00d6e63").unwrap(),
            solver_address: "0x6c449988e2f33302803c93f8287dc1d8cb33848a".to_string(),
            amount: 750 * 1000000000000000000,
            closed: false,
        };
        assert!(fill.rlp_bytes()==hex::decode("f84b0293cb0a6bbccfccde6be9f10ae781b9d9b00d6e63aa3078366334343939383865326633333330323830336339336638323837646331643863623333383438618928a857425466f8000000").unwrap());
    }

    #[test]
    fn test_order_cancel_encoding() {}
}
