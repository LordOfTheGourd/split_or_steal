import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
const { Keypair } = anchor.web3;
import * as fs from "fs";
import { PublicKey } from "../tests/split_or_steal";

// import { PublicKey } from "@solana/web3.js";

function loadKeypairFromFile(filePath: string): anchor.web3.Keypair {
  const secretKeyString = fs.readFileSync(filePath, "utf-8");
  const secretKeyArray = JSON.parse(secretKeyString) as number[];
  const secretKey = Uint8Array.from(secretKeyArray);
  return Keypair.fromSecretKey(secretKey);
}

async function createNewMint(
  provider,
  decimals,
  mintAuthority,
  freezeAuthority
) {
  const mint = loadKeypairFromFile(
    "./keypairs/SoRSy2b5sbpCXzWSB999nQFzsgVxUBaymwpNu55Y7WY.json"
  );
  try {
    const mintAccount = await token.getMint(
      provider.connection,
      mint.publicKey
    );
    console.log("Mint already exists:", mintAccount.address.toBase58());
  } catch (e) {
    try {
      await provider.sendAndConfirm(
        new anchor.web3.Transaction().add(
          anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
            units: 200_000,
          }),
          anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 100,
          }),
          anchor.web3.SystemProgram.createAccount({
            fromPubkey: provider.wallet.publicKey,
            newAccountPubkey: mint.publicKey,
            space: token.MintLayout.span,
            lamports:
              await provider.connection.getMinimumBalanceForRentExemption(
                token.MintLayout.span
              ),
            programId: TOKEN_PROGRAM_ID,
          }),
          token.createInitializeMintInstruction(
            mint.publicKey,
            decimals,
            mintAuthority,
            freezeAuthority,
            TOKEN_PROGRAM_ID
          )
        ),
        [mint]
      );
      console.log("Token mint created: ", mint.publicKey.toBase58());
    } catch (e) {
      console.log("Failed to create mint:", e);
      process.exit(1);
    }
  }
  return mint.publicKey;
}

async function main() {
  const connection = new anchor.web3.Connection("...", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    anchor.AnchorProvider.defaultOptions()
  );
  anchor.setProvider(provider);

  const payer = wallet.payer;
  const TOKEN_MINT = await createNewMint(
    provider,
    9,
    payer.publicKey,
    payer.publicKey
  );

  const num_tokens = 1_000_000_000; // 1 billion tokens
  const nine_decimals = 1_000_000_000;
  const tokenAmount = new BN(num_tokens).mul(new BN(nine_decimals));

  let creatorTokenAccount: PublicKey;
  try {
    // Get the associated token address for the specific mint
    creatorTokenAccount = await token.getAssociatedTokenAddress(
      TOKEN_MINT,
      payer.publicKey
    );

    // Try to fetch the token account
    const tokenAccountInfo = await token.getAccount(
      provider.connection,
      creatorTokenAccount
    );

    console.log(
      "Token account already exists:",
      creatorTokenAccount.toBase58()
    );
  } catch (e) {
    // If the token account doesn't exist, create it
    try {
      const createTokenAccountInstruction =
        token.createAssociatedTokenAccountInstruction(
          payer.publicKey,
          creatorTokenAccount,
          payer.publicKey,
          TOKEN_MINT
        );

      const transaction = new anchor.web3.Transaction().add(
        anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: 200_000,
        }),
        anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 100,
        }),
        createTokenAccountInstruction
      );

      await provider.sendAndConfirm(transaction, [], {
        commitment: "confirmed",
      });
      console.log("Token account created:", creatorTokenAccount.toBase58());
    } catch (creationError) {
      console.log("Failed to create token account:", creationError);
      process.exit(1);
    }
  }

  try {
    const tokenAccountInfo = await token.getAccount(
      provider.connection,
      creatorTokenAccount
    );
    if (Number(tokenAccountInfo.amount) === 0) {
      const mintToInstruction = token.createMintToInstruction(
        TOKEN_MINT,
        creatorTokenAccount,
        payer.publicKey,
        BigInt(num_tokens) * BigInt(nine_decimals)
      );

      const transaction = new anchor.web3.Transaction().add(
        anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: 200_000,
        }),
        anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 20_000,
        }),
        mintToInstruction
      );

      await provider.sendAndConfirm(transaction, [], {
        commitment: "confirmed",
      });
      console.log("Tokens minted to:", creatorTokenAccount.toBase58());
    } else {
      console.log("Token account already has tokens, skipping minting.");
    }
  } catch (e) {
    console.log("Failed to mint tokens:", e);
    process.exit(1);
  }

  try {
    const tokenAccountInfo = await token.getAccount(
      provider.connection,
      creatorTokenAccount
    );
    const tokensToBurn = BigInt(1_000_000_000) * BigInt(nine_decimals);

    if (Number(tokenAccountInfo.amount) >= Number(tokensToBurn)) {
      const burnInstruction = token.createBurnInstruction(
        creatorTokenAccount,
        TOKEN_MINT,
        payer.publicKey,
        tokensToBurn
      );

      const transaction = new anchor.web3.Transaction().add(
        anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: 200_000,
        }),
        anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 20_000,
        }),
        burnInstruction
      );

      await provider.sendAndConfirm(transaction, [], {
        commitment: "confirmed",
      });
      console.log(
        "1 billion tokens burned from:",
        creatorTokenAccount.toBase58()
      );
    } else {
      console.log("Not enough tokens in account to burn.");
    }
  } catch (e) {
    console.log("Failed to burn tokens:", e);
    process.exit(1);
  }

  // Tried to do metadata upload in here as well but metaplex fucks everything up by using a completely different version of spl-token
  console.log({
    creator: payer.publicKey.toBase58(),
    creatorTokenAccount: creatorTokenAccount.toBase58(),
    mint: TOKEN_MINT.toBase58(),
    tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
