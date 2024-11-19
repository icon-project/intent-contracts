use crate::events::create_swap_order_event;
use common::{
    rlp::{self, Encodable},
    utils::keccak256,
};
use cosmwasm_std::{Addr, BankMsg, Coin};
use cw20::Cw20ExecuteMsg;
use events::{
    create_order_cancelled_event, create_order_closed_event, create_order_fill_event,
    create_send_message_event,
};

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
        let relayer = deps.api.addr_validate(&msg.relayer)?;
        self.set_relayer(deps.storage, relayer)?;

        Ok(Response::new())
    }

    pub fn swap(
        &self,
        order: SwapOrder,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
    ) -> Result<Response, ContractError> {
        let event = create_swap_order_event(&order);
        self.set_order(deps.storage, order.id, &order)?;
        let mut res = self.receive_payment(deps.as_ref(), env, info, order.amount, order.token)?;
        res = res.add_event(event);
        Ok(res)
    }

    pub fn fill(
        &self,
        order: SwapOrder,
        solver: String,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
    ) -> Result<Response, ContractError> {
        let self_nid = self.get_nid(deps.storage)?;

        if order.dst_nid != self_nid {
            return Err(ContractError::InvalidDstNId);
        }
        let order_bytes = order.rlp_bytes();
        let order_hash = keccak256(&order_bytes);
        if self.is_order_finished(deps.storage, &order_hash) {
            return Err(ContractError::OrderAlreadyComplete);
        }
        self.set_order_finished(deps.storage, &keccak256(&order.rlp_bytes()), true).unwrap();
        let mut response = self.receive_payment(
            deps.as_ref(),
            env.clone(),
            info,
            order.to_amount,
            order.to_token.clone(),
        )?;

        let protocol_fee = self.get_protocol_fee(deps.storage).unwrap_or(0);
        let fee = (order.to_amount * protocol_fee as u128) / 10000;
        let fee_handler = self.get_fee_handler(deps.storage)?;

        let fee_transfer = self.try_transfer(
            deps.as_ref(),
            env.contract.address.to_string(),
            fee_handler.to_string(),
            fee,
            &order.to_token,
        );

        let receiver_transfer = self.try_transfer(
            deps.as_ref(),
            env.contract.address.to_string(),
            order.destination_address.clone(),
            order.to_amount - fee,
            &order.to_token,
        );

        let order_fill = OrderFill {
            id: order.id,
            order_bytes: order.rlp_bytes().to_vec(),
            solver_address: solver,
        };

        let order_fill_event = create_order_fill_event(&order_fill, fee, order.to_amount);

        if order.src_nid == order.dst_nid {
            response = self.resolve_fill(deps, env, order.src_nid, order_fill)?;
        } else {
            let msg = OrderMsg {
                msg_type: ORDER_FILL,
                message: order_fill.rlp_bytes().to_vec(),
            };
            let sn = self.get_next_conn_sn(deps.storage)?;
            let event = create_send_message_event(order.src_nid, sn, msg.rlp_bytes().to_vec());
            response = response.add_event(event);
        }

        response = response.add_message(receiver_transfer);
        if fee > 0 {
            response = response.add_message(fee_transfer);
        }
        response = response.add_event(order_fill_event);
        
        Ok(response)
    }

    pub fn receive_msg(
        &self,
        deps: DepsMut,
        env: Env,
        info: MessageInfo,
        src_network: String,
        conn_sn: u128,
        order_msg: OrderMsg,
    ) -> Result<Response, ContractError> {
        let relayer = self.get_relayer(deps.storage)?;
        if info.sender != relayer {
            return Err(ContractError::Unauthorized {});
        }

        if self.have_received(deps.storage, (src_network.clone(), conn_sn)) {
            return Err(ContractError::MessageAlreadyReceived);
        }
        self.set_received(deps.storage, (src_network.clone(), conn_sn), true)?;
        match order_msg.msg_type {
            ORDER_FILL => {
                let fill = rlp::decode::<OrderFill>(&order_msg.message).map_err(|e| {
                    ContractError::DecodeError {
                        error: e.to_string(),
                    }
                })?;
                self.resolve_fill(deps, env, src_network, fill)
            }
            ORDER_CANCEL => {
                let cancel = rlp::decode::<OrderCancel>(&order_msg.message).map_err(|e| {
                    ContractError::DecodeError {
                        error: e.to_string(),
                    }
                })?;
                self.resolve_cancel(deps, src_network, cancel.order_bytes)
            }
            _ => Err(ContractError::InvalidMessageType),
        }
    }

    fn resolve_fill(
        &self,
        deps: DepsMut,
        env: Env,
        src_nid: String,
        fill: OrderFill,
    ) -> Result<Response, ContractError> {
        let order = self.get_order(deps.storage, fill.id)?;
        if fill.order_bytes != order.rlp_bytes().to_vec() {
            return Err(ContractError::InvalidFillOrder);
        }

        if order.dst_nid != src_nid {
            return Err(ContractError::InvalidFillOrder);
        }
        let mut response = Response::new();

        let transfer = self.try_transfer(
            deps.as_ref(),
            env.contract.address.to_string(),
            fill.solver_address,
            order.amount,
            &order.token,
        );
        response = response
            .add_message(transfer)
            .add_event(create_order_closed_event(fill.id));
        Ok(response)
    }

    fn resolve_cancel(
        &self,
        deps: DepsMut,
        src_nid: String,
        order_bytes: Vec<u8>,
    ) -> Result<Response, ContractError> {
        let order_hash = keccak256(&order_bytes);
        if self.is_order_finished(deps.storage, &order_hash) {
            return Err(ContractError::OrderAlreadyComplete);
        }
        let mut response = Response::new();
        let order: SwapOrder =
            rlp::decode(&order_bytes).map_err(|e| ContractError::DecodeError {
                error: e.to_string(),
            })?;
        if order.src_nid != src_nid {
            return Err(ContractError::InvalidCancellation);
        }

        self.set_order_finished(deps.storage, &order_hash, true)?;
        let fill = OrderFill {
            id: order.id,
            order_bytes,
            solver_address: order.creator.clone(),
        };
        let msg = OrderMsg {
            msg_type: ORDER_CANCEL,
            message: fill.rlp_bytes().to_vec(),
        };
        let conn_sn = self.get_next_conn_sn(deps.storage)?;
        let send_event =
            create_send_message_event(order.src_nid.clone(), conn_sn, msg.rlp_bytes().to_vec());
        let cancelled_event = create_order_cancelled_event(&order);
        response = response.add_event(cancelled_event);
        response = response.add_event(send_event);

        Ok(response)
    }

    fn receive_payment(
        &self,
        deps: Deps,
        env: Env,
        info: MessageInfo,
        amount: u128,
        denom: String,
    ) -> Result<Response, ContractError> {
        let mut response = Response::new();
        if self.is_native(deps, &denom) {
            let sum: u128 = info.funds.into_iter().fold(0, |mut a, c| {
                if c.denom == denom {
                    a += Into::<u128>::into(c.amount);
                }
                a
            });
            if sum < amount {
                return Err(ContractError::InsufficientFunds);
            }
        } else {
            let msg = self.token_transfer(
                denom,
                info.sender.to_string(),
                env.contract.address.to_string(),
                amount,
            );
            response = response.add_message(msg);
        }

        Ok(response)
    }

    fn token_transfer(
        &self,
        token_address: String,
        from: String,
        to: String,
        amount: u128,
    ) -> CosmosMsg<Empty> {
        let transfer_msg = Cw20ExecuteMsg::TransferFrom {
            owner: from,
            recipient: to,
            amount: amount.into(),
        };

        CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: token_address,
            msg: to_json_binary(&transfer_msg).unwrap(),
            funds: vec![],
        })
    }

    fn try_transfer(
        &self,
        deps: Deps,
        from: String,
        to: String,
        amount: u128,
        denom: &String,
    ) -> CosmosMsg<Empty> {
        if self.is_native(deps, denom) {
            let msg = BankMsg::Send {
                to_address: deps.api.addr_validate(&to).unwrap().to_string(),
                amount: vec![Coin {
                    denom: denom.to_string(),
                    amount: amount.into(),
                }],
            };
            CosmosMsg::Bank(msg)
        } else {
            self.token_transfer(denom.to_string(), from, to, amount)
        }
    }

    pub fn is_contract(&self, deps: Deps, address: &Addr) -> bool {
        deps.querier
            .query_wasm_contract_info(address)
            .map(|r| true)
            .unwrap_or(false)
    }

    pub fn is_native(&self, deps: Deps, denom: &String) -> bool {
        if let Ok(addr) = deps.api.addr_validate(denom) {
            return !self.is_contract(deps, &addr);
        }
        true
    }

    pub fn get_next_deposit_id(&self, storage: &mut dyn Storage) -> StdResult<u128> {
        let id = self.get_deposit_id(storage);
        let new_id = id + 1;
        self.set_deposit_id(storage, new_id)?;
        Ok(new_id)
    }

    pub fn get_next_conn_sn(&self, storage: &mut dyn Storage) -> StdResult<u128> {
        let id = self.get_conn_sn(storage);
        let new_id = id + 1;
        self.set_conn_sn(storage, new_id)?;
        Ok(new_id)
    }
}
