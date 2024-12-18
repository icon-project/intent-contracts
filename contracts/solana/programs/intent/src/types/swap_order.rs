use anchor_lang::solana_program::keccak;

use super::*;

#[derive(Debug, Clone, PartialEq, Eq, AnchorSerialize, AnchorDeserialize)]
pub struct SwapOrder {
    /// Unique identifier for each order
    id: u128,
    /// Address of emitter contract
    emitter: String,
    /// Network ID of the source chain
    src_nid: String,
    /// Netword ID of the destination chain
    dst_nid: String,
    /// Address of the user who created the swap order
    creator: String,
    /// Address where the swapped token should be sent
    destination_address: String,
    /// Address of the token to be swapped
    token: String,
    /// Amount of the token to be swapped
    amount: u128,
    /// Address of the token to receive on the destination chain
    to_token: String,
    /// Amount of `to_token` expected to be received
    to_amount: u128,
    /// Additional data for the swap
    data: Vec<u8>,
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

    pub fn id(&self) -> u128 {
        self.id
    }

    pub fn set_id(&mut self, id: u128) {
        self.id = id
    }

    pub fn emitter(&self) -> String {
        self.emitter.clone()
    }

    pub fn src_nid(&self) -> String {
        self.src_nid.clone()
    }

    pub fn dst_nid(&self) -> String {
        self.dst_nid.clone()
    }

    pub fn creator(&self) -> String {
        self.creator.clone()
    }

    pub fn dst_address(&self) -> String {
        self.destination_address.clone()
    }

    pub fn token(&self) -> String {
        self.token.clone()
    }

    pub fn amount(&self) -> u128 {
        self.amount
    }

    pub fn to_token(&self) -> String {
        self.to_token.clone()
    }

    pub fn to_amount(&self) -> u128 {
        self.to_amount
    }

    pub fn data(&self) -> Vec<u8> {
        self.data.clone()
    }

    pub fn set_data(&mut self, data: Vec<u8>) {
        self.data = data
    }

    pub fn get_hash(&self) -> Vec<u8> {
        keccak::hash(&self.encode()).to_bytes().to_vec()
    }

    pub fn encode(&self) -> Vec<u8> {
        rlp::encode(self).to_vec()
    }
}

impl Encodable for SwapOrder {
    fn rlp_append(&self, stream: &mut rlp::RlpStream) {
        stream.begin_list(11);
        stream.append(&self.id());
        stream.append(&self.emitter());
        stream.append(&self.src_nid());
        stream.append(&self.dst_nid());
        stream.append(&self.creator());
        stream.append(&self.dst_address());
        stream.append(&self.token());
        stream.append(&self.amount());
        stream.append(&self.to_token());
        stream.append(&self.to_amount());
        stream.append(&self.data());
    }
}

impl Decodable for SwapOrder {
    fn decode(rlp: &rlp::Rlp) -> Result<Self, rlp::DecoderError> {
        let id: u128 = rlp.val_at(0)?;
        let emitter: String = rlp.val_at(1)?;
        let src_nid: String = rlp.val_at(2)?;
        let dst_nid: String = rlp.val_at(3)?;
        let creator: String = rlp.val_at(4)?;
        let destination_address: String = rlp.val_at(5)?;
        let token: String = rlp.val_at(6)?;
        let amount: u128 = rlp.val_at(7)?;
        let to_token: String = rlp.val_at(8)?;
        let to_amount: u128 = rlp.val_at(9)?;
        let data: Vec<u8> = rlp.val_at(10)?;

        Ok(Self {
            id,
            emitter,
            src_nid,
            dst_nid,
            destination_address,
            creator,
            token,
            amount,
            to_amount,
            to_token,
            data,
        })
    }
}

impl TryFrom<&Vec<u8>> for SwapOrder {
    type Error = IntentError;
    fn try_from(value: &Vec<u8>) -> Result<Self, Self::Error> {
        let rlp = rlp::Rlp::new(value as &[u8]);
        Self::decode(&rlp).map_err(|_| IntentError::DecodeFailed)
    }
}

impl TryFrom<&[u8]> for SwapOrder {
    type Error = IntentError;
    fn try_from(value: &[u8]) -> Result<Self, Self::Error> {
        let rlp = rlp::Rlp::new(value);
        Self::decode(&rlp).map_err(|_| IntentError::DecodeFailed)
    }
}

#[test]
fn test_swap_order_decode_1() {
    let swap_order = SwapOrder::new(
        1,
        "0xbe6452d4d6c61cee97d3".to_string(),
        "Ethereum".to_string(),
        "Polygon".to_string(),
        "0x3e36eddd65e239222e7e67".to_string(),
        "0xd2c6218b875457a41b6fb7964e".to_string(),
        "0x14355340e857912188b7f202d550222487".to_string(),
        1000,
        "0x91a4728b517484f0f610de7b".to_string(),
        900,
        Vec::new(),
    );

    let expected = hex::decode("f8a601963078626536343532643464366336316365653937643388457468657265756d87506f6c79676f6e983078336533366564646436356532333932323265376536379c30786432633632313862383735343537613431623666623739363465a43078313433353533343065383537393132313838623766323032643535303232323438378203e89a307839316134373238623531373438346630663631306465376282038480").unwrap();
    let encoded = swap_order.encode();
    let decoded = SwapOrder::try_from(&expected).unwrap();

    assert_eq!(swap_order, decoded);
    assert_eq!(encoded, expected)
}

#[test]
fn test_swap_order_decode_2() {
    let swap_order = SwapOrder::new(
        1,
        "0xbe6452d4d6c61cee97d3".to_string(),
        "Ethereum".to_string(),
        "Polygon".to_string(),
        "0x3e36eddd65e239222e7e67".to_string(),
        "0xd2c6218b875457a41b6fb7964e".to_string(),
        "0x14355340e857912188b7f202d550222487".to_string(),
        100000 * 10_u128.pow(22),
        "0x91a4728b517484f0f610de7b".to_string(),
        900 * 10_u128.pow(7),
        hex::decode("6c449988e2f33302803c93f8287dc1d8cb33848a").unwrap(),
    );

    let expected = hex::decode("f8c701963078626536343532643464366336316365653937643388457468657265756d87506f6c79676f6e983078336533366564646436356532333932323265376536379c30786432633632313862383735343537613431623666623739363465a43078313433353533343065383537393132313838623766323032643535303232323438378c033b2e3c9fd0803ce80000009a3078393161343732386235313734383466306636313064653762850218711a00946c449988e2f33302803c93f8287dc1d8cb33848a").unwrap();
    let encoded = swap_order.encode();
    let decoded = SwapOrder::try_from(&expected).unwrap();

    assert_eq!(decoded, swap_order);
    assert_eq!(encoded, expected)
}
