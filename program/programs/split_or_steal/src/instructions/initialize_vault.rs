use super::*;

// const DEFAULT_TOKENS: u64 = 1_000_000_000;
pub const DEFAULT_DECIMALS: u8 = 9;

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut)]
    pub creator_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        payer = creator,
        seeds = [b"lord of the gourd"],
        bump,
        space = 8 + std::mem::size_of::<GameVault>()
    )]
    pub game_vault: Box<Account<'info, GameVault>>,
    #[account(
        init,
        payer = creator,
        seeds = [game_vault.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = game_vault
    )]
    pub game_vault_token_account: Box<Account<'info, TokenAccount>>,
    /// CHECK: All the checks have been moved into the function because can't do is_none() check on the authorities in the constraints
    pub mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl InitializeVault<'_> {
    pub fn handle(ctx: Context<Self>, token_amount: u64) -> Result<()> {
        let InitializeVault {
            game_vault,
            creator,
            creator_token_account,
            game_vault_token_account,
            mint,
            token_program,
            ..
        } = ctx.accounts;

        msg!(
            "Mint Account - pubkey: {}, mint_authority: {:?}, supply: {}, decimals: {}, is_initialized: {}, freeze_authority: {:?}",
            mint.key(),
            mint.mint_authority,
            mint.supply,
            mint.decimals,
            mint.is_initialized,
            mint.freeze_authority
        );

        require_eq!(
            mint.decimals,
            DEFAULT_DECIMALS,
            SplitOrStealError::InvalidMintDecimals
        );
        require_eq!(
            mint.supply,
            token_amount,
            SplitOrStealError::InvalidMintSupply
        );
        require!(
            mint.mint_authority.is_none(),
            SplitOrStealError::MintAuthorityNotRevoked
        );
        require!(
            mint.freeze_authority.is_none(),
            SplitOrStealError::FreezeAuthorityNotRevoked
        );
        require_eq!(
            creator_token_account.amount,
            token_amount,
            SplitOrStealError::InvalidInitialTokens
        );

        game_vault.initialize(
            creator.key(),
            token_amount,
            ctx.bumps.game_vault,
            ctx.bumps.game_vault_token_account,
        );

        // Transfer initial tokens to the vault's token account
        let cpi_accounts: Transfer = Transfer {
            from: creator_token_account.to_account_info(),
            to: game_vault_token_account.to_account_info(),
            authority: creator.to_account_info(),
        };
        let cpi_program = token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, creator_token_account.amount)
    }
}
