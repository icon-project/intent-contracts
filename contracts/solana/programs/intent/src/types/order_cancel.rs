use super::*;

#[derive(Debug, Clone, PartialEq, Eq, AnchorSerialize, AnchorDeserialize)]
pub struct Cancel {
    /// Encoded order data
    order_bytes: Vec<u8>,
}

impl Cancel {
    pub fn new(order_bytes: Vec<u8>) -> Self {
        Self { order_bytes }
    }

    pub fn order_bytes(&self) -> Vec<u8> {
        self.order_bytes.clone()
    }

    pub fn encode(&self) -> Vec<u8> {
        rlp::encode(self).to_vec()
    }
}

impl Encodable for Cancel {
    fn rlp_append(&self, stream: &mut rlp::RlpStream) {
        stream.begin_list(1);
        stream.append(&self.order_bytes);
    }
}

impl Decodable for Cancel {
    fn decode(rlp: &rlp::Rlp) -> Result<Self, rlp::DecoderError> {
        let order_bytes: Vec<u8> = rlp.val_at(0)?;

        Ok(Self { order_bytes })
    }
}

impl TryFrom<&Vec<u8>> for Cancel {
    type Error = IntentError;
    fn try_from(value: &Vec<u8>) -> Result<Self, Self::Error> {
        let rlp = rlp::Rlp::new(value as &[u8]);
        Self::decode(&rlp).map_err(|_| IntentError::DecodeFailed)
    }
}

impl TryFrom<&[u8]> for Cancel {
    type Error = IntentError;
    fn try_from(value: &[u8]) -> Result<Self, Self::Error> {
        let rlp = rlp::Rlp::new(value);
        Self::decode(&rlp).map_err(|_| IntentError::DecodeFailed)
    }
}

#[test]
fn test_order_cancel_decode() {
    let data = Cancel::new(hex::decode("6c449988e2f33302803c93f8287dc1d8cb33848a").unwrap());
    let expected = hex::decode("d5946c449988e2f33302803c93f8287dc1d8cb33848a").unwrap();
    let decoded: Cancel = Cancel::try_from(&expected).unwrap();

    assert_eq!(data.encode(), expected);
    assert_eq!(decoded, data)
}
