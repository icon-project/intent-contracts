use cosmwasm_std::Addr;

use crate::types::StorageKey;

use super::*;

pub struct CwIntentV1Service<'a> {
    deposit_id: Item<'a, u128>,
    nid: Item<'a, String>,
    protocol_fee: Item<'a, u8>,
    fee_handler: Item<'a, Addr>,
    orders: Map<'a, u128, SwapOrder>,
    finished_orders: Map<'a, Vec<u8>, bool>,
    conn_sn: Item<'a, u128>,
    receipts: Map<'a, (String, u128), bool>,
    relayer: Item<'a, Addr>,
}

impl<'a> Default for CwIntentV1Service<'a> {
    fn default() -> Self {
        Self::new()
    }
}

impl<'a> CwIntentV1Service<'a> {
    pub fn new() -> Self {
        Self {
            deposit_id: Item::new(StorageKey::DepositId.as_str()),
            nid: Item::new(StorageKey::Nid.as_str()),
            protocol_fee: Item::new(StorageKey::ProtocolFee.as_str()),
            fee_handler: Item::new(StorageKey::FeeHandler.as_str()),
            orders: Map::new(StorageKey::Orders.as_str()),
            finished_orders: Map::new(StorageKey::FinishedOrders.as_str()),
            conn_sn: Item::new(StorageKey::ConnectionSN.as_str()),
            receipts: Map::new(StorageKey::Receipts.as_str()),
            relayer: Item::new(StorageKey::Relayer.as_str()),
        }
    }

    pub fn get_deposit_id(&self, storage: &dyn Storage) -> u128 {
        self.deposit_id.load(storage).unwrap_or(0)
    }

    pub fn get_relayer(&self, storage: &dyn Storage) -> StdResult<Addr> {
        self.relayer.load(storage)
    }

    pub fn get_nid(&self, storage: &dyn Storage) -> StdResult<String> {
        self.nid.load(storage)
    }

    pub fn get_protocol_fee(&self, storage: &dyn Storage) -> StdResult<u8> {
        self.protocol_fee.load(storage)
    }

    pub fn get_fee_handler(&self, storage: &dyn Storage) -> StdResult<Addr> {
        self.fee_handler.load(storage)
    }

    pub fn get_order(&self, storage: &dyn Storage, key: u128) -> StdResult<SwapOrder> {
        self.orders.load(storage, key)
    }

    pub fn get_conn_sn(&self, storage: &dyn Storage) -> u128 {
        self.conn_sn.load(storage).unwrap_or(0)
    }

    pub fn is_order_finished(&self, storage: &dyn Storage, key: &[u8]) -> bool {
        self.finished_orders
            .load(storage, key.to_vec())
            .unwrap_or(false)
    }

    pub fn have_received(&self, storage: &dyn Storage, key: (String, u128)) -> bool {
        self.receipts.load(storage, key).unwrap_or(false)
    }

    // Setters
    pub fn set_deposit_id(&self, storage: &mut dyn Storage, value: u128) -> StdResult<()> {
        self.deposit_id.save(storage, &value)
    }

    pub fn set_relayer(&self, storage: &mut dyn Storage, value: Addr) -> StdResult<()> {
        self.relayer.save(storage, &value)
    }

    pub fn set_conn_sn(&self, storage: &mut dyn Storage, value: u128) -> StdResult<()> {
        self.conn_sn.save(storage, &value)
    }

    pub fn set_nid(&self, storage: &mut dyn Storage, value: String) -> StdResult<()> {
        self.nid.save(storage, &value)
    }

    pub fn set_protocol_fee(&self, storage: &mut dyn Storage, value: u8) -> StdResult<()> {
        self.protocol_fee.save(storage, &value)
    }

    pub fn set_fee_handler(&self, storage: &mut dyn Storage, value: Addr) -> StdResult<()> {
        self.fee_handler.save(storage, &value)
    }

    pub fn set_order(
        &self,
        storage: &mut dyn Storage,
        key: u128,
        value: &SwapOrder,
    ) -> StdResult<()> {
        self.orders.save(storage, key, value)
    }

    pub fn remove_order(&self, storage: &mut dyn Storage, key: u128) {
        self.orders.remove(storage, key)
    }

    pub fn set_order_finished(
        &self,
        storage: &mut dyn Storage,
        key: &[u8],
        value: bool,
    ) -> StdResult<()> {
        self.finished_orders.save(storage, key.to_vec(), &value)
    }

    pub fn set_received(
        &self,
        storage: &mut dyn Storage,
        key: (String, u128),
        val: bool,
    ) -> StdResult<()> {
        self.receipts.save(storage, key, &val)
    }
}
