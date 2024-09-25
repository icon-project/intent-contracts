use std::str::from_utf8;

use cosmwasm_std::Addr;

use super::*;

// version info for migration info
const CONTRACT_NAME: &str = "crates.io:cw-mock-dapp";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

impl<'a> CwIntentV1Service<'a> {
    pub fn instantiate(
        &self,
        deps: DepsMut,
        env: Env,
        _info: MessageInfo,
        msg: InstantiateMsg,
    ) -> Result<Response, ContractError> {
        set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
        self.set_nid(deps.storage, msg.nid)?;
        self.set_fee_handler(deps.storage, deps.api.addr_validate(&msg.fee_handler)?)?;
        self.set_deposit_id(deps.storage, 0)?;

        Ok(Response::new())
    }

    pub fn swap(&self, order: SwapOrder, deps: DepsMut, env: Env, info: MessageInfo) {}

    pub fn fill(&self, order: SwapOrder, deps: DepsMut, env: Env, info: MessageInfo) {}

    pub fn receive_msg(&self, src_network: String, conn_sn: u128, order_msg: OrderMsg) {}

    pub fn get_next_deposit_id(&self, storage: &mut dyn Storage) -> StdResult<u128> {
        let id = self.get_deposit_id(storage)?;
        let new_id = id + 1;
        self.set_deposit_id(storage, new_id)?;
        Ok(new_id)
    }
}
