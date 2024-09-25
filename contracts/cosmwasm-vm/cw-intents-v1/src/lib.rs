pub mod contract;
pub mod errors;
pub mod msg;
pub mod state;
pub mod types;

use cosmwasm_schema::cw_serde;
use cosmwasm_std::{
    entry_point, to_json_binary, Binary, CosmosMsg, Deps, DepsMut, Empty, Env, MessageInfo,
    Response, StdError, StdResult, Storage, SubMsg, WasmMsg,
};

use cw2::set_contract_version;
use cw_storage_plus::{Item, Map};
pub use errors::*;
use msg::{ExecuteMsg, QueryMsg};
use state::CwIntentV1Service;
use thiserror::Error;
pub use types::*;

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let call_service = CwIntentV1Service::default();

    call_service.instantiate(deps, env, info, msg)
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    let call_service = CwIntentV1Service::default();
    match msg {
        ExecuteMsg::Swap {
            dst_nid,
            token,
            amount,
            to_token,
            destination_address,
            min_receive,
            data,
        } => {
            let id = call_service.get_next_deposit_id(deps.storage)?;
            let src_nid = call_service.get_nid(deps.storage)?;
            let order = SwapOrder::new(
                id,
                env.contract.address.to_string(),
                src_nid,
                dst_nid,
                info.sender.to_string(),
                destination_address,
                token,
                amount,
                to_token,
                min_receive,
                data,
            );
            call_service.swap(order, deps, env, info);
            Ok(Response::new())
        }
        ExecuteMsg::Fill {
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
            fill_amount,
            solver_address,
        } => Ok(Response::new()),
        ExecuteMsg::RecvMessage {
            src_network,
            conn_sn,
            msg,
        } => Ok(Response::new()),
    }
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    let call_service = CwIntentV1Service::default();
    match msg {
        QueryMsg::GetOrder { id } => {
            to_json_binary(&call_service.get_order(deps.storage, id).unwrap())
        }
    }
}
