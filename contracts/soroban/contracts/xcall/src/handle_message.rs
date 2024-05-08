use soroban_sdk::{Address, Bytes, Env, String, Vec};

use crate::{
    contract::Xcall,
    errors::ContractError,
    event,
    messages::cs_message::{CSMessage, CSMessageType},
    types::{
        request::CSMessageRequest,
        result::{CSMessageResult, CSResponseType},
        rollback::Rollback,
    },
};

impl Xcall {
    pub fn handle_call(
        env: &Env,
        sender: &Address,
        from_nid: String,
        msg: Bytes,
    ) -> Result<(), ContractError> {
        let config = Self::get_config(&env)?;
        if config.network_id == from_nid {
            return Err(ContractError::ProtocolsMismatch);
        }

        let cs_message: CSMessage = CSMessage::decode(&env, msg)?;
        match cs_message.message_type() {
            CSMessageType::CSMessageRequest => {
                Self::handle_request(&env, sender, from_nid, cs_message.payload().clone())
            }
            CSMessageType::CSMessageResult => {
                Self::handle_result(&env, sender, cs_message.payload().clone())
            }
        }
    }

    pub fn handle_request(
        env: &Env,
        sender: &Address,
        from_net: String,
        data: Bytes,
    ) -> Result<(), ContractError> {
        let mut req = CSMessageRequest::decode(&env, data.clone())?;

        let (src_net, _) = req.from().parse_network_address(&env);
        if src_net != from_net {
            return Err(ContractError::ProtocolsMismatch);
        }
        let source = sender.to_string();
        let source_valid = Self::is_valid_source(&env, &source, src_net, &req.protocols())?;
        if !source_valid {
            return Err(ContractError::ProtocolsMismatch);
        }

        if req.protocols().len() > 1 {
            let hash = env.crypto().keccak256(&data);
            let mut pending_request = Self::get_pending_request(&env, hash.clone());

            if !pending_request.contains(source.clone()) {
                pending_request.push_back(source);
                Self::store_pending_request(&env, hash.clone(), &pending_request);
            }
            if pending_request.len() != req.protocols().len() {
                return Ok(());
            }
            Self::remove_pending_request(&env, hash);
        }

        let req_id = Self::increment_last_request_id(&env);

        event::call_message(
            &env,
            req.from().clone(),
            req.to().clone(),
            req.sequence_no(),
            req_id,
            req.data().clone(),
        );

        req.hash_data(&env);
        Self::store_proxy_request(&env, req_id, &req);

        Ok(())
    }

    pub fn handle_result(env: &Env, sender: &Address, data: Bytes) -> Result<(), ContractError> {
        let result = CSMessageResult::decode(&env, data.clone())?;

        let source = sender.to_string();
        let sequence_no = result.sequence_no();
        let mut rollback = Self::get_rollback(&env, sequence_no)?;

        let source_valid =
            Self::is_valid_source(&env, &source, rollback.to().nid(&env), &rollback.protocols)?;
        if !source_valid {
            return Err(ContractError::ProtocolsMismatch);
        }

        if rollback.protocols().len() > 1 {
            let hash = env.crypto().keccak256(&data);
            let mut pending_response = Self::get_pending_response(&env, hash.clone());

            if !pending_response.contains(source.clone()) {
                pending_response.push_back(source);
                Self::store_pending_response(&env, hash.clone(), &pending_response);
            }
            if pending_response.len() != rollback.protocols().len() {
                return Ok(());
            }
            Self::remove_pending_response(&env, hash);
        }

        event::response_message(&env, result.response_code().clone(), sequence_no);

        match result.response_code() {
            CSResponseType::CSResponseSuccess => {
                Self::remove_rollback(&env, sequence_no);
                Self::save_success_response(&env, sequence_no);

                let result_msg = result.message(&env);
                if result_msg.is_some() {
                    let mut reply_msg = result_msg.unwrap();
                    Self::handle_reply(&env, &rollback, &mut reply_msg)?;
                }
            }
            _ => {
                if rollback.rollback().len() < 1 {
                    return Err(ContractError::NoRollbackData);
                }
                rollback.enable();
                Self::store_rollback(&env, sequence_no, &rollback);

                event::rollback_message(&env, sequence_no);
            }
        }

        Ok(())
    }

    pub fn handle_reply(
        env: &Env,
        rollback: &Rollback,
        reply: &mut CSMessageRequest,
    ) -> Result<(), ContractError> {
        if rollback.to().nid(&env) != reply.from().nid(&env) {
            return Err(ContractError::InvalidReplyReceived);
        }
        let req_id = Self::increment_last_request_id(&env);

        event::call_message(
            &env,
            reply.from().clone(),
            reply.to().clone(),
            reply.sequence_no(),
            req_id,
            reply.data().clone(),
        );

        reply.hash_data(&env);
        Self::store_proxy_request(&env, req_id, &reply);

        Ok(())
    }

    pub fn handle_error_message(
        env: &Env,
        sender: Address,
        sequence_no: u128,
    ) -> Result<(), ContractError> {
        let cs_message_result = CSMessageResult::new(
            sequence_no,
            CSResponseType::CSResponseFailure,
            Bytes::new(&env),
        );
        Self::handle_result(&env, &sender, cs_message_result.encode(&env))
    }

    pub fn is_valid_source(
        e: &Env,
        sender: &String,
        src_net: String,
        protocols: &Vec<String>,
    ) -> Result<bool, ContractError> {
        if protocols.contains(sender) {
            return Ok(true);
        }

        let default_connection = Self::default_connection(e, src_net)?;
        Ok(sender.clone() == default_connection.to_string())
    }
}