use super::*;
use anchor_lang::prelude::borsh;

#[derive(Debug, Clone, PartialEq, Eq, AnchorSerialize, AnchorDeserialize)]
pub enum MessageType {
    FILL = 1,
    CANCEL = 2,
}

#[derive(Debug, Clone, PartialEq, Eq, AnchorSerialize, AnchorDeserialize)]
pub struct OrderMessage {
    /// Type of message (Fill or Cancel)
    message_type: MessageType,
    /// Encoded message data
    message: Vec<u8>,
}

impl OrderMessage {
    pub fn new(message_type: MessageType, message: Vec<u8>) -> Self {
        Self {
            message_type,
            message,
        }
    }

    pub fn message_type(&self) -> MessageType {
        self.message_type.clone()
    }

    pub fn message(&self) -> Vec<u8> {
        self.message.clone()
    }

    pub fn encode(&self) -> Vec<u8> {
        rlp::encode(self).to_vec()
    }
}

impl From<u32> for MessageType {
    fn from(value: u32) -> Self {
        match value {
            1 => MessageType::FILL,
            2 => MessageType::CANCEL,
            _ => panic!("Invalid message type"),
        }
    }
}

impl From<MessageType> for u32 {
    fn from(value: MessageType) -> Self {
        match value {
            MessageType::FILL => 1,
            MessageType::CANCEL => 2,
        }
    }
}

impl Encodable for OrderMessage {
    fn rlp_append(&self, stream: &mut rlp::RlpStream) {
        let message_type: u32 = self.message_type().into();

        stream.begin_list(2);
        stream.append(&message_type);
        stream.append(&self.message());
    }
}

impl Decodable for OrderMessage {
    fn decode(rlp: &rlp::Rlp) -> Result<Self, rlp::DecoderError> {
        let message_type: u32 = rlp.val_at(0)?;
        let message: Vec<u8> = rlp.val_at(1)?;

        Ok(Self {
            message_type: message_type.into(),
            message,
        })
    }
}

impl TryFrom<&Vec<u8>> for OrderMessage {
    type Error = IntentError;
    fn try_from(value: &Vec<u8>) -> Result<Self, Self::Error> {
        let rlp = rlp::Rlp::new(value as &[u8]);
        Self::decode(&rlp).map_err(|_| IntentError::DecodeFailed)
    }
}

impl TryFrom<&[u8]> for OrderMessage {
    type Error = IntentError;
    fn try_from(value: &[u8]) -> Result<Self, Self::Error> {
        let rlp = rlp::Rlp::new(value);
        Self::decode(&rlp).map_err(|_| IntentError::DecodeFailed)
    }
}

#[test]
fn test_order_message_decode_1() {
    let data = OrderMessage::new(
        MessageType::CANCEL,
        hex::decode("6c449988e2f33302803c93f8287dc1d8cb33848a").unwrap(),
    );
    let expected = hex::decode("d602946c449988e2f33302803c93f8287dc1d8cb33848a").unwrap();
    let decoded: OrderMessage = OrderMessage::try_from(&expected).unwrap();

    assert_eq!(data.encode(), expected);
    assert_eq!(decoded, data)
}

#[test]
fn test_order_message_decode_2() {
    let data = OrderMessage::new(
        MessageType::FILL,
        hex::decode("6c449988e2f33302803c93f8287dc1d8cb33848a").unwrap(),
    );
    let expected = hex::decode("d601946c449988e2f33302803c93f8287dc1d8cb33848a").unwrap();
    let decoded: OrderMessage = OrderMessage::try_from(&expected).unwrap();

    assert_eq!(data.encode(), expected);
    assert_eq!(decoded, data);
}
