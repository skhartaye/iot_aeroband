module aeroband_token::aeroband_token {
    use std::option::{Self, Option};
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::url::{Self, Url};

    /// The type identifier of aeroband_token. The coin will have a type
    /// tag of kind: `Coin<package_object::aeroband_token::AEROBAND_TOKEN>`
    /// Make sure that the name of the type matches the module's name.
    struct AEROBAND_TOKEN has drop {}

    /// Module initializer is called once on module publish.
    /// A treasury cap is sent to the publisher, who then controls minting and burning
    fun init(witness: AEROBAND_TOKEN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency(
            witness, 
            9, // decimals
            b"AEROBAND", // symbol
            b"Aeroband Token", // name
            b"Token earned by completing IoT project tasks", // description
            option::some(url::new_unsafe_from_bytes(b"https://aeroband.io/token-icon.png")), // icon url
            ctx
        );
        // Transfer the treasury cap to the module publisher
        transfer::transfer(treasury_cap, tx_context::sender(ctx));
        // Share the metadata object
        transfer::share_object(metadata);
    }

    /// Mint tokens to the specified address
    /// Only the treasury cap owner can call this function
    public fun mint(
        treasury_cap: &mut TreasuryCap<AEROBAND_TOKEN>,
        recipient: address,
        amount: u64,
        ctx: &mut TxContext
    ) {
        coin::mint_and_transfer(treasury_cap, amount, recipient, ctx)
    }

    /// Burn tokens from the treasury cap
    /// Only the treasury cap owner can call this function
    public fun burn(treasury_cap: &mut TreasuryCap<AEROBAND_TOKEN>, coin: Coin<AEROBAND_TOKEN>) {
        coin::burn(treasury_cap, coin);
    }

    /// Transfer tokens to another address
    public fun transfer(coin: Coin<AEROBAND_TOKEN>, recipient: address, _ctx: &mut TxContext) {
        transfer::transfer(coin, recipient)
    }

    /// Split a coin into two coins
    public fun split(coin: &mut Coin<AEROBAND_TOKEN>, amount: u64, ctx: &mut TxContext): Coin<AEROBAND_TOKEN> {
        coin::split(coin, amount, ctx)
    }

    /// Join two coins together
    public fun join(coin1: &mut Coin<AEROBAND_TOKEN>, coin2: Coin<AEROBAND_TOKEN>) {
        coin::join(coin1, coin2)
    }

    /// Get the balance of a coin
    public fun value(coin: &Coin<AEROBAND_TOKEN>): u64 {
        coin::value(coin)
    }
}
