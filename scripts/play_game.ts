import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { TOKEN_PROGRAM_ID, AuthorityType } from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { SplitOrSteal } from "../target/types/split_or_steal";
import { assert } from "chai";
import * as fs from "fs";

// Load the IDL
const SplitOrStealIDL: SplitOrSteal = require("../target/idl/split_or_steal.json");

const RPC_URL = "...";
const SPLIT_OR_STEAL_PROGRAM_ID = new PublicKey(
  "SRSPsMqHaSLJjPNKEoQbTeF6TSvospw2PXGkfj4VzhD"
);
const TOKEN_MINT = new PublicKey("SoRSy2b5sbpCXzWSB999nQFzsgVxUBaymwpNu55Y7WY");
const KEYPAIR_PATH =
  "/root/projects/split_or_steal/program/keypairs/TS6tUsqByQJwt4hCSLNjxmrdEQTXjLJECeAuYCobUaX.json"; // Change this to your keypair file path

function loadKeypairFromFile(filePath: string): Keypair {
  const secretKeyString = fs.readFileSync(filePath, "utf-8");
  const secretKeyArray = JSON.parse(secretKeyString) as number[];
  const secretKey = Uint8Array.from(secretKeyArray);
  return Keypair.fromSecretKey(secretKey);
}

// Function to calculate bet amount
function findBetAmount(initialCapital: number, probSplit: number): number {
  let requiredInitialCapital;
  if (probSplit <= 0.5) {
    requiredInitialCapital = 5 / probSplit;
  } else if (0.5 < probSplit && probSplit <= 0.55) {
    requiredInitialCapital = 7;
  } else if (0.55 < probSplit && probSplit <= 0.61) {
    requiredInitialCapital = 6;
  } else if (0.61 < probSplit && probSplit <= 0.66) {
    requiredInitialCapital = 5;
  } else if (0.66 < probSplit && probSplit <= 0.73) {
    requiredInitialCapital = 4;
  } else if (0.73 < probSplit && probSplit <= 0.81) {
    requiredInitialCapital = 3;
  } else if (0.81 < probSplit && probSplit <= 0.9) {
    requiredInitialCapital = 2;
  } else {
    requiredInitialCapital = 1;
  }

  // We're only splitting so we need double the initial capital or something like that
  requiredInitialCapital *= 2;

  let uncorrectBetAmount = Math.floor(
    initialCapital / Math.ceil(requiredInitialCapital)
  );
  let betAmount = Math.min(uncorrectBetAmount, 100);
  console.log("bet amount", betAmount);
  return betAmount;
}

async function playSplitOrStealGame(provider, splitOrSteal, options) {
  let currentChoice = "split";
  let these_compute_units = 140_000;

  while (true) {
    let initialCapital = 0;
    try {
      const playerTokenAccount = await token.getAccount(
        provider.connection,
        options.playerTokenAccountPDA
      );
      initialCapital = Number(playerTokenAccount.amount) / 1e9;
      console.log("Current token balance: ", initialCapital);
      these_compute_units = 90_000;
    } catch (error) {
      console.error("Failed to fetch player's token account:", error);
      initialCapital = 0;
    }

    const gameVaultAccount = await splitOrSteal.account.gameVault.fetch(
      options.gameVaultPDA
    );
    const splitsCount = gameVaultAccount.numSplits;
    const probSplit = splitsCount / 1000;

    console.log("num splits: ", splitsCount);
    console.log("num steals: ", gameVaultAccount.numSteals);
    let stakeAmount;
    if (currentChoice === "split") {
      stakeAmount = new BN(0); // Split with 0 tokens
    } else {
      stakeAmount = new BN(
        Math.min(findBetAmount(initialCapital, probSplit), options.maxBetAmount)
      );
    }

    const choice = currentChoice === "split" ? { split: {} } : { steal: {} };

    let txSignature;
    let success = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        txSignature = await splitOrSteal.methods
          .playGame(choice, stakeAmount)
          .accounts({
            player: options.payer.publicKey,
            playerProfile: options.playerProfilePDA,
            playerTokenAccount: options.playerTokenAccountPDA,
            gameVault: options.gameVaultPDA,
            gameVaultTokenAccount: options.gameVaultTokenAccountPDA,
            creator: options.payer.publicKey,
            mint: options.TOKEN_MINT,
            slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
            instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .preInstructions([
            anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
              units: these_compute_units,
            }),
            anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 20_000,
            }),
          ])
          .rpc(options.confirmOptions);

        await new Promise((resolve) => setTimeout(resolve, 5000));

        const tx = await provider.connection.getTransaction(txSignature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });

        if (tx?.meta?.err) {
          console.log("Transaction failed:", tx.meta.err);
        } else {
          console.log("Transaction succeeded:", tx.meta?.logMessages);
          success = true;
          const computeUnitsUsed = tx.meta.logMessages.reduce((acc, msg) => {
            const match = msg.match(
              /SRSPsMqHaSLJjPNKEoQbTeF6TSvospw2PXGkfj4VzhD consumed (\d+) of/
            );
            return match ? acc + parseInt(match[1], 10) : acc;
          }, 0);
          console.log("Compute units used:", computeUnitsUsed);

          const playerProfile = await splitOrSteal.account.playerProfile.fetch(
            options.playerProfilePDA
          );
          console.log(
            "Player profile total tokens earned:",
            playerProfile.tokensGained.toNumber() / 1e9
          );
          console.log(
            "Player profile total tokens burned:",
            playerProfile.tokensBurned.toNumber() / 1e9
          );
          //   const playerProfile = await splitOrSteal.account.playerProfile.fetch(options.playerProfilePDA);
          console.log(
            "Player profile isInitialized:",
            playerProfile.isInitialized
          );
          console.log("Player profile bump:", playerProfile.bump);
          console.log(
            "Player profile lastPlayedSlot:",
            playerProfile.lastPlayedSlot.toNumber()
          );
          console.log(
            "Player profile tokensGained:",
            playerProfile.tokensGained.toNumber() / 1e9
          );
          console.log(
            "Player profile tokensBurned:",
            playerProfile.tokensBurned.toNumber() / 1e9
          );
          console.log("Player profile numGames:", playerProfile.numGames);
          console.log(
            "Player profile numSplitBonuses:",
            playerProfile.numSplitBonuses
          );
          console.log(
            "Player profile averageNumSplits:",
            playerProfile.averageNumSplits.toNumber() / 1e9
          );
          console.log(
            "Player profile averageStakeAmount:",
            playerProfile.averageStakeAmount.toNumber() / 1e9
          );

          const unusualOutcomeLog = tx.meta.logMessages.some(
            (log) =>
              log.includes(
                "Player Choice: Split, Opponent Choice: Split, Outcome Amount: 0"
              ) ||
              log.includes(
                "Player Choice: Steal, Opponent Choice: Split, Outcome Amount: 0"
              ) ||
              log.includes("Failed burn rate check") //||
            //   log.includes("Player currently too lucky to get a split bonus")
          );

          if (unusualOutcomeLog) {
            console.log("Found an unusual outcome");
            // process.exit(1);
          }

          break;
        }
      } catch (e) {
        console.log("Failed to send transaction:", e);
      }
    }

    // Actually never do anything but split i guess
    // if (success) {
    //   // Alternate choice only if the transaction was successful
    //   currentChoice = currentChoice === "split" ? "steal" : "split";
    // } else {
    //   console.log(
    //     "Transaction did not succeed after 2 attempts. Retrying the same choice..."
    //   );
    // }

    // Add a delay between transactions
    // await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

async function main() {
  const connection = new anchor.web3.Connection(`${RPC_URL}`, "confirmed");
  const payer = loadKeypairFromFile(KEYPAIR_PATH);

  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    anchor.AnchorProvider.defaultOptions()
  );
  anchor.setProvider(provider);

  const programId = SPLIT_OR_STEAL_PROGRAM_ID;
  const splitOrSteal = new anchor.Program(SplitOrStealIDL, programId, provider);

  //   const payer = wallet.payer;

  const [gameVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("lord of the gourd")],
    programId
  );
  const [gameVaultTokenAccountPDA] = PublicKey.findProgramAddressSync(
    [gameVaultPDA.toBuffer()],
    programId
  );

  const [playerProfilePDA] = PublicKey.findProgramAddressSync(
    [payer.publicKey.toBuffer()],
    splitOrSteal.programId
  );

  const playerTokenAccountPDA = token.getAssociatedTokenAddressSync(
    TOKEN_MINT,
    payer.publicKey
  );

  const confirmOptions = {
    commitment: "processed", // Minimal confirmation level
    skipPreflight: true, // Skip preflight checks
  };

  const options = {
    payer,
    gameVaultPDA,
    gameVaultTokenAccountPDA,
    playerProfilePDA,
    playerTokenAccountPDA,
    TOKEN_MINT,
    confirmOptions,
    maxBetAmount: 100,
  };

  await playSplitOrStealGame(provider, splitOrSteal, options);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
