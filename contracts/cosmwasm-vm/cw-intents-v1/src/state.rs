use cosmwasm_std::Addr;

use crate::types::StorageKey;

use super::*;

pub struct CwIntentV1Service<'a> {
    deposit_id: Item<'a, u128>,
    nid: Item<'a, String>,
    protocol_fee: Item<'a, u8>,
    fee_handler: Item<'a, Addr>,
    orders: Map<'a, u128, SwapOrder>,
    pending_fills: Map<'a, Vec<u8>, u128>,
    finished_orders: Map<'a, Vec<u8>, bool>,
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
            pending_fills: Map::new(StorageKey::PendingFills.as_str()),
            finished_orders: Map::new(StorageKey::FinishedOrders.as_str()),
        }
    }

    pub fn get_deposit_id(&self, storage: &dyn Storage) -> StdResult<u128> {
        self.deposit_id.load(storage)
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

    pub fn get_order(&self, storage: &dyn Storage, key: u128) -> StdResult<Option<SwapOrder>> {
        self.orders.may_load(storage, key)
    }

    pub fn get_pending_fill(&self, storage: &dyn Storage, key: &[u8]) -> Option<u128> {
        self.pending_fills.load(storage, key.to_vec()).ok()
    }

    pub fn is_order_finished(&self, storage: &dyn Storage, key: &[u8]) -> bool {
        self.finished_orders
            .load(storage, key.to_vec())
            .unwrap_or(false)
    }

    // Setters
    pub fn set_deposit_id(&self, storage: &mut dyn Storage, value: u128) -> StdResult<()> {
        self.deposit_id.save(storage, &value)
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

    pub fn set_pending_fill(
        &self,
        storage: &mut dyn Storage,
        key: &[u8],
        value: u128,
    ) -> StdResult<()> {
        self.pending_fills.save(storage, key.to_vec(), &value)
    }

    pub fn set_order_finished(
        &self,
        storage: &mut dyn Storage,
        key: &[u8],
        value: bool,
    ) -> StdResult<()> {
        self.finished_orders.save(storage, key.to_vec(), &value)
    }
}
