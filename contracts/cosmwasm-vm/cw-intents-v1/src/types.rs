use super::*;
use common::rlp::{self, Decodable, DecoderError, Encodable, RlpStream};

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
    pub to_amount: u128,
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
        to_amount: u128,
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
            to_amount,
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
        s.append(&self.to_amount);
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
            to_amount: rlp.val_at(9)?,
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
}

impl Encodable for OrderFill {
    fn rlp_append(&self, stream: &mut RlpStream) {
        stream.begin_list(3);
        stream.append(&self.id);
        stream.append(&self.order_bytes);
        stream.append(&self.solver_address);
    }
}

impl Decodable for OrderFill {
    fn decode(rlp: &rlp::Rlp) -> Result<Self, DecoderError> {
        Ok(OrderFill {
            id: rlp.val_at(0)?,
            order_bytes: rlp.val_at(1)?,
            solver_address: rlp.val_at(2)?,
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
        };
        assert!(fill.rlp_bytes()==hex::decode("f83f01946c449988e2f33302803c93f8287dc1d8cb33848aa830786362306136626263636663636465366265396631306165373831623964396230306436653633").unwrap());
    }

    #[test]
    fn test_order_fill_encoding2() {
        let fill = OrderFill {
            id: 2,
            order_bytes: hex::decode("cb0a6bbccfccde6be9f10ae781b9d9b00d6e63").unwrap(),
            solver_address: "0x6c449988e2f33302803c93f8287dc1d8cb33848a".to_string(),
        };
        assert!(fill.rlp_bytes()==hex::decode("f8400293cb0a6bbccfccde6be9f10ae781b9d9b00d6e63aa307836633434393938386532663333333032383033633933663832383764633164386362333338343861").unwrap());
    }

    #[test]
    fn test_order_cancel_encoding() {
        let cancel = OrderCancel {
            order_bytes: hex::decode("6c449988e2f33302803c93f8287dc1d8cb33848a").unwrap(),
        };
        assert!(
            cancel.rlp_bytes()
                == hex::decode("d5946c449988e2f33302803c93f8287dc1d8cb33848a").unwrap()
        );
    }

    #[test]
    fn test_swap_order_encoding() {
        let order = SwapOrder {
            id: 1,
            emitter: "0xbe6452d4d6c61cee97d3".to_string(),
            src_nid: "Ethereum".to_string(),
            dst_nid: "Polygon".to_string(),
            creator: "0x3e36eddd65e239222e7e67".to_string(),
            destination_address: "0xd2c6218b875457a41b6fb7964e".to_string(),
            token: "0x14355340e857912188b7f202d550222487".to_string(),
            amount: 1000,
            to_token: "0x91a4728b517484f0f610de7b".to_string(),
            to_amount: 900,
            data: vec![],
        };
        assert!(order.rlp_bytes()==hex::decode("f8a601963078626536343532643464366336316365653937643388457468657265756d87506f6c79676f6e983078336533366564646436356532333932323265376536379c30786432633632313862383735343537613431623666623739363465a43078313433353533343065383537393132313838623766323032643535303232323438378203e89a307839316134373238623531373438346630663631306465376282038480").unwrap());

        let order = SwapOrder {
            id: 1,
            emitter: "0xbe6452d4d6c61cee97d3".to_string(),
            src_nid: "Ethereum".to_string(),
            dst_nid: "Polygon".to_string(),
            creator: "0x3e36eddd65e239222e7e67".to_string(),
            destination_address: "0xd2c6218b875457a41b6fb7964e".to_string(),
            token: "0x14355340e857912188b7f202d550222487".to_string(),
            amount: 100000 * 10000000000000000000000,
            to_token: "0x91a4728b517484f0f610de7b".to_string(),
            to_amount: 900 * 10000000,
            data: hex::decode("6c449988e2f33302803c93f8287dc1d8cb33848a").unwrap(),
        };
        assert!(order.rlp_bytes()==hex::decode("f8c701963078626536343532643464366336316365653937643388457468657265756d87506f6c79676f6e983078336533366564646436356532333932323265376536379c30786432633632313862383735343537613431623666623739363465a43078313433353533343065383537393132313838623766323032643535303232323438378c033b2e3c9fd0803ce80000009a3078393161343732386235313734383466306636313064653762850218711a00946c449988e2f33302803c93f8287dc1d8cb33848a").unwrap());
    }
}
