use common::rlp::Encodable;
use cosmwasm_std::{
    testing::{mock_dependencies, mock_env, mock_info},
    to_binary, Addr, Coin, CosmosMsg, StdError, SubMsg, Uint128, WasmMsg,
};
use cw20::{Cw20ExecuteMsg, Cw20ReceiveMsg};
use cw_intents_v1::{
    errors::ContractError,
    execute, instantiate,
    msg::{ExecuteMsg, InstantiateMsg, QueryMsg},
    query,
    state::CwIntentV1Service,
    types::{OrderFill, OrderMsg, SwapOrder},
    OrderCancel,
};
use cw_multi_test::{App, ContractWrapper, Executor};

const MOCK_CONTRACT_ADDR: &str = "contract";
const USER1: &str = "user1";
const USER2: &str = "user2";
const FEE_HANDLER: &str = "fee_handler";
const NATIVE_DENOM: &str = "uatom";
const CW20_TOKEN: &str = "cw20_token";

fn mock_app() -> App {
    App::default()
}

fn store_code(app: &mut App) -> u64 {
    let contract = ContractWrapper::new(execute, instantiate, query);
    app.store_code(Box::new(contract))
}

fn instantiate_contract(app: &mut App, code_id: u64, sender: &str) -> Addr {
    app.instantiate_contract(
        code_id,
        Addr::unchecked(sender),
        &InstantiateMsg {
            nid: "src-nid".to_string(),
            fee_handler: FEE_HANDLER.to_string(),
            fee: 1,
            relayer: sender.to_string(),
        },
        &[],
        "CwIntentV1",
        None,
    )
    .unwrap()
}

#[test]
fn proper_initialization() {
    let mut app = mock_app();
    let code_id = store_code(&mut app);
    let contract_addr = instantiate_contract(&mut app, code_id, USER1);

    // Query the deposit ID
    let deposit_id: u128 = app
        .wrap()
        .query_wasm_smart(contract_addr, &QueryMsg::GetDepositId {})
        .unwrap();
    assert_eq!(deposit_id, 0);
}

fn fund_account(app: &mut App, account: String, amount: u128, denom: String) {
    app.sudo(cw_multi_test::SudoMsg::Bank(
        cw_multi_test::BankSudo::Mint {
            to_address: account,
            amount: vec![Coin {
                denom: denom,
                amount: Uint128::new(amount),
            }],
        },
    ))
    .unwrap();
}

fn to_swap_msg(order: &SwapOrder) -> ExecuteMsg {
    ExecuteMsg::Swap {
        dst_nid: order.dst_nid.clone(),
        token: order.token.clone(),
        amount: order.amount,
        to_token: order.to_token.clone(),
        destination_address: order.destination_address.clone(),
        min_receive: order.min_receive,
        data: order.data.clone(),
    }
}

#[test]
fn test_swap_native_token() {
    let mut app = mock_app();
    let code_id = store_code(&mut app);
    let contract_addr = instantiate_contract(&mut app, code_id, USER1);

    // Fund USER1 with native tokens
    fund_account(&mut app, USER1.to_string(), 1000, NATIVE_DENOM.to_string());

    // Execute swap
    let swap_msg = ExecuteMsg::Swap {
        dst_nid: "dst-nid".to_string(),
        token: NATIVE_DENOM.to_string(),
        amount: 100,
        to_token: "to_token".to_string(),
        destination_address: USER2.to_string(),
        min_receive: 90,
        data: hex::decode("deadbeef").unwrap(),
    };

    let res = app.execute_contract(
        Addr::unchecked(USER1),
        contract_addr.clone(),
        &swap_msg,
        &[Coin {
            denom: NATIVE_DENOM.to_string(),
            amount: Uint128::new(100),
        }],
    );
    println!("{:?}", res);
    let response = res.unwrap();

    // Check if the swap event is emitted
    assert!(response.events.iter().any(
        |e| e.ty == "wasm-SwapOrder" && e.attributes.iter().any(|attr| attr.key == "to_token")
    ));

    // Query the deposit ID (should be incremented)
    let deposit_id: u128 = app
        .wrap()
        .query_wasm_smart(contract_addr, &QueryMsg::GetDepositId {})
        .unwrap();
    assert_eq!(deposit_id, 1);
}

fn init_cw20_contract(app: &mut App, owner: String, denom: String) -> Addr {
    let cw20_code_id = app.store_code(Box::new(ContractWrapper::new(
        cw20_base::contract::execute,
        cw20_base::contract::instantiate,
        cw20_base::contract::query,
    )));
    let cw20_addr = app
        .instantiate_contract(
            cw20_code_id,
            Addr::unchecked(owner.clone()),
            &cw20_base::msg::InstantiateMsg {
                name: "Test Token".to_string(),
                symbol: denom,
                decimals: 6,
                initial_balances: vec![cw20::Cw20Coin {
                    address: owner.to_string(),
                    amount: Uint128::new(1000),
                }],
                mint: None,
                marketing: None,
            },
            &[],
            "Test Token",
            None,
        )
        .unwrap();
    cw20_addr
}
#[test]
fn test_swap_cw20_token() {
    let mut app = mock_app();
    let code_id = store_code(&mut app);
    let contract_addr = instantiate_contract(&mut app, code_id, USER1);

    let cw20_addr = init_cw20_contract(&mut app, USER1.to_string(), "test".to_owned());

    // Approve the contract to spend USER1's tokens
    app.execute_contract(
        Addr::unchecked(USER1),
        cw20_addr.clone(),
        &cw20::Cw20ExecuteMsg::IncreaseAllowance {
            spender: contract_addr.to_string(),
            amount: Uint128::new(100),
            expires: None,
        },
        &[],
    )
    .unwrap();

    // Execute swap
    let swap_msg = ExecuteMsg::Swap {
        dst_nid: "dst-nid".to_string(),
        token: cw20_addr.to_string(),
        amount: 100,
        to_token: "to_token".to_string(),
        destination_address: USER2.to_string(),
        min_receive: 90,
        data: hex::decode("deadbeef").unwrap(),
    };

    let res = app
        .execute_contract(
            Addr::unchecked(USER1),
            contract_addr.clone(),
            &swap_msg,
            &[],
        )
        .unwrap();

    // Check if the swap event is emitted
    assert!(res
        .events
        .iter()
        .any(|e| e.ty == "wasm-SwapOrder" && e.attributes.iter().any(|attr| attr.key == "amount")));

    // Query the deposit ID (should be incremented)
    let deposit_id: u128 = app
        .wrap()
        .query_wasm_smart(contract_addr, &QueryMsg::GetDepositId {})
        .unwrap();
    assert_eq!(deposit_id, 1);
}

#[test]
fn test_fill_order() {
    let mut app = mock_app();
    let code_id = store_code(&mut app);
    let contract_addr = instantiate_contract(&mut app, code_id, USER1);
    fund_account(&mut app, USER2.to_string(), 200, "to_token".to_string());
    // Fill the order
    let fill_msg = ExecuteMsg::Fill {
        id: 1,
        emitter: contract_addr.to_string(),
        src_nid: "dst-nid".to_string(),
        dst_nid: "src-nid".to_string(),
        creator: USER1.to_string(),
        destination_address: USER2.to_string(),
        token: NATIVE_DENOM.to_string(),
        amount: 100,
        to_token: "to_token".to_string(),
        min_receive: 90,
        data: hex::decode("deadbeef").unwrap(),
        fill_amount: 90,
        solver_address: USER2.to_string(),
    };

    let res = app.execute_contract(
        Addr::unchecked(USER2),
        contract_addr.clone(),
        &fill_msg,
        &[Coin {
            denom: "to_token".to_string(),
            amount: Uint128::new(100),
        }],
    );
    assert!(res.is_ok());
}

#[test]
fn test_receive_msg() {
    let mut app = mock_app();
    let code_id = store_code(&mut app);
    let contract_addr = instantiate_contract(&mut app, code_id, USER1);

    let order = SwapOrder {
        id: 1,
        emitter: contract_addr.to_string(),
        src_nid: "src-nid".to_string(),
        dst_nid: "src-nid".to_string(),
        creator: USER1.to_string(),
        destination_address: USER2.to_string(),
        token: NATIVE_DENOM.to_string(),
        amount: 100,
        to_token: "to_token".to_string(),
        min_receive: 10,
        data: hex::decode("deadbeef").unwrap(),
    };
    fund_account(&mut app, USER1.to_string(), 200, NATIVE_DENOM.to_string());
    fund_account(
        &mut app,
        contract_addr.to_string(),
        200,
        "to_token".to_string(),
    );
    let swap_msg = to_swap_msg(&order);

    app.execute_contract(
        Addr::unchecked(USER1),
        contract_addr.clone(),
        &swap_msg,
        &[Coin {
            denom: NATIVE_DENOM.to_string(),
            amount: Uint128::new(100),
        }],
    )
    .unwrap();

    // Create a mock OrderFill
    let order_fill = OrderFill {
        id: 1,
        order_bytes: order.rlp_bytes().to_vec(),
        solver_address: USER2.to_string(),
        amount: 100,
        closed: true,
    };

    // Create a mock OrderMsg
    let order_msg = OrderMsg {
        msg_type: 1, // ORDER_FILL
        message: order_fill.rlp_bytes().to_vec(),
    };

    // Execute RecvMessage
    let recv_msg = ExecuteMsg::RecvMessage {
        src_network: "src-nid".to_string(),
        conn_sn: 1,
        msg: order_msg.rlp_bytes().to_vec(),
    };

    let result = app.execute_contract(
        Addr::unchecked(USER1),
        contract_addr.clone(),
        &recv_msg,
        &[],
    );
    println!("{:?}", &result);
    let res = result.unwrap();

    assert!(res.events.iter().any(|e| e.ty == "transfer"
        && e.attributes
            .iter()
            .any(|attr| attr.key == "recipient" && attr.value == "user2")));
}

#[test]
#[should_panic(expected = "InsufficientFunds")]
fn test_insufficient_native_funds() {
    let mut app = mock_app();
    let code_id = store_code(&mut app);
    let contract_addr = instantiate_contract(&mut app, code_id, USER1);

    // Test insufficient funds error
    let swap_msg = ExecuteMsg::Swap {
        dst_nid: "dst-nid".to_string(),
        token: NATIVE_DENOM.to_string(),
        amount: 1000,
        to_token: "to_token".to_string(),
        destination_address: USER2.to_string(),
        min_receive: 900,
        data: vec![],
    };
    fund_account(&mut app, USER1.to_string(), 200, NATIVE_DENOM.to_string());
    let err = app
        .execute_contract(
            Addr::unchecked(USER1),
            contract_addr.clone(),
            &swap_msg,
            &[Coin {
                denom: NATIVE_DENOM.to_string(),
                amount: Uint128::new(100),
            }],
        )
        .unwrap();
}

#[test]
#[should_panic(expected = "InvalidMessageType")]
fn test_invalid_message_type_panics() {
    let mut app = mock_app();
    let code_id = store_code(&mut app);
    let contract_addr = instantiate_contract(&mut app, code_id, USER1);

    // Test invalid message type error
    let invalid_order_msg = OrderMsg {
        msg_type: 5, // Invalid message type
        message: vec![],
    };

    let recv_msg = ExecuteMsg::RecvMessage {
        src_network: "src-nid".to_string(),
        conn_sn: 1,
        msg: invalid_order_msg.rlp_bytes().to_vec(),
    };

    let err = app
        .execute_contract(
            Addr::unchecked(USER1),
            contract_addr.clone(),
            &recv_msg,
            &[],
        )
        .unwrap();
}

#[test]
#[should_panic(expected = "OrderAlreadyComplete")]
fn test_fill_already_finished_order() {
    let mut app = mock_app();
    let code_id = store_code(&mut app);
    let contract_addr = instantiate_contract(&mut app, code_id, USER1);

    fund_account(&mut app, USER2.to_string(), 200, "to_token".to_string());

    let fill_msg = ExecuteMsg::Fill {
        id: 1,
        emitter: contract_addr.to_string(),
        src_nid: "test-nid".to_string(),
        dst_nid: "src-nid".to_string(),
        creator: USER1.to_string(),
        destination_address: USER2.to_string(),
        token: NATIVE_DENOM.to_string(),
        amount: 100,
        to_token: "to_token".to_string(),
        min_receive: 90,
        data: hex::decode("deadbeef").unwrap(),
        fill_amount: 90,
        solver_address: USER2.to_string(),
    };

    app.execute_contract(
        Addr::unchecked(USER2),
        contract_addr.clone(),
        &fill_msg,
        &[Coin {
            denom: "to_token".to_string(),
            amount: Uint128::new(90),
        }],
    )
    .unwrap();

    // Try to fill the same order again
    let err = app
        .execute_contract(
            Addr::unchecked(USER2),
            contract_addr.clone(),
            &fill_msg,
            &[Coin {
                denom: "to_token".to_string(),
                amount: Uint128::new(90),
            }],
        )
        .unwrap();
}

#[test]
#[should_panic(expected = "OrderAlreadyComplete")]
fn test_cancel_already_finished_order() {
    let mut app = mock_app();
    let code_id = store_code(&mut app);
    let contract_addr = instantiate_contract(&mut app, code_id, USER1);

    fund_account(&mut app, USER2.to_string(), 100, "to_token".to_string());
    let fill_msg = ExecuteMsg::Fill {
        id: 1,
        emitter: contract_addr.to_string(),
        src_nid: "dst-nid".to_string(),
        dst_nid: "src-nid".to_string(),
        creator: USER1.to_string(),
        destination_address: USER2.to_string(),
        token: NATIVE_DENOM.to_string(),
        amount: 100,
        to_token: "to_token".to_string(),
        min_receive: 90,
        data: hex::decode("deadbeef").unwrap(),
        fill_amount: 90,
        solver_address: USER2.to_string(),
    };

    app.execute_contract(
        Addr::unchecked(USER2),
        contract_addr.clone(),
        &fill_msg,
        &[Coin {
            denom: "to_token".to_string(),
            amount: Uint128::new(90),
        }],
    )
    .unwrap();

    // Try to cancel the already finished order
    let cancel_order = SwapOrder {
        id: 1,
        emitter: contract_addr.to_string(),
        src_nid: "dst-nid".to_string(),
        dst_nid: "src-nid".to_string(),
        creator: USER1.to_string(),
        destination_address: USER2.to_string(),
        token: NATIVE_DENOM.to_string(),
        amount: 100,
        to_token: "to_token".to_string(),
        min_receive: 90,
        data: hex::decode("deadbeef").unwrap(),
    };

    let cancel_msg = OrderMsg {
        msg_type: 2, // ORDER_CANCEL
        message: OrderCancel {
            order_bytes: cancel_order.rlp_bytes().to_vec(),
        }
        .rlp_bytes()
        .to_vec(),
    };

    let recv_msg = ExecuteMsg::RecvMessage {
        src_network: "dst-nid".to_string(),
        conn_sn: 1,
        msg: cancel_msg.rlp_bytes().to_vec(),
    };

    let err = app
        .execute_contract(
            Addr::unchecked(USER1),
            contract_addr.clone(),
            &recv_msg,
            &[],
        )
        .unwrap();
}

#[test]
fn test_internal_functions() {
    let mut deps = mock_dependencies();
    let env = mock_env();
    let info = mock_info(USER1, &[]);
    let service = CwIntentV1Service::default();

    // Test is_contract
    assert!(!service.is_contract(deps.as_ref(), &Addr::unchecked(USER1)));

    // Test is_native
    assert!(service.is_native(deps.as_ref(), &NATIVE_DENOM.to_string()));

    // Test get_next_deposit_id
    service.set_deposit_id(deps.as_mut().storage, 5).unwrap();
    let next_id = service.get_next_deposit_id(deps.as_mut().storage).unwrap();
    assert_eq!(next_id, 6);

    // Test get_next_conn_sn
    service.set_conn_sn(deps.as_mut().storage, 10).unwrap();
    let next_sn = service.get_next_conn_sn(deps.as_mut().storage).unwrap();
    assert_eq!(next_sn, 11);
}
