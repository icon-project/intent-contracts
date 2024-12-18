use super::*;

#[derive(Debug, Clone, PartialEq, Eq, AnchorSerialize, AnchorDeserialize)]
pub struct OrderFill {
    /// ID of the order being filled
    id: u128,
    /// Encoded order data
    order_bytes: Vec<u8>,
    /// Address of the solver filling the order
    solver: String,
}

impl OrderFill {
    pub fn new(id: u128, order_bytes: Vec<u8>, solver: String) -> Self {
        Self {
            id,
            order_bytes,
            solver,
        }
    }

    pub fn id(&self) -> u128 {
        self.id
    }

    pub fn order_bytes(&self) -> Vec<u8> {
        self.order_bytes.clone()
    }

    pub fn solver(&self) -> String {
        self.solver.clone()
    }

    pub fn encode(&self) -> Vec<u8> {
        rlp::encode(self).to_vec()
    }
}

impl Encodable for OrderFill {
    fn rlp_append(&self, stream: &mut rlp::RlpStream) {
        stream.begin_list(3);
        stream.append(&self.id());
        stream.append(&self.order_bytes());
        stream.append(&self.solver());
    }
}

impl Decodable for OrderFill {
    fn decode(rlp: &rlp::Rlp) -> Result<Self, rlp::DecoderError> {
        let id: u128 = rlp.val_at(0)?;
        let order_bytes: Vec<u8> = rlp.val_at(1)?;
        let solver: String = rlp.val_at(2)?;

        Ok(Self {
            id,
            order_bytes,
            solver,
        })
    }
}

impl TryFrom<&Vec<u8>> for OrderFill {
    type Error = IntentError;
    fn try_from(value: &Vec<u8>) -> Result<Self, Self::Error> {
        let rlp = rlp::Rlp::new(value as &[u8]);
        Self::decode(&rlp).map_err(|_| IntentError::DecodeFailed)
    }
}

impl TryFrom<&[u8]> for OrderFill {
    type Error = IntentError;
    fn try_from(value: &[u8]) -> Result<Self, Self::Error> {
        let rlp = rlp::Rlp::new(value);
        Self::decode(&rlp).map_err(|_| IntentError::DecodeFailed)
    }
}

#[test]
fn test_order_fill_decode_1() {
    let data = OrderFill::new(
        1,
        hex::decode("6c449988e2f33302803c93f8287dc1d8cb33848a").unwrap(),
        "0xcb0a6bbccfccde6be9f10ae781b9d9b00d6e63".to_string(),
    );
    let expected = hex::decode("f83f01946c449988e2f33302803c93f8287dc1d8cb33848aa830786362306136626263636663636465366265396631306165373831623964396230306436653633").unwrap();
    let decoded: OrderFill = OrderFill::try_from(&expected).unwrap();

    assert_eq!(data.encode(), expected);
    assert_eq!(decoded, data)
}

#[test]
fn test_order_fill_decode_2() {
    let data = OrderFill::new(
        2,
        hex::decode("cb0a6bbccfccde6be9f10ae781b9d9b00d6e63").unwrap(),
        "0x6c449988e2f33302803c93f8287dc1d8cb33848a".to_string(),
    );
    let expected = hex::decode("f8400293cb0a6bbccfccde6be9f10ae781b9d9b00d6e63aa307836633434393938386532663333333032383033633933663832383764633164386362333338343861").unwrap();
    let decoded: OrderFill = OrderFill::try_from(&expected).unwrap();

    assert_eq!(data.encode(), expected);
    assert_eq!(decoded, data)
}
