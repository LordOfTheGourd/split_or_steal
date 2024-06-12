use anchor_lang::prelude::Pubkey;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_lang::solana_program::pubkey;
use anchor_lang::solana_program::sysvar::instructions as sysvar_instructions;
use anchor_lang::solana_program::sysvar::slot_hashes;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::{associated_token::AssociatedToken, token::Burn};
use sysvar_instructions::{load_current_index_checked, load_instruction_at_checked};

use rand::Rng;
use rand_chacha::{rand_core::SeedableRng, ChaCha8Rng};

pub mod error;
pub mod instructions;
pub mod state;

pub use crate::instructions::*;
pub use crate::state::*;
pub use error::SplitOrStealError;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "split or steal",
    project_url: "https://x.com/Lord0fTheGourd",
    contacts: "https://x.com/Lord0fTheGourd",
    policy: "The tokens are the bounty. Yes, yes, it's vulnerable to jito bundling but there's extra statistical checks to prevent getting too lucky (>99%) over a long time horizon.",
    source_code: "https://github.com/LordOfTheGourd",
    source_release: "v0.1",
    auditors: "",
    acknowledgements: ""
}

declare_id!("SRSPsMqHaSLJjPNKEoQbTeF6TSvospw2PXGkfj4VzhD");

#[program]
pub mod split_or_steal {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>, token_amount: u64) -> Result<()> {
        InitializeVault::handle(ctx, token_amount)
    }

    pub fn play_game(ctx: Context<PlayGame>, choice: Choice, stake_amount: u16) -> Result<()> {
        PlayGame::handle(ctx, choice, stake_amount)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
