import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { BankrunProvider } from "anchor-bankrun";
import {
  TOKEN_PROGRAM_ID,
  setAuthority,
  AuthorityType,
} from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo"; // Import Memo program ID

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
import { assert } from "chai";

import {
  BanksClient,
  Clock,
  ProgramTestContext,
  startAnchor,
} from "solana-bankrun";

const SPLIT_OR_STEAL_PROGRAM_ID = new PublicKey(
  "SRSPsMqHaSLJjPNKEoQbTeF6TSvospw2PXGkfj4VzhD"
);

import { SplitOrSteal } from "../target/types/split_or_steal";
const SplitOrStealIDL: SplitOrSteal = require("../target/idl/split_or_steal.json");

// Reference if we need to access a type on the IDL
// type MyAccount = IdlAccounts<MyIdl>["myAccount"];

export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;
export type Keypair = anchor.web3.Keypair;

import { createMint, createAccount, getMint, mintTo } from "spl-token-bankrun";
import { associated } from "@coral-xyz/anchor/dist/cjs/utils/pubkey";

const NUM_SLOTS_COOLDOWN = 3;

async function advanceClockBySlots(
  context: ProgramTestContext,
  slotsToAdvance: number
) {
  let currentClock = await context.banksClient.getClock();
  const newSlot = currentClock.slot + BigInt(slotsToAdvance);
  context.setClock(
    new Clock(
      newSlot,
      currentClock.epochStartTimestamp,
      currentClock.epoch,
      currentClock.leaderScheduleEpoch,
      currentClock.unixTimestamp
    )
  );
}

async function createNewMint(
  provider,
  decimals,
  mintAuthority,
  freezeAuthority
) {
  // Create a new Keypair for the mint
  const mint = anchor.web3.Keypair.generate();

  // Create the mint account
  await provider.sendAndConfirm(
    new anchor.web3.Transaction().add(
      // Create mint account
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        space: token.MintLayout.span,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(
          token.MintLayout.span
        ),
        programId: token.TOKEN_PROGRAM_ID,
      }),
      // Initialize the mint account
      token.createInitializeMintInstruction(
        mint.publicKey, // Mint account
        decimals, // Number of decimals
        mintAuthority, // Mint authority
        freezeAuthority, // Freeze authority
        token.TOKEN_PROGRAM_ID
      )
    ),
    [mint]
  );

  return mint.publicKey;
}
async function revokeMintAndFreezeAuthorities(
  provider,
  mint: PublicKey,
  currentAuthority: PublicKey
) {
  // Create transaction instructions to revoke mint and freeze authorities
  const tx = new anchor.web3.Transaction().add(
    // Revoke mint authority
    token.createSetAuthorityInstruction(
      mint,
      currentAuthority,
      AuthorityType.MintTokens,
      null,
      [],
      TOKEN_PROGRAM_ID
    ),
    // Revoke freeze authority
    token.createSetAuthorityInstruction(
      mint,
      currentAuthority,
      AuthorityType.FreezeAccount,
      null,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // Send and confirm the transaction
  await provider.sendAndConfirm(tx, [], { commitment: "confirmed" });
}

describe("split_or_steal", async function () {
  let provider,
    connection,
    splitOrSteal,
    payer,
    context: ProgramTestContext,
    banksClient: BanksClient,
    tokenAmount,
    gameVaultPDA,
    gameVaultTokenAccountPDA,
    playerTokenAccountPDA,
    playerProfilePDA,
    TOKEN_MINT;

  before(async function () {
    context = await startAnchor("./", [], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    splitOrSteal = new anchor.Program<SplitOrSteal>(
      SplitOrStealIDL,
      SPLIT_OR_STEAL_PROGRAM_ID,
      provider
    );

    payer = splitOrSteal.provider.wallet.payer;

    // TOKEN_MINT = await createMint(
    //   banksClient,
    //   payer,
    //   payer.publicKey,
    //   payer.publicKey,
    //   9
    // );
  });

  describe("#initialize_vault", async function () {
    it("initializes the game vault", async function () {
      // Create a new mint using the helper function
      TOKEN_MINT = await createNewMint(
        provider,
        9, // Number of decimals
        payer.publicKey, // Mint authority
        payer.publicKey // Freeze authority
      );

      // UPDATE HERE IF NEEDS BE
      let num_tokens = 200_000;
      let nine_decimals = 1_000_000_000;
      const tokenAmount = new BN(num_tokens * nine_decimals);
      gameVaultPDA = PublicKey.findProgramAddressSync(
        [Buffer.from("lord of the gourd")],
        SPLIT_OR_STEAL_PROGRAM_ID
      )[0];

      gameVaultTokenAccountPDA = PublicKey.findProgramAddressSync(
        [gameVaultPDA.toBuffer()],
        SPLIT_OR_STEAL_PROGRAM_ID
      )[0];

      const creatorTokenAccount = await createAccount(
        banksClient,
        payer,
        TOKEN_MINT,
        payer.publicKey
      );

      await mintTo(
        banksClient,
        payer,
        TOKEN_MINT,
        creatorTokenAccount,
        payer,
        tokenAmount.toNumber()
      );

      //   await advanceClockBySlots(context, 100);

      // Revoke mint and freeze authorities
      await revokeMintAndFreezeAuthorities(
        provider,
        TOKEN_MINT,
        payer.publicKey
      );

      //   // Create a dummy keypair to receive the transfer
      //   const dummyReceiver = Keypair.generate();

      //   // Send a minimal SOL transfer to advance the clock
      //   const tx = new anchor.web3.Transaction().add(
      //     SystemProgram.transfer({
      //       fromPubkey: payer.publicKey,
      //       toPubkey: dummyReceiver.publicKey,
      //       lamports: 10000000, // Sending the smallest possible amount
      //     })
      //   );

      // Send and confirm the transaction
      //   await provider.sendAndConfirm(tx);

      console.log({
        creator: payer.publicKey.toBase58(),
        creatorTokenAccount: creatorTokenAccount.toBase58(),
        gameVault: gameVaultPDA.toBase58(),
        gameVaultTokenAccount: gameVaultTokenAccountPDA.toBase58(),
        mint: TOKEN_MINT.toBase58(),
        tokenProgram: token.TOKEN_PROGRAM_ID.toBase58(),
        systemProgram: SystemProgram.programId.toBase58(),
      });

      await splitOrSteal.methods
        .initializeVault(tokenAmount)
        .accounts({
          creator: payer.publicKey,
          creatorTokenAccount: creatorTokenAccount,
          gameVault: gameVaultPDA,
          gameVaultTokenAccount: gameVaultTokenAccountPDA,
          mint: TOKEN_MINT,
          tokenProgram: token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const gameVaultAccount = await splitOrSteal.account.gameVault.fetch(
        gameVaultPDA
      );
      assert.equal(
        gameVaultAccount.mintRemaining.toNumber(),
        tokenAmount.toNumber()
      );
      assert.equal(
        gameVaultAccount.creator.toBase58(),
        payer.publicKey.toBase58()
      );

      let mintAccount = await getMint(banksClient, TOKEN_MINT);
      assert(mintAccount.mintAuthority === null);
      assert(mintAccount.freezeAuthority === null);
    });
  });

  describe("#play_game", async function () {
    it("plays the game with a given stake amount and choice", async function () {
      advanceClockBySlots(context, NUM_SLOTS_COOLDOWN);
      // Assuming the vault has already been initialized and TOKEN_MINT is set up
      const stakeAmount = new BN(0); // 0 tokens
      const choice = { split: {} }; // Assuming choice is an enum-like object

      playerTokenAccountPDA = token.getAssociatedTokenAddressSync(
        TOKEN_MINT,
        payer.publicKey
      );

      playerProfilePDA = PublicKey.findProgramAddressSync(
        [payer.publicKey.toBuffer()],
        SPLIT_OR_STEAL_PROGRAM_ID
      )[0];
      // Advance the clock to simulate the passing of time, if needed
      //   await advanceClockBySlots(context, 100);
      //   console.log("sysvar slot hashes", anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY);

      const memoInstruction = new anchor.web3.TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from("Your memo message"),
      });

      // Fetch the payer's balance before the transaction
      //   const balanceBefore = await provider.connection.getBalance(
      //     // payer.publicKey
      //   );
      //   const balanceBefore = await banksClient.getBalance(payer.publicKey);
      //   console.log(
      //     "Balance before transaction:",
      //     Number(balanceBefore) / 1e9,
      //     "SOL"
      //   );

      await splitOrSteal.methods
        .playGame(choice, 0)
        .accounts({
          player: payer.publicKey,
          playerProfile: playerProfilePDA,
          playerTokenAccount: playerTokenAccountPDA,
          gameVault: gameVaultPDA,
          gameVaultTokenAccount: gameVaultTokenAccountPDA,
          creator: payer.publicKey,
          mint: TOKEN_MINT,
          slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
          instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .preInstructions([
          anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000,
          }),
          anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 100,
          }),
        ])
        // .postInstructions([memoInstruction])
        .rpc();

      // Fetch the payer's balance after the transaction
      //   const balanceAfter = await banksClient.getBalance(payer.publicKey);
      //   console.log(
      //     "Balance after transaction:",
      //     Number(balanceAfter) / 1e9,
      //     "SOL"
      //   );

      //   const transactionCost =
      //     (Number(balanceBefore) - Number(balanceAfter)) / 1e9;
      //   console.log("Transaction cost:", transactionCost, "SOL");

      // Fetch and validate the results
      const playerTokenAccountInfo = await token.getAccount(
        provider.connection,
        playerTokenAccountPDA
      );
      //   assert(playerTokenAccountInfo.amount.gte(stakeAmount));

      const gameVaultAccount = await splitOrSteal.account.gameVault.fetch(
        gameVaultPDA
      );
      //   assert(gameVaultAccount.mintRemaining.lt(tokenAmount.sub(stakeAmount)));
    });

    it("plays the game with a new player having sufficient SOL", async function () {
      // Create a new keypair for the test
      const newPlayer = anchor.web3.Keypair.generate();

      // Transfer sufficient SOL to the new player from the payer
      const transferAmount = 1_000_000_000; // Example amount, adjust as needed
      const transferTransaction = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: newPlayer.publicKey,
          lamports: transferAmount,
        })
      );

      // Send and confirm the transfer transaction
      await provider.sendAndConfirm(transferTransaction, [payer]);

      // Ensure the new player has the transferred SOL amount
      const initialBalance = Number(
        await banksClient.getBalance(newPlayer.publicKey)
      );
      //   console.log(
      //     "Initial balance of new player:",
      //     initialBalance / 1e9,
      //     "SOL"
      //   );

      const stakeAmount = new BN(0); // 0 tokens
      const choice = { split: {} }; // Assuming choice is an enum-like object

      const playerTokenAccountPDA = token.getAssociatedTokenAddressSync(
        TOKEN_MINT,
        newPlayer.publicKey
      );

      const playerProfilePDA = PublicKey.findProgramAddressSync(
        [newPlayer.publicKey.toBuffer()],
        SPLIT_OR_STEAL_PROGRAM_ID
      )[0];

      // Fetch the new player's balance before the transaction
      const balanceBefore = await banksClient.getBalance(newPlayer.publicKey);
      //   console.log("Balance before transaction:", balanceBefore / 1e9, "SOL");

      await splitOrSteal.methods
        .playGame(choice, 0)
        .accounts({
          player: newPlayer.publicKey,
          playerProfile: playerProfilePDA,
          playerTokenAccount: playerTokenAccountPDA,
          gameVault: gameVaultPDA,
          gameVaultTokenAccount: gameVaultTokenAccountPDA,
          creator: payer.publicKey,
          mint: TOKEN_MINT,
          slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
          instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([newPlayer])
        .preInstructions([
          anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
            units: 130_000,
          }),
          anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 10000, // This isn't even being reduced from the cost of the transaction somehow?
          }),
        ])
        .rpc();

      // Fetch the new player's balance after the transaction
      const balanceAfter = await banksClient.getBalance(newPlayer.publicKey);
      //   console.log("Balance after transaction:", balanceAfter / 1e9, "SOL");

      const transactionCost =
        (Number(balanceBefore) - Number(balanceAfter)) / 1e9;
      console.log("Transaction cost:", transactionCost, "SOL");

      // Fetch and validate the results
      const playerTokenAccountInfo = await token.getAccount(
        provider.connection,
        playerTokenAccountPDA
      );
      // assert(playerTokenAccountInfo.amount.gte(stakeAmount));

      const gameVaultAccount = await splitOrSteal.account.gameVault.fetch(
        gameVaultPDA
      );
      // assert(gameVaultAccount.mintRemaining.lt(tokenAmount.sub(stakeAmount)));
    });

    it("should log game results and compute units usage for a new player", async function () {
      const choice = { split: {} }; // Assuming choice is an enum-like object

      // Function to simulate the playGame transaction
      async function simulatePlayGame() {
        // Create a new keypair for the test
        const newPlayer = anchor.web3.Keypair.generate();

        // Transfer sufficient SOL to the new player from the payer
        const transferAmount = 1_000_000_000; // Example amount, adjust as needed
        const transferTransaction = new anchor.web3.Transaction().add(
          anchor.web3.SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: newPlayer.publicKey,
            lamports: transferAmount,
          })
        );

        // Send and confirm the transfer transaction
        await provider.sendAndConfirm(transferTransaction, [payer]);

        const playerTokenAccountPDA = token.getAssociatedTokenAddressSync(
          TOKEN_MINT,
          newPlayer.publicKey
        );

        const playerProfilePDA = PublicKey.findProgramAddressSync(
          [newPlayer.publicKey.toBuffer()],
          SPLIT_OR_STEAL_PROGRAM_ID
        )[0];

        const playGameInstruction = await splitOrSteal.methods
          .playGame(choice, 0)
          .accounts({
            player: newPlayer.publicKey,
            playerProfile: playerProfilePDA,
            playerTokenAccount: playerTokenAccountPDA,
            gameVault: gameVaultPDA,
            gameVaultTokenAccount: gameVaultTokenAccountPDA,
            creator: payer.publicKey,
            mint: TOKEN_MINT,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([newPlayer])
          //   .preInstructions([
          //     anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          //       units: 120_000,
          //     }),
          //     anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
          //       microLamports: 100,
          //     }),
          //   ])
          .instruction();

        // Construct a transaction
        let transaction = new anchor.web3.Transaction().add(
          anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
            units: 130_000,
          })
        );
        transaction.add(
          anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 100,
          })
        );
        transaction.add(playGameInstruction);
        transaction.recentBlockhash = (
          await banksClient.getLatestBlockhash()
        )[0];
        transaction.feePayer = newPlayer.publicKey;
        transaction.sign(newPlayer);

        // Simulate the transaction
        const simulationResult = await context.banksClient.simulateTransaction(
          transaction
        );

        // Get log messages from the simulation metadata
        const logMessages = simulationResult.meta.logMessages;

        // Extract compute unit usage from log messages
        const computeUnitLog = logMessages.find(
          (msg) =>
            msg.includes(
              "SRSPsMqHaSLJjPNKEoQbTeF6TSvospw2PXGkfj4VzhD consumed"
            ) && msg.includes("compute units")
        );
        const computeUnitsUsed = parseInt(
          computeUnitLog.match(/consumed (\d+) of/)[1]
        );

        return computeUnitsUsed;
      }

      // Run simulations and calculate average compute unit usage
      let totalComputeUnitsUsed = 0;
      let minComputeUnitsUsed = Infinity;
      let maxComputeUnitsUsed = -Infinity;
      const numSimulations = 200;

      for (let i = 0; i < numSimulations; i++) {
        const computeUnitsUsed = await simulatePlayGame();
        totalComputeUnitsUsed += computeUnitsUsed;
        if (computeUnitsUsed < minComputeUnitsUsed) {
          minComputeUnitsUsed = computeUnitsUsed;
        }
        if (computeUnitsUsed > maxComputeUnitsUsed) {
          maxComputeUnitsUsed = computeUnitsUsed;
        }
        // console.log(`Simulation ${i + 1}: ${computeUnitsUsed} compute units used`);
      }

      const averageComputeUnitsUsed = totalComputeUnitsUsed / numSimulations;
      console.log(`Average compute units used: ${averageComputeUnitsUsed}`);
      console.log(`Minimum compute units used: ${minComputeUnitsUsed}`);
      console.log(`Maximum compute units used: ${maxComputeUnitsUsed}`);

      // Optionally, you can include an assertion for expected average compute unit usage
      // assert(averageComputeUnitsUsed <= expectedAverage, "Average compute units used exceeds the expected value");
    });
  });

  describe("#play_game_invalid_stake_amount", async function () {
    it("should fail if stake amount is above the maximum allowed", async function () {
      const invalidStakeAmount = new BN(101); // 101 tokens, above the maximum allowed (assuming 100)

      const choice = { split: {} };

      try {
        await splitOrSteal.methods
          .playGame(choice, invalidStakeAmount)
          .accounts({
            player: payer.publicKey,
            playerProfile: playerProfilePDA,
            playerTokenAccount: playerTokenAccountPDA,
            gameVault: gameVaultPDA,
            gameVaultTokenAccount: gameVaultTokenAccountPDA,
            creator: payer.publicKey,
            mint: TOKEN_MINT,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .preInstructions([
            anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
              units: 100_000,
            }),
            anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 100,
            }),
          ])
          .rpc();
        assert.fail(
          "The transaction should have failed due to invalid stake amount"
        );
      } catch (err) {
        assert.include(
          err.message,
          "StakeAmountTooHigh",
          "Invalid stake amount should cause an error"
        );
      }
    });

    it("should fail if stake amount is negative", async function () {
      const invalidStakeAmount = new BN(-1); // Negative stake amount

      const choice = { split: {} };

      try {
        await splitOrSteal.methods
          .playGame(choice, invalidStakeAmount)
          .accounts({
            player: payer.publicKey,
            playerProfile: playerProfilePDA,
            playerTokenAccount: playerTokenAccountPDA,
            gameVault: gameVaultPDA,
            gameVaultTokenAccount: gameVaultTokenAccountPDA,
            creator: payer.publicKey,
            mint: TOKEN_MINT,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .preInstructions([
            anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
              units: 100_000,
            }),
            anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 100,
            }),
          ])
          .rpc();
        assert.fail(
          "The transaction should have failed due to negative stake amount"
        );
      } catch (err) {
        assert.include(
          err.message,
          "out of range",
          "Negative stake amount should cause an error"
        );
      }
    });
  });

  describe("#play_game_insufficient_tokens", async function () {
    it("should fail if player has fewer tokens than the stake amount", async function () {
      const stakeAmount = new BN(50); // 50 tokens, assuming player has fewer than this
      const choice = { split: {} }; // Assuming choice is an enum-like object

      // Simulate player having insufficient tokens
      // In actual implementation, ensure player's token account has less than the stake amount

      // Check player's token account balance
      const playerTokenAccountInfo = await token.getAccount(
        provider.connection,
        playerTokenAccountPDA
      );

      //   console.log(playerTokenAccountInfo.amount);
      // Ensure the player has fewer tokens than the stake amount
      assert(
        playerTokenAccountInfo.amount <
          BigInt(stakeAmount.toNumber() * 1_000_000_000),
        "Player has too many tokens for the test"
      );

      try {
        await splitOrSteal.methods
          .playGame(choice, stakeAmount)
          .accounts({
            player: payer.publicKey,
            playerProfile: playerProfilePDA,
            playerTokenAccount: playerTokenAccountPDA,
            gameVault: gameVaultPDA,
            gameVaultTokenAccount: gameVaultTokenAccountPDA,
            creator: payer.publicKey,
            mint: TOKEN_MINT,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .preInstructions([
            anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
              units: 100_000,
            }),
            anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 100,
            }),
          ])
          .rpc();
        assert.fail(
          "The transaction should have failed due to insufficient tokens"
        );
      } catch (err) {
        assert.include(
          err.message,
          "InsufficientTokens",
          "Insufficient tokens should cause an error"
        );
      }
    });
  });

  describe("#play_game_uninitialized_player_profile", async function () {
    it("should initialize player profile if not already initialized", async function () {
      advanceClockBySlots(context, NUM_SLOTS_COOLDOWN);
      const stakeAmount = new BN(0); // 10 tokens
      const choice = { split: {} }; // Assuming choice is an enum-like object

      // Ensure player profile is not initialized
      // For the purpose of the test, we simulate this by not creating or resetting the player profile

      try {
        await splitOrSteal.methods
          .playGame(choice, stakeAmount)
          .accounts({
            player: payer.publicKey,
            playerProfile: playerProfilePDA,
            playerTokenAccount: playerTokenAccountPDA,
            gameVault: gameVaultPDA,
            gameVaultTokenAccount: gameVaultTokenAccountPDA,
            creator: payer.publicKey,
            mint: TOKEN_MINT,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .preInstructions([
            anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
              units: 100_000,
            }),
            anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 100,
            }),
          ])
          .rpc();

        const playerProfileAccount =
          await splitOrSteal.account.playerProfile.fetch(playerProfilePDA);

        assert(
          playerProfileAccount.isInitialized,
          "Player profile should be initialized"
        );
      } catch (err) {
        assert.fail(
          "The transaction should have succeeded with player profile initialization"
        );
      }
    });

    it("should fail if player has insufficient SOL for profile initialization", async function () {
      const stakeAmount = new BN(0); // 10 tokens
      const choice = { split: {} }; // Assuming choice is an enum-like object

      // Ensure player profile is not initialized
      // Simulate player having insufficient SOL by ensuring their balance is low

      // Create a new keypair for the test
      const newPlayer = anchor.web3.Keypair.generate();

      let too_small_amount = 6_000_000;
      // Transfer some SOL to the new player from the payer
      const transferTransaction = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: newPlayer.publicKey,
          lamports: too_small_amount, // Transfer 4_000_000 lamports (less than required for initialization)
        })
      );

      // Send and confirm the transfer transaction
      await provider.sendAndConfirm(transferTransaction, [payer]);

      // Ensure the new player has the transferred SOL amount
      const balance = Number(await banksClient.getBalance(newPlayer.publicKey));
      assert(
        balance === too_small_amount,
        "New player should have 400_000 lamports"
      );

      // Ensure the player has insufficient SOL for the test
      assert(
        balance < 12_000_000,
        "Player should have insufficient SOL for the test"
      );
      // Calculate the PDAs for the new player
      const [newPlayerProfilePDA, _] = PublicKey.findProgramAddressSync(
        [newPlayer.publicKey.toBuffer()],
        SPLIT_OR_STEAL_PROGRAM_ID
      );

      const newPlayerTokenAccountPDA = token.getAssociatedTokenAddressSync(
        TOKEN_MINT,
        newPlayer.publicKey
      );

      try {
        await splitOrSteal.methods
          .playGame(choice, stakeAmount)
          .accounts({
            player: newPlayer.publicKey,
            playerProfile: newPlayerProfilePDA,
            playerTokenAccount: newPlayerTokenAccountPDA,
            gameVault: gameVaultPDA,
            gameVaultTokenAccount: gameVaultTokenAccountPDA,
            creator: payer.publicKey,
            mint: TOKEN_MINT,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .preInstructions([
            anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
              units: 100_000,
            }),
            anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 100,
            }),
          ])
          .signers([newPlayer])
          .rpc();
        assert.fail(
          "The transaction should have failed due to insufficient SOL for profile initialization"
        );
      } catch (err) {
        // let newBalance = Number(
        //   await banksClient.getBalance(newPlayer.publicKey)
        // );
        // console.log(newBalance);
        // console.log("did we get here?", err);
        assert.include(
          err.message,
          "0x1", // insufficient lamports for transfer
          "Insufficient SOL should cause an error"
        );
      }
    });
  });

  describe("#play_game_instruction_validation", async function () {
    it("should fail if there are other game instructions in the transaction", async function () {
      const stakeAmount = new BN(10); // 10 tokens
      const choice = { split: {} }; // Assuming choice is an enum-like object

      // Generate a transaction instruction for the playGame method
      const extraPlayGameInstruction = await splitOrSteal.methods
        .playGame(choice, stakeAmount)
        .accounts({
          player: payer.publicKey,
          playerProfile: playerProfilePDA,
          playerTokenAccount: playerTokenAccountPDA,
          gameVault: gameVaultPDA,
          gameVaultTokenAccount: gameVaultTokenAccountPDA,
          creator: payer.publicKey,
          mint: TOKEN_MINT,
          slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
          instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .instruction();

      try {
        // Simulate sending another game instruction before the play_game instruction
        await splitOrSteal.methods
          .playGame(choice, stakeAmount)
          .accounts({
            player: payer.publicKey,
            playerProfile: playerProfilePDA,
            playerTokenAccount: playerTokenAccountPDA,
            gameVault: gameVaultPDA,
            gameVaultTokenAccount: gameVaultTokenAccountPDA,
            creator: payer.publicKey,
            mint: TOKEN_MINT,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .preInstructions([extraPlayGameInstruction])
          .rpc();
        assert.fail(
          "The transaction should have failed due to additional game instruction"
        );
      } catch (err) {
        assert.include(
          err.message,
          "UnexpectedInstruction",
          "Additional game instruction should cause an error"
        );
      }
    });

    it("should fail if previous instructions are not from the Compute Budget program", async function () {
      const stakeAmount = new BN(10); // 10 tokens
      const choice = { split: {} }; // Assuming choice is an enum-like object

      try {
        await splitOrSteal.methods
          .playGame(choice, stakeAmount)
          .accounts({
            player: payer.publicKey,
            playerProfile: playerProfilePDA,
            playerTokenAccount: playerTokenAccountPDA,
            gameVault: gameVaultPDA,
            gameVaultTokenAccount: gameVaultTokenAccountPDA,
            creator: payer.publicKey,
            mint: TOKEN_MINT,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .preInstructions([
            // Simulate a non Compute Budget program instruction
            anchor.web3.SystemProgram.transfer({
              fromPubkey: payer.publicKey,
              toPubkey: gameVaultPDA,
              lamports: 1,
            }),
          ])
          .rpc();
        assert.fail(
          "The transaction should have failed due to a non Compute Budget program instruction"
        );
      } catch (err) {
        assert.include(
          err.message,
          "InvalidComputeBudgetProgramId",
          "Non Compute Budget program instruction should cause an error"
        );
      }
    });

    it("should fail if there are instructions after the play_game instruction", async function () {
      const stakeAmount = new BN(10); // 10 tokens
      const choice = { split: {} }; // Assuming choice is an enum-like object

      try {
        await splitOrSteal.methods
          .playGame(choice, stakeAmount)
          .accounts({
            player: payer.publicKey,
            playerProfile: playerProfilePDA,
            playerTokenAccount: playerTokenAccountPDA,
            gameVault: gameVaultPDA,
            gameVaultTokenAccount: gameVaultTokenAccountPDA,
            creator: payer.publicKey,
            mint: TOKEN_MINT,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .postInstructions([
            // Simulate an instruction after play_game
            anchor.web3.SystemProgram.transfer({
              fromPubkey: payer.publicKey,
              toPubkey: gameVaultPDA,
              lamports: 1,
            }),
          ])
          .rpc();
        assert.fail(
          "The transaction should have failed due to instructions after play_game"
        );
      } catch (err) {
        assert.include(
          err.message,
          "UnexpectedInstruction",
          "Instruction after play_game should cause an error"
        );
      }
    });
  });

  describe("#play_game_slot_hash_deserialization", async function () {
    it("should fail if slot hashes account cannot be deserialized correctly", async function () {
      const stakeAmount = new BN(10); // 10 tokens
      const choice = { split: {} }; // Assuming choice is an enum-like object

      // Use an incorrect account for slot_hashes to simulate deserialization failure
      const invalidSlotHashes = PublicKey.default;

      try {
        await splitOrSteal.methods
          .playGame(choice, stakeAmount)
          .accounts({
            player: payer.publicKey,
            playerProfile: playerProfilePDA,
            playerTokenAccount: playerTokenAccountPDA,
            gameVault: gameVaultPDA,
            gameVaultTokenAccount: gameVaultTokenAccountPDA,
            creator: payer.publicKey,
            mint: TOKEN_MINT,
            slotHashes: invalidSlotHashes,
            instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .preInstructions([
            anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
              units: 100_000,
            }),
            anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 100,
            }),
          ])
          .rpc();
        assert.fail(
          "The transaction should have failed due to slot hashes deserialization error"
        );
      } catch (err) {
        assert.include(
          err.message,
          "ConstraintAddress.",
          "Wrong address for slot hashes"
        );
      }
    });
  });
  describe("#play_game_logging", async function () {
    it("should log game results correctly", async function () {
      advanceClockBySlots(context, NUM_SLOTS_COOLDOWN);
      const stakeAmount = new BN(1); // 10 tokens
      const choice = { split: {} }; // Assuming choice is an enum-like object

      // Get the playGame instruction
      const playGameInstruction = await splitOrSteal.methods
        .playGame(choice, stakeAmount)
        .accounts({
          player: payer.publicKey,
          playerProfile: playerProfilePDA,
          playerTokenAccount: playerTokenAccountPDA,
          gameVault: gameVaultPDA,
          gameVaultTokenAccount: gameVaultTokenAccountPDA,
          creator: payer.publicKey,
          mint: TOKEN_MINT,
          slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
          instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([payer])
        .instruction();

      // Construct a transaction
      const transaction = new anchor.web3.Transaction().add(
        playGameInstruction
      );
      transaction.recentBlockhash = (await banksClient.getLatestBlockhash())[0];
      transaction.feePayer = payer.publicKey;
      transaction.sign(payer);

      // Simulate the transaction
      const simulationResult = await context.banksClient.simulateTransaction(
        transaction
      );

      // Get log messages from the simulation metadata
      const logMessages = simulationResult.meta.logMessages;

      // Define the expected log message
      const expectedLog = `Results: Stake Amount: ${(
        stakeAmount.toNumber() * 1_000_000_000
      ).toString()}, Player Choice: Split, Opponent Choice: `; // Adjust this according to the expected result format
      console.log(logMessages);

      // Check if the log messages contain the expected log message
      assert(
        logMessages.some((msg) => msg.includes(expectedLog)),
        "Log should include the expected game result message"
      );
    });
  });

  describe("#play_game_logging", async function () {
    it("should log game results correctly", async function () {
      advanceClockBySlots(context, NUM_SLOTS_COOLDOWN);
      const stakeAmount = new BN(1); // 1 token (assuming 1 token equals 1_000_000_000 lamports)
      const choice = { split: {} }; // Assuming choice is an enum-like object

      // Get the playGame instruction
      const playGameInstruction = await splitOrSteal.methods
        .playGame(choice, stakeAmount)
        .accounts({
          player: payer.publicKey,
          playerProfile: playerProfilePDA,
          playerTokenAccount: playerTokenAccountPDA,
          gameVault: gameVaultPDA,
          gameVaultTokenAccount: gameVaultTokenAccountPDA,
          creator: payer.publicKey,
          mint: TOKEN_MINT,
          slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
          instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([payer])
        .instruction();

      // Get token balance before the transaction
      const playerTokenAccountBefore = await token.getAccount(
        provider.connection,
        playerTokenAccountPDA
      );

      // Construct a transaction
      const transaction = new anchor.web3.Transaction().add(
        playGameInstruction
      );
      transaction.recentBlockhash = (await banksClient.getLatestBlockhash())[0];
      transaction.feePayer = payer.publicKey;
      transaction.sign(payer);

      // Simulate the transaction
      const simulationResult = await context.banksClient.simulateTransaction(
        transaction
      );

      await provider.sendAndConfirm(transaction);

      // Get token balance after the transaction
      const playerTokenAccountAfter = await token.getAccount(
        provider.connection,
        playerTokenAccountPDA
      );

      //   console.log("before", playerTokenAccountBefore.amount);
      //   console.log("after", playerTokenAccountAfter.amount);
      // Calculate the outcome amount based on token balance change
      const outcomeAmount =
        playerTokenAccountAfter.amount - playerTokenAccountBefore.amount;

      // Get log messages from the simulation metadata
      const logMessages = simulationResult.meta.logMessages;

      // Define the expected log message
      const expectedLog = `Results: Stake Amount: ${
        stakeAmount.toNumber() * 1_000_000_000
      }, Player Choice: Split, Opponent Choice: `; // Adjust this according to the expected result format
      const expectedOutcomeLog = `Outcome Amount: ${outcomeAmount}`;

      //   console.log(logMessages);
      //   console.log("expected ", expectedLog);
      //   console.log("expected other", expectedOutcomeLog);

      // Check if the log messages contain the expected log message
      assert(
        logMessages.some(
          (msg) => msg.includes(expectedLog) && msg.includes(expectedOutcomeLog)
        ),
        "Log should include the expected game result message"
      );
    });
  });

  describe("#play_game_split_bonus", async function () {
    it("should log split bonus message correctly", async function () {
      const stakeAmount = new BN(0); // 1 token (assuming 1 token equals 1_000_000_000 lamports)
      const choice = { split: {} }; // Assuming choice is an enum-like object
      const maxAttempts = 5000; // Number of attempts to simulate

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        advanceClockBySlots(context, NUM_SLOTS_COOLDOWN);
        // Get the playGame instruction
        const playGameInstruction = await splitOrSteal.methods
          .playGame(choice, stakeAmount)
          .accounts({
            player: payer.publicKey,
            playerProfile: playerProfilePDA,
            playerTokenAccount: playerTokenAccountPDA,
            gameVault: gameVaultPDA,
            gameVaultTokenAccount: gameVaultTokenAccountPDA,
            creator: payer.publicKey,
            mint: TOKEN_MINT,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([payer])
          .instruction();

        // Construct a transaction
        const transaction = new anchor.web3.Transaction().add(
          playGameInstruction
        );
        transaction.recentBlockhash = (
          await banksClient.getLatestBlockhash()
        )[0];
        transaction.feePayer = payer.publicKey;
        transaction.sign(payer);

        // Simulate the transaction
        const simulationResult = await context.banksClient.simulateTransaction(
          transaction
        );
        await provider.sendAndConfirm(transaction);

        // Get log messages from the simulation metadata
        const logMessages = simulationResult.meta.logMessages;

        // Check if the log messages contain the split bonus message
        const splitBonusMessage = logMessages.find((msg) =>
          msg.includes("Got the split bonus! Split Bonus:")
        );

        if (splitBonusMessage) {
          console.log(
            `Split bonus message found on attempt ${
              attempt + 1
            }: ${splitBonusMessage}`
          );
          assert(true, "Split bonus message should appear in the logs");
          return;
        }

        // Advance the clock by 1 second and the slot by 1
        let currentClock = await context.banksClient.getClock();
        const newSlot = currentClock.slot + BigInt(1);
        context.setClock(
          new Clock(
            newSlot,
            currentClock.epochStartTimestamp,
            currentClock.epoch,
            currentClock.leaderScheduleEpoch,
            currentClock.unixTimestamp + BigInt(1)
          )
        );
      }

      assert.fail(
        "Split bonus message did not appear in the logs after maximum attempts"
      );
    });
  });

  describe("#play_game_run_out_clock", async function () {
    it("should run transactions with random stake amounts and check final balances", async function () {
      const maxAttempts = 5000; // Number of attempts to simulate

      // Get initial balances
      const initialPlayerTokenAccount = await token.getAccount(
        provider.connection,
        playerTokenAccountPDA
      );
      const initialPlayerTokenAmount = Number(initialPlayerTokenAccount.amount);
      const initialGameVault = await splitOrSteal.account.gameVault.fetch(
        gameVaultPDA
      );
      const initialVaultTokenAmount = initialGameVault.mintRemaining.toNumber();

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        advanceClockBySlots(context, NUM_SLOTS_COOLDOWN);
        const playerTokenAccount = await token.getAccount(
          provider.connection,
          playerTokenAccountPDA
        );
        const maxStake = Math.max(
          1,
          Math.min(100, Number(playerTokenAccount.amount) / 1_000_000_000)
        );
        const stakeAmount = new BN(Math.floor(Math.random() * maxStake)); // Random stake amount between 0 and maxStake

        if (
          Number(playerTokenAccount.amount) <
          stakeAmount.toNumber() * 1_000_000_000
        ) {
          continue; // Skip if player has insufficient tokens for this stake amount
        }

        const choice = Math.random() > 0.5 ? { split: {} } : { steal: {} }; // Random choice between split and steal

        // Get the playGame instruction
        const playGameInstruction = await splitOrSteal.methods
          .playGame(choice, stakeAmount)
          .accounts({
            player: payer.publicKey,
            playerProfile: playerProfilePDA,
            playerTokenAccount: playerTokenAccountPDA,
            gameVault: gameVaultPDA,
            gameVaultTokenAccount: gameVaultTokenAccountPDA,
            creator: payer.publicKey,
            mint: TOKEN_MINT,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([payer])
          .preInstructions([
            anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
              units: 70_000,
            }),
            anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 100,
            }),
          ])
          .instruction();

        // Construct a transaction
        const transaction = new anchor.web3.Transaction().add(
          playGameInstruction
        );
        transaction.recentBlockhash = (
          await banksClient.getLatestBlockhash()
        )[0];
        transaction.feePayer = payer.publicKey;
        transaction.sign(payer);

        // Simulate the transaction
        // const simulationResult = await context.banksClient.simulateTransaction(
        //   transaction
        // );
        try {
          await provider.sendAndConfirm(transaction);
        } catch (e) {
          break;
        }

        // Advance the clock by 1 second and the slot by 1
        let currentClock = await context.banksClient.getClock();
        const newSlot = currentClock.slot + BigInt(1);
        context.setClock(
          new Clock(
            newSlot,
            currentClock.epochStartTimestamp,
            currentClock.epoch,
            currentClock.leaderScheduleEpoch,
            currentClock.unixTimestamp + BigInt(1)
          )
        );
      }

      // Get final balances
      const finalPlayerTokenAccount = await token.getAccount(
        provider.connection,
        playerTokenAccountPDA
      );
      const finalPlayerTokenAmount = Number(finalPlayerTokenAccount.amount);
      const finalGameVault = await splitOrSteal.account.gameVault.fetch(
        gameVaultPDA
      );
      const finalPlayerProfile = await splitOrSteal.account.playerProfile.fetch(
        playerProfilePDA
      );
      const finalVaultTokenAmount = finalGameVault.mintRemaining.toNumber();

      // Calculate expected values
      //   const tokensSpentByPlayer =
      //     initialPlayerTokenAmount - finalPlayerTokenAmount;
      //   const tokensBurnedFromVault =
      //     initialVaultTokenAmount - finalVaultTokenAmount;
      //   const expectedVaultTokenAmount =
      //     initialVaultTokenAmount - tokensSpentByPlayer;

      // Log the calculated values
      console.log(
        "initial token amount: ",
        finalGameVault.initialTokens.toNumber() / 1_000_000_000
      );
      console.log(
        "Final Player Token Amount:",
        finalPlayerTokenAmount / 1_000_000_000
      );
      console.log(
        "Final Vault Token Amount:",
        finalVaultTokenAmount / 1_000_000_000
      );
      //   console.log("Tokens Spent by Player:", tokensSpentByPlayer);
      console.log(
        "Tokens Burned from Vault:",
        finalGameVault.burnedAmount.toNumber() / 1_000_000_000
      );
      console.log("num splits: ", finalGameVault.numSplits);
      console.log("num steals: ", finalGameVault.numSteals);
      console.log("num 0 stakes: ", finalGameVault.numZeroStakes);
      console.log("num 100 stakes: ", finalGameVault.numHundredStakes);
      console.log(
        "Tokens gained: ",
        finalPlayerProfile.tokensGained.toNumber()
      );
      console.log(
        "Tokens burned: ",
        finalPlayerProfile.tokensBurned.toNumber()
      );
      console.log("Number of games: ", finalPlayerProfile.numGames);
      console.log(
        "Number of split bonuses: ",
        finalPlayerProfile.numSplitBonuses
      );
      console.log(
        "Average number of splits (scaled): ",
        finalPlayerProfile.averageNumSplits.toNumber() / 1e9
      );
      console.log(
        "Average stake amount (scaled): ",
        finalPlayerProfile.averageStakeAmount.toNumber() / 1e9
      );

      //   console.log("Expected Vault Token Amount:", expectedVaultTokenAmount);

      // Check balances
      assert.equal(
        finalVaultTokenAmount,
        0,
        "Vault should have given out all the tokens it knew about"
      );
      assert.equal(
        finalGameVault.burnedAmount.toNumber() + 500000000, // There's a single other player in a new test
        finalGameVault.initialTokens.toNumber() - finalPlayerTokenAmount,
        "Tokens burned from the vault should match tokens spent by the player"
      );
    });
  });
});

// describe("split_or_steal", () => {
//   // Configure the client to use the local cluster.
//   anchor.setProvider(anchor.AnchorProvider.env());

//   const program = anchor.workspace.SplitOrSteal as Program<SplitOrSteal>;

//   it("Is initialized!", async () => {
//     // Add your test here.
//     const tx = await program.methods.initialize().rpc();
//     console.log("Your transaction signature", tx);
//   });
// });
