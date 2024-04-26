#[allow(unused_field,unused_use,unused_const,unused_mut_parameter,unused_variable,unused_assignment)]
module xcall::xcall_state {
     use sui::object::{Self, UID,ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::linked_table::{Self, LinkedTable};
    use sui::types as sui_types;
    use std::string::{Self, String};
    use std::vector;
    use std::option::{Self, Option};
   
    use xcall::network_address::{Self,NetworkAddress};
    use xcall::envelope::{Self,XCallEnvelope};
    use xcall::message_request::{Self, CSMessageRequest};
    use xcall::cs_message::{Self};
    use xcall::rollback_data::{Self,RollbackData};
    use sui::bag::{Bag, Self};
    use sui::table::{Table,Self};
    use sui::package::{Self,Publisher};
  
    use sui::vec_map::{Self, VecMap};
    use sui::versioned::{Self, Versioned};


     public struct IDCap has key,store {
        id:UID,
        xcall_id:ID,
    }
    public struct PackageCap has store {
        package_id:String,
    }
     public struct AdminCap has key {
        id: UID
    }

    public struct PendingReqResKey has copy, drop, store{
        data_hash :vector<u8>,
        caller :String
    }


     public struct Storage has key {
        id: UID,
        version:u64,
        admin:ID,
        nid: String,
        network_address:NetworkAddress,
        requests:LinkedTable<u128, vector<u8>>,
        sequence_no:u128,
        protocol_fee:u128,
        protocol_fee_handler:address,
        connection_states:Bag,
        rollbacks:Table<u128,RollbackData>,
        connections:VecMap<String,String>,
        pending_responses: VecMap<PendingReqResKey,bool>,
        pending_requests: VecMap<PendingReqResKey,bool>,
        successful_responses: VecMap<u128, bool>,
        request_id: u128,
        proxy_requests:Table<u128, CSMessageRequest>,
        reply_state: CSMessageRequest,
        call_reply: vector<u8>
    }

    public(package) fun create_admin_cap(ctx: &mut TxContext):AdminCap {
         let admin = AdminCap {
            id: object::new(ctx),
        };
        admin
    }

    public(package) fun create_id_cap(storage:&Storage,ctx: &mut TxContext):IDCap {
          IDCap {
            id: object::new(ctx),
            xcall_id:object::id(storage)

        }

    }

    public(package) fun create_storage(version:u64,admin:&AdminCap, ctx: &mut TxContext):Storage {
         let storage = Storage {
            id: object::new(ctx),
            version:version,
            nid: string::utf8(b""),
            network_address: network_address::from_string(string::utf8(b"")),
            admin:object::id(admin),
            requests:linked_table::new<u128, vector<u8>>(ctx),
            sequence_no:0,
            protocol_fee:0,
            protocol_fee_handler: tx_context::sender(ctx),
            connection_states:bag::new(ctx),
            rollbacks:table::new<u128,RollbackData>(ctx),
            connections:vec_map::empty<String,String>(),
            pending_responses:vec_map::empty<PendingReqResKey,bool>(),
            pending_requests:vec_map::empty<PendingReqResKey,bool>(),
            successful_responses:vec_map::empty<u128,bool>(),
            request_id:0,
            proxy_requests:table::new<u128, CSMessageRequest>(ctx),
            reply_state:message_request::new(),
            call_reply:vector::empty<u8>()

        };
        storage
    }

    public(package) fun set_version(self:&mut Storage,version:u64){
            self.version=version;
    }

    public(package) fun set_connection(self:&mut Storage,net_id:String,package_id:String){
            vec_map::insert(&mut self.connections,net_id,package_id);
    }

    public(package) fun set_reply_state(self:&mut Storage,reply_state:CSMessageRequest){
            self.reply_state=reply_state;
    }

    public(package) fun set_call_reply(self:&mut Storage,call_reply:vector<u8>){
            self.call_reply=call_reply;
    }

    public(package) fun remove_reply_state(self:&mut Storage){
            self.reply_state=message_request::new();
    }

    public(package) fun remove_call_reply(self:&mut Storage){
            self.call_reply=vector::empty<u8>();
    }

    public(package) fun add_rollback(self:&mut Storage,sequence_no:u128,rollback:RollbackData){
         table::add(&mut self.rollbacks,sequence_no,rollback);
    }

    public(package) fun add_proxy_request(self:&mut Storage,req_id:u128,proxy_request:CSMessageRequest){
         table::add(&mut self.proxy_requests,req_id,proxy_request);
    }

    public(package) fun remove_proxy_request(self:&mut Storage,req_id:u128){
         table::remove(&mut self.proxy_requests,req_id);
    }

    public(package) fun get_proxy_request(self:&mut Storage,req_id:u128):&CSMessageRequest{
         table::borrow(&self.proxy_requests,req_id)
    }

    public(package) fun network_address(self:&Storage):NetworkAddress{
        self.network_address
    }

    public fun get_version(self:&Storage):u64{
        self.version
    }

    public fun get_admin(self:&Storage):ID {
        self.admin
    }

    public fun get_reply_state(self:&Storage):CSMessageRequest{
        self.reply_state
    }

    public fun get_call_reply(self:&Storage):vector<u8>{
        self.call_reply
    }

    public fun get_connection(self:&Storage,nid:String):String{
        *vec_map::get(&self.connections,&nid)
    }

    public fun get_connection_states(self:&mut Storage):&mut Bag{
        &mut self.connection_states
    }

    public fun get_protocol_fee(self:&Storage):u128{
        self.protocol_fee
    }

    public fun get_protocol_fee_handler(self:&Storage):address{
        self.protocol_fee_handler
    }

    public(package) fun get_next_sequence(self:&mut Storage):u128 {
        let sn=self.sequence_no+1;
        self.sequence_no=sn;
        sn
    }

   public fun get_rollback(self: &mut Storage, sequence_no: u128): RollbackData {
        *table::borrow(&self.rollbacks, sequence_no)
    }

    public fun get_mut_rollback(self: &mut Storage, sequence_no: u128): &mut RollbackData {
        table::borrow_mut(&mut self.rollbacks, sequence_no)
    }

    public fun has_rollback(self: &mut Storage , sequence_no: u128): bool {
        table::contains(&self.rollbacks, sequence_no)
    }


    public(package) fun set_protocol_fee(self:&mut Storage,fee:u128){
        self.protocol_fee=fee;
    }

    public(package) fun set_protocol_fee_handler(self:&mut Storage,fee_handler:address){
        self.protocol_fee_handler=fee_handler;
    }

    public(package) fun transfer_admin_cap(admin:AdminCap,ctx: &mut TxContext){
        transfer::transfer(admin, tx_context::sender(ctx));
    }

    public(package) fun share(self:Storage){
         transfer::share_object(self);
    }

    public(package) fun check_pending_responses(self: &mut Storage, data_hash: vector<u8>, sources: vector<String>):bool {
        let mut i = 0;
        while(i < vector::length(&sources)) {
            let source = vector::borrow(&sources, i);
            let pending_response = PendingReqResKey { data_hash, caller: *source };
            if(!vec_map::contains(&self.pending_responses, &pending_response)) {
                return false
            };
            i = i + 1   
        };
        true
    }

    public(package) fun save_pending_responses(self: &mut Storage, data_hash: vector<u8>, caller: String) {
        let pending_response = PendingReqResKey { data_hash, caller };
        vec_map::insert(&mut self.pending_responses, pending_response, true);
    }

    public(package) fun get_pending_response(self: &mut Storage, data_hash: vector<u8>, caller: String): bool {
        let pending_response = PendingReqResKey { data_hash, caller };
        vec_map::contains(&self.pending_responses, &pending_response)
    }

    public(package) fun remove_pending_responses(self: &mut Storage, data_hash: vector<u8>, sources: vector<String>) {
        let mut i = 0;
        while(i < vector::length(&sources)) {
            let source = vector::borrow(&sources, i);
            vec_map::remove(&mut self.pending_responses, &PendingReqResKey { data_hash, caller: *source });
            i = i + 1   
        };
    }

    
    public(package) fun check_pending_requests(self: &mut Storage, data_hash: vector<u8>, sources: vector<String>):bool {
        let mut i = 0;
        while(i < vector::length(&sources)) {
            let source = vector::borrow(&sources, i);
            let pending_request = PendingReqResKey { data_hash, caller: *source };
            if(!vec_map::contains(&self.pending_requests, &pending_request)) {
                return false
            };
            i = i + 1   
        };
        true
    }

    public(package) fun save_pending_requests(self: &mut Storage, data_hash: vector<u8>, caller: String) {
        let pending_request = PendingReqResKey { data_hash, caller };
        vec_map::insert(&mut self.pending_requests, pending_request, true);
    }

    public(package) fun get_pending_requests(self: &mut Storage, data_hash: vector<u8>, caller: String): bool {
        let pending_request = PendingReqResKey { data_hash, caller };
        vec_map::contains(&self.pending_requests, &pending_request)
    }

    public(package) fun remove_pending_requests(self: &mut Storage, data_hash: vector<u8>, sources: vector<String>) {
        let mut i = 0;
        while(i < vector::length(&sources)) {
            let source = vector::borrow(&sources, i);
            vec_map::remove(&mut self.pending_requests, &PendingReqResKey { data_hash, caller: *source });
            i = i + 1   
        };
    }

    public(package) fun remove_rollback(self: &mut Storage,sequence_no:u128){
        table::remove(&mut self.rollbacks, sequence_no);
    }

    public(package) fun set_successful_responses(self: &mut Storage, sequence_no: u128) {
        vec_map::insert(&mut self.successful_responses, sequence_no, true);
    }

    public(package) fun get_successful_responses(self: &mut Storage, sequence_no: u128): bool {
        vec_map::contains(&self.successful_responses, &sequence_no)
    }

    public(package) fun get_next_request_id(self: &mut Storage): u128 {
        let id = self.request_id + 1;
        self.request_id = id;
        id
    }

       #[test_only]
    public fun share_storage_for_testing(admin:AdminCap,ctx: &mut TxContext):Storage {
        let storage =create_storage(0,&admin,ctx);
       transfer_admin_cap(admin,ctx);
        storage
    }

    #[test_only]
    public fun AdminCap_for_testing(ctx: &mut TxContext):AdminCap {
        create_admin_cap(ctx)
    }

    #[test_only]
    public fun create_id_cap_for_testing(storage: &mut Storage,ctx: &mut TxContext):IDCap {
        create_id_cap(storage,ctx)
    }

}